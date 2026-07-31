# PLANora — CRM modul

Fejlesztési leírás Claude Code számára v1.1
Forrás: `docs/CRM modul.docx` (Üzleti specifikáció / BRS, 2026.07.31)

Ez a dokumentum a BRS-t implementáció-szintű tervvé alakítja, a meglévő PLANora
architektúrához (Next.js App Router + FastAPI/SQLAlchemy/PostgreSQL + MinIO,
`docker-compose.yml`) illesztve. Célja, hogy egy Claude Code munkamenet ebből
közvetlenül dolgozhasson: konkrét modellneveket, végpontokat, fájlokat és a
meglévő mintákra (RBAC, audit log, S3 dokumentumkezelés) való hivatkozásokat
tartalmaz újrafeltalálás helyett.

## 0. Döntési napló (v1.0 nyitott kérdéseinek lezárása)

1. **6.2 Kapcsolatkezelés** (hiányzik a BRS-ből) — jóváhagyva: `CustomerRelation`
   kapcsolótábla, l. 2.3.
2. **RBAC szerepkör-mapping** — jóváhagyva: **nincs új `UserRole` enum-érték**,
   a BRS 5 szerepköre a meglévő 7 értékre képződik le, l. 10.1.
3. **Opportunity "Fázis"** — egyértelműsítve: a BRS-ben a Lead- és
   Opportunity-életciklus valójában egybe van vonva (5. pont folyamatábrája:
   Lead minősítése → Opportunity → Ajánlat → Szerződés egy folytonos lánc).
   Nem vezetünk be külön, kitalált pipeline-szakaszokat (Kapcsolatfelvétel/
   Igényfelmérés/Tárgyalás — ezek valójában Lead-státuszok) — az Opportunity
   csak egy egyszerű **OPEN/WON/LOST** állapotot kap, ami az Ajánlat/Szerződés
   kimenetéből következik. L. 2.5.
4. **Ajánlat PDF-generálás** — törölve a tervből. Az ajánlat natív
   alkalmazásban készül és jelenik meg (nem export célú fájl), nincs szükség
   PDF-motorra a backendben. L. 2.6.
5. **Magánszemély minimál-adat szabály** — jóváhagyva, API-szintű validáció
   (nem csak UI-hint). L. 4.1.
6. **`Project.client_*` és `Customer` viszonya** — döntés: additív, nem romboló
   megoldás. `Project.customer_id` (nullable FK) új mező, a meglévő szabad
   szöveges `client_name`/`client_phone`/`client_email` mezők **változatlanul
   megmaradnak** (régi és nem CRM-ből induló projekteknél `customer_id IS
   NULL`, minden ma működő flow érintetlen). A Lead→Szerződött automatikus
   projektlétrehozás (4.3) ettől kezdve a FK-t is beállítja a másolt mezők
   mellett — így a CRM-ből induló projekteknél valódi kapcsolat jön létre, régi
   projekteknél nincs törés. A free-text mezők teljes Customer-re
   származtatása (meglévő projektek migrálása, mezők read-only-vá tétele)
   **külön, jövőbeli döntés**, nem ennek a tervnek a része.

**Új igény ebben a körben**: ügyfél export/import — l. 10. pont.

## 1. Illesztés a meglévő architektúrához

Amit a CRM modul újrahasznosít a meglévő kódból, ahelyett hogy párhuzamos
mintát vezetne be:

- **RBAC**: `require_roles(*roles)` dependency (`backend/app/dependencies.py:27`)
  — ugyanúgy admin mindig átengedve.
- **Rekordszintű szűrés**: a `scoped_activity_query` mintája
  (`backend/app/services/scoping.py`) — új `scoped_customer_query` /
  `scoped_lead_query` stb. hasonló logikával: a felelős ügyintéző csak sajátját
  látja, ADMIN/MANAGEMENT mindent.
- **Audit log**: a meglévő generikus `AuditLog` tábla
  (`entity_type`/`entity_id`/`field_name`/`old_value`/`new_value`,
  `backend/app/models.py:382`) — nincs szükség új audit táblára, csak új
  `entity_type` értékekre ("customer", "lead", "opportunity", "quote",
  "contract").
- **Dokumentumkezelés / S3**: a `backend/app/api/documents.py` upload/presign
  mintája (`get_s3_client`/`get_public_s3_client`, `S3_PUBLIC_ENDPOINT` split —
  lásd a dev-environment memóriát), de **polimorfikusra bővítve**, mert a BRS
  szerint egy dokumentum több üzleti rekordhoz is kapcsolható (6.9 üzleti
  szabály) — lásd 2.9.
