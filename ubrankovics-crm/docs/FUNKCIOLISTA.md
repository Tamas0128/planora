# Ubrankovics CRM — funkciólista és funkcionális teszt eredménye

Első verzió: 2026-11-20. Frissítve: 2026-11-20 (ügyfél/alvállalkozó/személy kártya javítás + 5 új modul: Dokumentumkezelés, Feladatok, Riportok, Dashboard, Ctrl+K keresés).
Branch: `feature/ubrankovics-crm`
Teszt módszer: backend pytest teljes futtatás (60 teszt) + élő böngészős bejárás (http://localhost:3101) minden modulon keresztül, valós adatbeviteli és módosítási műveletekkel.

## Összefoglaló

- **Backend automata tesztek:** 60/60 zöld (`docker compose run --rm backend pytest -q`).
- **Élő funkcionális teszt:** minden alábbi modult sikerrel végigjártam (új rekord létrehozás, szerkesztés, státuszváltás, fájl-/levélküldés, Ctrl+K keresés), hibát nem találtam.
- Korábban talált és már javított hibák: az ügyfél-, alvállalkozó- és személy-kártya üres volt (csak egy szerkesztő űrlap, a kapcsolódó projektek/tételek/TIG/számlák nem látszottak) — mindhárom entitás kapott egy valódi, kapcsolódó adatokat mutató kártyát.
- A teszt során keletkezett próba-adatok (pl. "Teszt Ügyfél Kft.", "Funkcióteszt projekt") a fejlesztői adatbázisban maradtak — szólj, ha töröljem őket.

---

## 1. Hitelesítés és felhasználókezelés — KÉSZ

- Bejelentkezés JWT access+refresh tokennel, automatikus token-frissítés 401 esetén.
- Felhasználók lista, új felhasználó létrehozása, szerepkör váltása, jelszó reset, aktiválás/letiltás.
- Szerepkörök: Admin, Értékesítés, Kivitelezés, Beszerzés, Pénzügy, Vezetés.

## 2. Ügyfelek — KÉSZ

- Lista, új ügyfél felvétele, részletező szerkesztéssel és törléssel.
- **Ügyfélkártya "Projektek" szekció**: az összes kapcsolódó projekt (építési cím, szerep, állapot-jelvény, kattintható link) — korábban ez hiányzott, most javítva.

## 3. Projektek — KÉSZ

- Lista, új projekt létrehozása épülettípus-sablon választással (automatikus tétel-generálás a sablonból, típusspecifikus tételekkel együtt).
- Egy projekthez több ügyfél és építési cím rendelhető.
- Szerepek (építésvezető, projektfelelős, műszaki ellenőr, építész tervező, gyártástervező) személyekhez rendelése.

### 3.1 Tételek fül — KÉSZ

- A ~45 elemes munkanem-törzsből tétel hozzáadása a projekthez.
- Tétel-részletező: szakasz (Ajánlat → Szerződés → Beszerzés → Kivitelezés → Kész), vállalások (saját / alvállalkozó / ügyfél / nincs), esemény-idővonal, szabad kulcs-érték specifikáció.
- **Teljes beszerzési (RFQ/PO) folyamat** tételenként: beszerzési igény → ajánlatkérés → legfeljebb 2 beszállítói ajánlat → ajánlat kiválasztása → PO jóváhagyás → szállítás/átvétel rögzítése → beszerzési számla (állapot, összeg, fizetési határidő, fizetés dátuma); az ügyfélnek kiajánlott ár (nettó/áfa/bruttó) ettől teljesen független mezőkben.
- ÁFA alapértelmezés: beszállító felé fordított áfás, ügyfél felé 0%, mindkettő szabadon átállítható.
- Dokumentum/levél küldés: tétel(ek) kijelölése, sablon választás, élő előnézet, e-mail küldés (élőben tesztelve, Mailpitbe megérkezik).

### 3.2 Ütemezés fül (opcionális, `utemezes_aktiv` kapcsolóval) — KÉSZ

- Épülettípus-sablon alapján automatikus tétel + ütemezési függőség generálás új projekt létrehozásakor.
- Átadási határidőből visszafelé számolt ütemezés ("Újraütemezés" gomb).
- Felelős szerepkör és kijelölt személy hozzárendelése tételenként.
- Drag-and-drop sorrend-módosítás, tételek közti függőségek, Gantt PDF export, készültség % számítás.

### 3.3 Fázisok fül — KÉSZ

- Épülettípushoz tartozó fázis/lépés sablon (55 lépés, 9 fázisban) másolása a projektbe, pipálható checklistként.

### 3.4 Dokumentumok fül — KÉSZ (újonnan megépítve)

- Valódi fájlfeltöltés (pdf, doc(x), xls(x), jpg, png, dwg, zip, txt, max 25 MB) helyi lemezes tárba (named Docker volume, nincs S3/MinIO infrastruktúra ehhez az apphoz).
- Lista, letöltés (eredeti fájlnévvel, ékezetes karakterekkel is), törlés, típus/megjegyzés.

## 4. Feladatok (`/feladatok`) — KÉSZ (újonnan megépítve)

- Saját/csapat feladatlista: cím, leírás, határidő, felelős (bármely aktív felhasználó), opcionális projekt-kapcsolat, kész jelölő.
- "Csak az enyém" és "Kész feladatok is" szűrő, lejárt határidő piros kiemeléssel.

## 5. Pénzügy (`/penzugy`) — KÉSZ

- **Szerződések**: ügyfél, szám, összeg, áfa, kezdés/befejezés, állapot + ütemezett részletek.
- Egy ütemezett részletből valódi ügyfélszámla kiállítása egy gombbal — a tétel automatikusan átkerül a "tervezett" rétegből a "tényleges" rétegbe a cash-flow előrejelzésben.
- **TIG** (teljesítésigazolás) rögzítése alvállalkozóhoz, alvállalkozói számla a TIG-hez kötve.
- **Alvállalkozói és ügyfél számlák**: hátralék-számítás, egy kattintásos "Kifizetve" jelölés.
- **Tervezett bérköltség**: cégszintű, havi bontású rögzítés.
- **Bankegyenleg-pillanatkép** rögzítése.
- **Gördülő cash-flow előrejelzés**: hét/hónap bucket, konfigurálható horizont, projekt- vagy cégszintű nézet, tényleges vs. tervezett réteg, nyitó/záró egyenleg lánc, negatív záróegyenleg figyelmeztetés, drill-down.

## 6. Riportok (`/riportok`) — KÉSZ (újonnan megépítve)

- **Értékesítési állapot**: tételek megoszlása szakaszonként (db + ügyfélnek kiajánlott érték összege), sáv-diagram stílusban.
- **Pénzügyi összesítő**: lejárt (esedékesség elmúlt, ki nem fizetett) ügyfél- és alvállalkozói számlák listája + összesítve, legutóbbi bankegyenleg.

## 7. Dashboard / Kezdőlap (`/`) — KÉSZ (újonnan megépítve)

- Bejelentkezés után ide navigál az app (korábban egyenesen az Ügyfelek listára ugrott).
- Projektek száma + állapot szerinti megoszlás, nyitott saját feladatok száma + közelgő lista (lejárt kiemelve), lejárt bevétel/kiadás összesen, likviditási kockázat banner a folyó hét cash-flow egyenlegéből.

## 8. Ctrl+K globális keresés — KÉSZ (újonnan megépítve)

- `Ctrl+K`/`Cmd+K` bárhol megnyitja a keresőablakot (vagy a "Keresés" gomb az oldalsávban).
- Ügyfelek, projektek, alvállalkozók, személyek nevére keres egyszerre, csoportosított találati listával, nyíl billentyűs navigációval és Enterrel a megnyitáshoz.

## 9. Törzsadatok — KÉSZ

- Munkanemek (~45 elem, csoportokba rendezve, induláskor seedelve).
- Legördülő listák (pl. gyártó, szín — típus+érték párként).
- **Alvállalkozók** — most már saját kártyával: melyik tételeken vállalóként szerepel (projekt + munkanem + szakasz), teljesítésigazolásai (TIG), alvállalkozói számlái (hátralékkal).
- **Személyek** — saját kártyával: milyen projekt-szerepeket tölt be, melyik tételekre van kijelölve.

## Amit a projekt korai terve még tartalmazott, de jelenleg nincs megépítve

Jelenleg nincs ismert hiányosság a funkciólistához képest — az előző kör óta azonosított összes hiányzó modul (Dokumentumkezelés, Feladatok, Riportok, Dashboard, Ctrl+K keresés) elkészült.

## Backend API-felszín

Minden fenti funkcióhoz tartozó végpont regisztrálva és elérhető, beleértve az újakat is: `dokumentumok` (upload/letöltés/törlés), `feladatok`, `riportok/ertekesitesi-allapot`, `riportok/penzugyi-osszesito`, `kereses`, `ugyfelek/{id}/projektek`, `alvallalkozok/{id}/{tetelek,tig,szamlak}`, `szemelyek/{id}/{szerepek,tetelek}` — a korábbi lista (`auth`, `ugyfelek`, `projektek` + al-erőforrásai, `munkanemek`, `torzsadatok`, `berkoltsegek`, `cashflow/*`) mellett.

---

## 10. CRM-bővítés (2026-11-23) — KÉSZ

Forrás: a "PLANora CRM funkciók gyűjtése" dokumentum hiánylistája; sorrend: lead+pipeline → kommunikációs napló → értesítések → import/export. Backend: 76/76 pytest zöld (16 új teszt: `tests/test_crm_funkciok.py`); élő böngészős próba a futó stacken.

- **Érdeklődők + pipeline (`/erdeklodok`)**: lead felvétele (név, telefon, e-mail, forrás, becsült érték, felelős), kanban nézet 6 szakasszal (Új → Kapcsolatfelvétel → Ajánlat → Tárgyalás → Nyert / Elveszett), léptetés húzással vagy legördülővel, oszloponként darabszám és érték. "Ügyféllé alakítás": Ügyfél jön létre, a lead "nyert" lesz, a kommunikációs napló átkerül.
- **Kommunikációs napló**: hívás / e-mail / találkozó / megjegyzés időrendben, szerzővel; az ügyfélkártyán és az érdeklődő kártyán is.
- **Értesítések**: oldalsáv "Értesítések" gomb számlálóval (percenként frissül) — a saját lejárt és 2 napon belüli feladatok; pénzügyi szerepkörnek (és adminnak) a lejárt ügyfél- és alvállalkozói számlák. Élőben számolt, nincs külön tábla; e-mailes emlékeztető nincs.
- **Import/export**: ügyféllista export CSV-be (BOM-mal, `;` elválasztó) és Excelbe; import .csv/.xlsx fájlból (oszlopok: nev, telefon, email) duplikátum-kihagyással és hibás sorok jelzésével.
- **Duplikátum-keresés és egyesítés**: azonos név / azonos e-mail csoportok; egyesítéskor a projektek, napló és érdeklődők átkerülnek, a hiányzó elérhetőség átvétele után a forrás ügyfél törlődik.

Még nincs: marketing/szegmentálás, ügyfélszolgálati jegyek, előrejelzés, egyedi mezők, auditnapló, e-mailes értesítés, Playwright e2e a fenti modulokra.