- **Notification/digest**: a meglévő `Notification` modell +
  `services/notifications.py` napi digest job — a szerződés lejárat-figyelés
  (6.6) és a feladat-emlékeztetők (6.8) ebbe a csatornába kerülnek, nem új
  emailküldő logikába.
- **Keresés**: a meglévő `GET /search` (`backend/app/api/search.py`) bővül
  ügyfél/opportunity/szerződés találatokkal, ugyanabban a Ctrl+K panelben
  (`AppLayout`), nem külön CRM-keresőmezővel.
- **Frontend minták**: shadcn `Table`/`Tabs`/`AlertDialog`/`sonner` toast,
  ugyanaz a violet/fuchsia design nyelv, `AppLayout` szerepkör-gated sidebar
  nav bővítése egy "Ügyfélkapcsolatok" (CRM) szekcióval.

## 2. Adatmodell (`backend/app/models.py` bővítés)

Új fájlba szervezhető (`backend/app/models_crm.py`, importálva a
`database.Base`-ből), hogy a meglévő `models.py` ne nőjön túl — de ugyanabba a
metadata-ba, egy Alembic migrációban.

### 2.1 Enumok

```python
class CustomerType(str, enum.Enum):
    PERSON = "person"              # Magánszemély
    COMPANY = "company"            # Cég
    SOLE_PROPRIETOR = "sole_proprietor"  # Egyéni vállalkozó

class RelationshipType(str, enum.Enum):
    CUSTOMER = "customer"          # Ügyfél
    SUPPLIER = "supplier"          # Beszállító
    BOTH = "both"

class CustomerStatus(str, enum.Enum):
    INQUIRING = "inquiring"        # Érdeklődő
    ACTIVE = "active"               # Aktív
    INACTIVE = "inactive"           # Inaktív
    ARCHIVED = "archived"           # Archivált

class LeadSource(str, enum.Enum):
    WEBSITE = "website"
    PHONE = "phone"
    EMAIL = "email"
    REFERRAL = "referral"           # Ajánlás
    CUSTOMER = "customer"           # Ügyfél
    OTHER = "other"

class LeadStatus(str, enum.Enum):
    NEW = "new"                     # Új
    CONTACTING = "contacting"       # Kapcsolatfelvétel alatt
    QUOTING = "quoting"             # Ajánlat folyamatban
    REJECTED = "rejected"           # Elutasított
    WON = "won"                     # Szerződött

class OpportunityPhase(str, enum.Enum):
    # Egyértelműsítve (l. 0/3. döntés): nincs külön kitalált pipeline,
    # a tényleges lefolyást a Lead- és Quote-státuszok írják le.
    OPEN = "open"                   # Nyitott (ajánlat készítés/egyeztetés alatt)
    WON = "won"                     # Nyert (ajánlat elfogadva → szerződés)
    LOST = "lost"                   # Vesztett (elutasítva)

class QuoteStatus(str, enum.Enum):
    DRAFT = "draft"                 # Tervezet
    APPROVAL_PENDING = "approval_pending"  # Jóváhagyás alatt
    SENT = "sent"                   # Kiküldve
    ACCEPTED = "accepted"           # Elfogadva
    REJECTED = "rejected"           # Elutasítva
    EXPIRED = "expired"             # Lejárt

class ContractStatus(str, enum.Enum):
    DRAFT = "draft"                 # Tervezet
    ACTIVE = "active"                # Aktív
    EXPIRED = "expired"              # Lejárt
    TERMINATED = "terminated"        # Felmondott
    ARCHIVED = "archived"            # Archivált

class CommunicationType(str, enum.Enum):
    PHONE = "phone"
    EMAIL = "email"
    SMS = "sms"
    IN_PERSON = "in_person"         # Személyes találkozó
    ONLINE_MEETING = "online_meeting"
    OTHER = "other"

class CrmTaskStatus(str, enum.Enum):
    OPEN = "open"                   # Nyitott
    IN_PROGRESS = "in_progress"     # Folyamatban
    WAITING = "waiting"              # Várakozik
    DONE = "done"                    # Kész

class CrmTaskPriority(str, enum.Enum):
    LOW = "low"; NORMAL = "normal"; HIGH = "high"; CRITICAL = "critical"

class CrmDocumentType(str, enum.Enum):
    QUOTE = "quote"; CONTRACT = "contract"; MINUTES = "minutes"  # Jegyzőkönyv
    PDF = "pdf"; IMAGE = "image"; OTHER = "other"
```

### 2.2 `Customer` (Ügyfél)

- `id`, `customer_number` (automatikus, egyedi, pl. `UGY-2026-0001` sorozat —
  lásd a `Project.project_code` mintáját), `type` (`CustomerType`),
  `relationship_type` (`RelationshipType`, default CUSTOMER), `name`,
  `status` (`CustomerStatus`, default INQUIRING), `owner_id` (FK `users.id`,
  "Felelős ügyintéző", **kötelező**), `created_at`.
- **`type == PERSON` esetén** `phone`/`email`/egyéb kapcsolattartási mező
  `None` marad — lásd 4.1 üzleti szabály (API-validáció, nem csak nullable).
- `type in (COMPANY, SOLE_PROPRIETOR)` esetén opcionális `phone`, `email`,
  `tax_number` (adószám), `billing_address`.
- Kapcsolatok: `opportunities`, `quotes` (opportunity-n át), `contracts`,
  `communication_events`, `crm_tasks`, `leads` (ha meglévő ügyfélből jött a
  lead), `projects` (a 0/6. döntés `Project.customer_id` FK-ján át, l. 2.2.1).

#### 2.2.1 `Project.customer_id` (additív mező a meglévő `Project` modellhez)

- Új nullable oszlop: `customer_id: Mapped[int | None] =
  mapped_column(ForeignKey("customers.id", ondelete="SET NULL"),
  nullable=True)` a meglévő `Project` modellben
  (`backend/app/models.py:121`).
- A meglévő `client_name`/`client_phone`/`client_email` mezők **nem
  változnak** — párhuzamosan élnek a FK-val.
- Csak a Lead→Szerződött automatikus projektlétrehozás (4.3) tölti ki;
  manuálisan (a projekt-szerkesztő formon) egyelőre nem szerkeszthető —
  ez elkerüli, hogy a meglévő projekt-edit UI-t bővíteni kelljen ebben a
  körben.

### 2.3 `CustomerRelation` (Kapcsolatkezelés — 6.2 pótlása)

- `id`, `company_customer_id` (FK `customers.id`), `person_customer_id`
  (FK `customers.id`), `role_label` (szabad szöveg, pl. "kapcsolattartó",
  "tulajdonos"), `is_primary` (bool).
- Unique constraint: (`company_customer_id`, `person_customer_id`).

### 2.4 `Lead`

- `id`, `name`, `source` (`LeadSource`), `owner_id` (FK, "Felelős
  ügyintéző"), `status` (`LeadStatus`, default NEW), `customer_id`
  (FK, nullable — ha már meglévő ügyfélhez kötött), `project_id` (FK
  `projects.id`, nullable, `ondelete="SET NULL"` — a `WON` váltáskor
  automatikusan létrejövő projektre mutat, l. 4.3), `created_at`.

### 2.5 `Opportunity` (Értékesítési lehetőség)

- `id`, `customer_id` (FK, kötelező), `phase` (`OpportunityPhase`: OPEN/
  WON/LOST, l. 2.1), `owner_id` (FK, "Felelős ügyintéző"), `estimated_value`
  (Numeric, nullable — a 6.10 "Pipeline érték" riporthoz szükséges, a BRS nem
  nevesíti explicit mezőként, de a riport csak ebből számolható), `created_at`.
- Egy ügyfélhez több opportunity tartozhat (nincs unique constraint).
- `phase` átmenet: `WON` csak akkor állítható, ha van hozzá `ACCEPTED`
  állapotú `Quote`; `LOST` bármikor (elutasítás).

### 2.6 `Quote` (Ajánlat) + verziózás — natív, nincs PDF-export

- `Quote`: `id`, `opportunity_id` (FK), `quote_number` (egyedi, sorozat),
  `date`, `status` (`QuoteStatus`), `current_version` (int, default 1).
- `QuoteVersion`: `id`, `quote_id` (FK, `ondelete=CASCADE`), `version`
  (int), `content_json` (a verzió tartalma — tételsorok, árak, feltételek;
  a frontend natívan, egy strukturált táblázat-komponensben jeleníti meg,
  nincs backend-oldali fájlgenerálás), `created_at`, `created_by_id`.
- Ha a felhasználónak mégis kell egy másolat, a böngésző natív "Nyomtatás /
  Mentés PDF-ként" funkciója elegendő a natívan renderelt nézetről — ez
  frontend CSS `@media print` réteg, nem backend feladat.
- Üzleti szabály: elfogadott (`ACCEPTED`) ajánlatból hozható létre szerződés
  (l. `POST /crm/quotes/{id}/create-contract`).

### 2.7 `Contract` (Szerződés)

- `id`, `customer_id` (FK), `quote_id` (FK, nullable — melyik ajánlatból
  jött), `contract_number` (egyedi), `start_date`, `end_date`,
  `status` (`ContractStatus`).
- Lejárat-figyelés: a meglévő digest job (`services/notifications.py`)
  bővítése — `end_date` X napon belül → `Notification` sor (mint a
  `UPCOMING_PREP`/`SLIPPING_PROJECT` típusok mellé egy `CONTRACT_EXPIRING`).

### 2.8 `CommunicationEvent` (Kommunikációs esemény)

- `id`, `customer_id` (FK), `type` (`CommunicationType`), `date`,
  `agent_id` (FK `users.id`, "Ügyintéző"), `summary` (Text, "Rövid
  összefoglaló"), `created_at`.
- Frontend: időrendi timeline nézet az ügyfél adatlapon (6.7 "Idővonal
  megjelenítés").

### 2.9 `CrmTask` (Feladat — külön a meglévő `Activity`-től!)

**Fontos névütközés-elkerülés**: a meglévő rendszerben "task"/"feladat" az
`Activity` modellre és a `/tasks` (`my-tasks`, `prep-center`) végpontokra utal
(építési ütemterv-tételek). A CRM feladatok teljesen más entitás — ezért
`CrmTask` néven, külön `/crm/tasks` router alatt, hogy ne keveredjen a
meglévő "Saját feladataim" nézettel.

- `id`, `name`, `customer_id` (FK), `due_date`, `owner_id` (FK,
  "Felelős"), `status` (`CrmTaskStatus`), `priority` (`CrmTaskPriority`),
  `created_at`.
- Emlékeztetők (6.8 "Emlékeztetők"): a meglévő digest jobba integrálva,
  nem külön scheduler.

### 2.10 `CrmDocument` + `CrmDocumentLink` (polimorfikus, sok-a-sokhoz)

A BRS 6.9 üzleti szabálya explicit: *"Egy dokumentum több üzleti rekordhoz is
kapcsolható."* Ez eltér a meglévő `Document` modelltől, ami kőkeményen
`project_id`-hez van kötve — ezért **nem** a meglévő `documents.py`
végpontjait bővítjük, hanem egy párhuzamos, polimorfikus modellt vezetünk be,
ugyanazzal az S3 upload/presign mintával (`get_s3_client`/
`get_public_s3_client`, `ALLOWED_EXTENSIONS`, `MAX_UPLOAD_BYTES`).

- `CrmDocument`: `id`, `filename`, `original_filename`, `content_type`,
  `file_size`, `s3_key`, `document_type` (`CrmDocumentType`), `version`,
  `uploaded_by_id`, `created_at`. (S3 prefix pl. `crm/` a meglévő projekt-
  dokumentum prefixtől elkülönítve.)
- `CrmDocumentLink`: `id`, `document_id` (FK `crm_documents.id`,
  `ondelete=CASCADE`), `entity_type` (string: "customer"/"lead"/
  "opportunity"/"quote"/"contract"), `entity_id` (int).
- Egy dokumentum feltöltésekor 1 elsődleges linket kap; a "kapcsolás több
  rekordhoz" funkció (6.9) újabb `CrmDocumentLink` sorokat ad hozzá.

## 3. Migráció (Alembic)

Egy migráció (`backend/migrations/versions/xxxx_crm_module.py`), a meglévő
mintát követve (autogenerálás egy eldobható DB-n, majd a valós DB-n
`alembic upgrade head` — **nem** `stamp head`, mert ez tényleg új táblákat/
oszlopokat hoz létre, nem meglévő sémát ír le). Sorrend: enumok →
`Project.customer_id` oszlop hozzáadása → `customers` → `customer_relations`
→ `leads` (`project_id` mezővel) → `opportunities` → `quotes`/
`quote_versions` → `contracts` → `communication_events` → `crm_tasks` →
`crm_documents`/`crm_document_links`.

## 4. Backend — API végpontok és üzleti szabályok

Új routerek `backend/app/api/` alá, regisztrálva `main.py`-ban a meglévő
mintával (`app.include_router(...)`), közös `/crm` prefix alatt:

| Fájl | Prefix | Végpontok |
|---|---|---|
| `crm_customers.py` | `/crm/customers` | CRUD, archiválás (soft-delete only — l. 4.1), keresés/szűrés (9. pont mezői), kapcsolódó rekordok listázása, `GET .../export`, `POST .../import` (l. 10. pont) |
| `crm_relations.py` | `/crm/customer-relations` | CRUD a `CustomerRelation`-höz |
| `crm_leads.py` | `/crm/leads` | CRUD, státuszváltás (`PATCH .../status`), feladat/dokumentum/ajánlat kapcsolás |
| `crm_opportunities.py` | `/crm/opportunities` | CRUD, fázisváltás |
| `crm_quotes.py` | `/crm/quotes` | CRUD, `POST .../versions` (új verzió), `POST .../{id}/create-contract` |
| `crm_contracts.py` | `/crm/contracts` | CRUD, státuszváltás, dokumentum csatolás |
| `crm_communications.py` | `/crm/communications` | CRUD, ügyfél szerinti timeline lekérdezés |
| `crm_tasks.py` | `/crm/tasks` | CRUD, lezárás, határidő módosítás |
| `crm_documents.py` | `/crm/documents` | upload/presign download/delete/link (polimorfikus, l. 2.10) |
| `crm_dashboard.py` | `/crm/dashboard` | 6.10 riportok (l. 6. pont) |

### 4.1 Üzleti szabályok → validáció

- **Magánszemély minimál-adat**: `crm_customers.py` create/update
  végpontjában, ha `type == PERSON`, minden más személyes mező (`phone`,
  `email`, `tax_number`, `billing_address`) `None`-ra kényszerítve/eldobva,
  nem csak figyelmen kívül hagyva — 422 hibával, ha a kliens mégis küld
  ilyet, hogy a UI ne tudja véletlenül becsempészni. Ugyanez a szabály
  érvényesítendő az importnál is (l. 10. pont), soronként.
- **Nem törölhető, ha kapcsolódó rekord létezik**: `DELETE
  /crm/customers/{id}` csak akkor engedélyezett, ha nincs kapcsolódó lead/
  opportunity/quote/contract/communication/task — egyébként 409, és a
  frontend az "archiválás" opciót ajánlja fel helyette (mint a meglévő
  `is_active`/archiválás minta a `User`-nél és `Activity.is_archived`-nál).
- **Azonos nevű ügyfél figyelmeztetés**: create végpont soft-warningot ad
  vissza (nem blokkol), ha van már ugyanolyan `name` — a frontend egy
  megerősítő dialógust mutat (`AlertDialog`, mint a delete-confirmationök).
- **Lead → Szerződött automatikus projekt** (l. 4.3 lentebb).
- **Elfogadott ajánlatból szerződés**: `create-contract` csak
  `QuoteStatus.ACCEPTED` esetén engedélyezett.
- **Szerződés lejárat figyelés**: a napi digest jobban új napi ellenőrzés
  (pl. 30/7 napos küszöb, mint a `UPCOMING_PREP` mintája).

### 4.2 Rekordszintű jogosultság (RBAC)

`services/scoping.py`-ba új `scoped_customer_query(db, user)`: `owner_id ==
user.id` szűrés mindenkire, kivéve ha `user.role in (ADMIN, MANAGEMENT)` —
pontosan a meglévő `scoped_activity_query` logikája, csak `owner_id`-n. Ezt
minden CRM entitás listázó/kereső végpontja használja (opportunity/quote/
contract owner-chain-en át, azaz a customer ownerén keresztül, mint a
`_can_edit_project` mintája a `documents.py`-ban).

### 4.3 Automatikus projektlétrehozás (Lead → Szerződött)

A `crm_leads.py` `PATCH /crm/leads/{id}/status` végpontja, amikor
`status` `WON`-ra vált:

1. Ha a Leadhez már van `customer_id`, a Customer adatait (`name`,
   `phone`, `email` ha van) átmásolja a leendő `Project.client_*` mezőibe,
   **és beállítja `Project.customer_id`-t is** a Customer-re (l. 2.2.1,
   0/6. döntés).
2. Meghívja a meglévő projekt-létrehozási logikát (a `NewProjectDialog`
   wizard mögötti `POST /projects` handlert, `backend/app/api/projects.py`),
   ami a meglévő `schedule_engine`-en keresztül generálja a 24+ alap
   tevékenységet.
3. A létrejött `project_id`-t visszaírja a Lead-re (`Lead.project_id`), hogy
   a CRM oldalról is elérhető legyen a projekt.

Ez a legkritikusabb integrációs pont a két modul között — élesben tesztelendő
(Playwright), nem csak unit teszttel, mert a meglévő projekt-létrehozás
oldalági hatásai (schedule engine, notification-ok) is lefutnak.

## 5. Frontend

Új route-csoport `frontend/src/app/crm/` alatt, a meglévő oldalstruktúra
mintáját követve (`page.tsx` lista + `[id]/page.tsx` részletnézet, mint a
`projects/[id]/page.tsx` 7 tabos mintája):

- `crm/customers/page.tsx` — lista (Table, szűrők a 9. pont mezői szerint,
  keresősáv, export/import gombok — l. 10. pont), `crm/customers/[id]/page.tsx`
  — tabok: Áttekintés / Kapcsolatok / Leadek+Opportunity-k / Ajánlatok /
  Szerződések / Kommunikáció / Feladatok / Dokumentumok / Napló (audit).
- `crm/leads/page.tsx` — Kanban-szerű nézet a `LeadStatus` oszlopokkal
  (újrahasznosítva a meglévő kanban board komponens mintáját a
  `kanban/page.tsx`-ből, más adatforrással).
- `crm/opportunities/page.tsx` — egyszerű lista/Table, OPEN/WON/LOST
  Badge-ekkel (nincs többlépcsős pipeline-vizualizáció, l. 0/3. döntés).
- `crm/quotes/page.tsx` — Ajánlat lista + részletnézetben natívan renderelt,
  verziózott tartalom (táblázat-komponens `content_json`-ból, `@media print`
  stíluslappal a böngésző natív nyomtatás/PDF-mentéséhez).
- `crm/contracts/page.tsx` — Table nézet státuszjelző Badge-ekkel (mint a
  meglévő `--status-*` design tokenek mintája, CRM-specifikus token-
  készlettel kiegészítve `globals.css`-ben).
- `crm/dashboard/page.tsx` — a 6.10 riportok, a meglévő dashboard widget
  drag-and-drop mintájának (`@dnd-kit`) újrahasznosításával, saját
  `localStorage` kulccsal (`planora_crm_dashboard_widget_order`).
- `AppLayout.tsx` sidebar: új "Ügyfélkapcsolatok (CRM)" szekció,
  szerepkör-gated a 10.1 mapping szerint (PROJECT_MANAGER/SITE_MANAGER/
  BILLING/MANAGEMENT/ADMIN — PROCUREMENT/SUBCONTRACTOR nem lát CRM menüt).
- Ctrl+K keresőpaletta (`AppLayout`): a meglévő `GET /search` kliens
  bővítve CRM találattípusokkal (ügyfél/opportunity/szerződés ikon+link).

## 6. Dashboard / riportok (6.10)

Bővítés `crm_dashboard.py`-ban, a meglévő `dashboard.py`
(`DashboardStats`) mintájára, külön `CrmDashboardStats` schema:

- **Értékesítési**: aktív (`OPEN`) opportunity-k száma, pipeline érték
  (`SUM(estimated_value)` OPEN-eken), megnyert/elvesztett üzletek
  (`Opportunity.phase == WON/LOST`), konverziós arány (WON / (WON+LOST)).
- **Ügyfél**: új/aktív/inaktív ügyfelek száma, típus szerinti eloszlás.
- **Operációs**: nyitott CrmTask-ok, lejáró szerződések (30 napon belül),
  függő (SENT/APPROVAL_PENDING) ajánlatok.

## 7. Audit napló (8. pont)

Nincs új tábla — minden CRM create/update/delete/státuszváltás/jóváhagyás/
dokumentum-feltöltés a meglévő `AuditLog` sorba kerül (`entity_type` az adott
modellnév kisbetűvel). A `crm/customers/[id]/page.tsx` "Napló" tabja a
meglévő `/audit-log` oldal szűrt nézete (mint a projekt-adatlap saját Napló
tabja a V2 refaktorból).

## 8. Nem funkcionális követelmények (9. pont) leképezése

- **HTTPS, backup, verziókezelés**: már megoldott infrastruktúra szinten
  (nginx self-signed TLS, `postgres-backup`, MinIO bucket versioning) — a
  CRM táblák/S3-objektumok automatikusan lefedettek, nincs teendő.
- **Teljesítmény** (keresés ≤2s, lista ≤3s, dokumentum előnézet ≤5s): nem
  API-szerződés, hanem UX-célszám — Playwright-tesztben mérhető, de nem
  automatikusan validálható szigorú assertionnel; élő ellenőrzésnél szúrópróba
  jelleggel mérendő.
- **Reszponzivitás**: a meglévő mobile-pass mintája (fixed-width elemek
  kerülése, `overflow-x-auto` a táblázatokon) alkalmazandó minden új CRM
  Table-re elsőre, nem utólagos javításként.

## 9. Keresési/szűrési mezők (10. pont)

Már beépítve az 5. pont Table szűrőibe és a `GET /crm/customers` stb.
query paramétereibe — a BRS 10. pontban felsorolt mezők szerint (Név/Ügyfél
típus/Státusz/Felelős ügyintéző/Létrehozás dátuma ügyfélnél; Ügyfél/Fázis/
Felelős/Dátumtartomány opportunity-nél; Ügyfél/Szerződés száma/Lejárati
idő/Státusz szerződésnél).

## 10. Ügyfél export/import (kiegészítés a BRS-hez)

Nem szerepelt az eredeti BRS-ben, most felvett igény.

- **Formátum**: CSV — nincs miatta új backend-függőség (a Python `csv`
  standard library elég), ugyanaz az egyszerűség-elv, mint a PDF-generálás
  elvetésénél (0/4. döntés). Ha később táblázatkezelőben szerkesztendő
  export is kell, XLSX (`openpyxl`) külön kérésre bővíthető.
- **Export**: `GET /crm/customers/export` — a `scoped_customer_query`
  aktuális szűrésével/láthatóságával megegyező sorokat ad vissza CSV-ben
  (ugyanazok a mezők, mint a lista nézet + `customer_number`). Bármely CRM-
  hozzáféréssel rendelkező szerepkör használhatja a saját láthatósága
  szerint.
- **Import**: `POST /crm/customers/import` — CSV feltöltés
  (`UploadFile`, a meglévő dokumentum-upload minta szerinti multipart
  kezelés), soronkénti feldolgozás:
  - minden sorra lefut a 4.1 üzleti szabály-validáció (kötelező mezők,
    magánszemély minimál-adat, azonos név → warning, nem hard-block),
  - a válasz soronkénti eredmény-riport (sikeres/hibás sor + hibaüzenet),
    nem all-or-nothing tranzakció — egy hibás sor nem akasztja meg a többit,
  - **jogosultság**: csak `ADMIN`/`MANAGEMENT` (tömeges adatbevitel magasabb
    kockázatú művelet, eltérően a sima create-től).
- **Frontend**: `crm/customers/page.tsx` fejlécében "Export"/"Import" gomb
  (Import csak admin/vezető nézetben látszik), import után a soronkénti
  riport `AlertDialog`-ban vagy egy dedikált eredmény-táblázatban jelenik
  meg (nem egyetlen toast — sok sor esetén az elveszne).

## 11. Jogosultságkezelés (7. pont)

### 11.1 Szerepkör-mapping (jóváhagyott — nincs új enum-érték)

| BRS szerepkör | PLANora `UserRole` (meglévő) | Indoklás |
|---|---|---|
| Adminisztrátor | `ADMIN` | teljes jog, változatlan |
| Vezető | `MANAGEMENT` | riport/jóváhagyás jogkör megegyezik |
| Értékesítő | `PROJECT_MANAGER` | lead/opportunity/quote "tulajdonosa"; a Szerződött lead nyomán ő lesz a leendő projekt PM-je is — organikus folytonosság a CRM és az építési oldal között |
| Ügyintéző | `SITE_MANAGER` | napi szintű feladat/kommunikáció/dokumentum-kezelés, párhuzamos a site manager napi operatív szerepével az építés oldalán |
| Operáció | `BILLING` | szerződés + adminisztráció — pénzügyi/adminisztratív jellegű, közelebb a billinghez, mint a beszerzéshez |
| (nincs BRS megfelelő) | `PROCUREMENT`, `SUBCONTRACTOR` | nem kapnak CRM sidebar-hozzáférést, csak az építőipari oldalon aktívak maradnak |

### 11.2 Jogosultsági mátrix (Megtekintés/Létrehozás/Módosítás/Törlés/Export/Import/Jóváhagyás)

| Szerepkör | Megtekintés | Létrehozás | Módosítás | Törlés | Export | Import | Jóváhagyás |
|---|---|---|---|---|---|---|---|
| ADMIN | mind | mind | mind | mind | igen | igen | igen |
| MANAGEMENT | mind | mind | mind | — | igen | igen | igen (ajánlat) |
| PROJECT_MANAGER (Értékesítő) | saját | lead/opp/quote | saját | — | saját | — | — |
| SITE_MANAGER (Ügyintéző) | saját | task/comm/doc | saját | — | saját | — | — |
| BILLING (Operáció) | szerződések | szerződés | szerződés | — | — | — | — |

(A "Törlés" oszlop tudatosan üres a legtöbb szerepkörnél — a rendszer
mindenhol soft-delete/archiválás mintát követ, valós DELETE csak
adminnak és csak akkor, ha nincs kapcsolódó rekord, l. 4.1.)

## 12. Elfogadási kritériumok (11. pont — mérhetővé alakítva)

Minden BRS-kritérium egy Playwright-live-teszt lépésre fordítva a végső
verifikációs körben (a meglévő minta: `tsc`/`eslint`/`vitest`/`pytest` helyi
futtatás → `docker compose up --build` → élő Playwright pass, console-error
capture-rel):

- [ ] Magánszemély és céges ügyfél létrehozható, típusfüggő mezőkorlátozással.
- [ ] `CustomerRelation` létrehozható két ügyfél között.
- [ ] Ajánlat készíthető, natívan verziózható, státusza követhető.
- [ ] Elfogadott ajánlatból szerződés hozható létre.
- [ ] Kommunikációs esemény rögzíthető, timeline-on megjelenik.
- [ ] CrmTask létrehozható, lezárható, emlékeztető a digestben megjelenik.
- [ ] CrmDocument feltölthető és több rekordhoz is kapcsolható.
- [ ] CRM dashboard megjeleníti a 6.10 KPI-okat.
- [ ] Ügyfél export CSV-t ad vissza a láthatóság szerint; import soronkénti
      riporttal validál (jó és hibás sor is helyesen kezelve).
- [ ] RBAC mátrix élőben igazolt minden meglévő szerepkörre az új CRM
      mappingben.
- [ ] Audit napló rögzíti a CRM-műveleteket, megjelenik a Napló tabon.
- [ ] Lead "Szerződött" váltás élőben létrehozza a projektet és beállítja a
      `Project.customer_id`-t, hibamentesen.

## 13. Javasolt fejlesztési fázisok

A meglévő V2-refaktor mintáját követve (l. projekt-memória), egy folytonos,
fázisokra bontott munkamenetben végrehajtható, minden fázis végén helyi +
Docker + Playwright ellenőrzéssel:

- **Fázis 0** — adatmodell, migráció (`Project.customer_id`-t is beleértve),
  `scoped_customer_query`.
- **Fázis 1** — Ügyfélkezelés (6.1) végponttól UI-ig, `CustomerRelation`
  (6.2 pótlás), export/import (10. pont).
- **Fázis 2** — Lead (6.3) + Opportunity (6.4), automatikus
  projektlétrehozás (4.3) élő teszttel.
- **Fázis 3** — Ajánlat (6.5, natív verziózott nézet) + Szerződés (6.6,
  lejárat-figyelés a digestbe kötve).
- **Fázis 4** — Kommunikáció (6.7) + Feladat (6.8) + polimorfikus
  Dokumentum (6.9).
- **Fázis 5** — Dashboard/riportok (6.10), keresés-integráció, audit UI,
  mobil reszponzív pass, teljes RBAC-mátrix élő ellenőrzés.

## 14. Összefoglalás

A terv a meglévő PLANora mintákra épül (RBAC, audit, S3-dokumentum,
notification-digest, scoped-query) új párhuzamos struktúra helyett, ahol ez
értelmes — kivéve ahol a BRS explicit eltérő viselkedést kér (polimorfikus
`CrmDocument`, külön `CrmTask` a névütközés miatt). Nincs új `UserRole`
enum-érték, nincs backend PDF-generálás, az Opportunity-fázis egyszerűsítve
lett a tényleges BRS-folyamathoz igazodva, és a `Project`↔`Customer` kapcsolat
egy additív, nem romboló FK-val valósul meg. Minden korábbi nyitott kérdés
lezárva (0. pont) — a terv Fázis 0-tól kezdve végrehajtható.
