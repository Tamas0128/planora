# PLANora — Építőipari Projektütemező Rendszer

Funkcionális és Technikai Specifikáció v1.0

## 1. Projekt célja

A PLANora egy webalapú építőipari projektütemező rendszer, amely könnyűszerkezetes családi házak kivitelezésének teljes életciklusát támogatja.

**Fő célok:**

- Projektek nyilvántartása
- Kivitelezési ütemezés kezelése
- Automatikus visszafelé tervezés az átadási határidőből
- Előkészítési feladatok nyomon követése
- Felelősök és szerepkörök kezelése
- Határidők és csúszások követése
- Dokumentumok tárolása
- Auditálhatóság biztosítása

## 2. Projekt adatok

### Alapadatok

- Projekt neve, azonosító, település, cím, helyrajzi szám (opcionális)

### Ügyfél adatok

- Név, telefon, e-mail (létrehozáskor vagy később módosítható)

### Épület adatok

- Épülettípus: Könnyűszerkezetes, CLT, Gerendaház, Egyéb
- Alapterület (nettó m²)

### Projekt szereplők

- Projektmenedzser, építésvezető, beszerzés, számlázás, alvállalkozók

## 3. Projekt státuszok (Kanban)

1. Tervezés alatt
2. Alapozás
3. Szerkezetállítás
4. Kívülről kész
5. Kulcsrakész

## 4. Projektkártya

- Projekt neve, település, ügyfél neve, épülettípus, alapterület
- Projektmenedzser, építésvezető, átadási határidő, státusz, készültségi százalék

## 5. Projekt adatlap

Szerkesztő ablak: alapadatok, ügyfél, résztvevők, dokumentumok (tervrajzok, szerződések, számlák, fotók).

## 6. Ütemterv rendszer

Minden feladat: név, futási idő, kezdési/befejezési dátum, előkészítési dátum, előfeltételek, felelős szerepkör, státusz.

### Alapértelmezett tevékenységek (25 db)

| Tevékenység | Nap |
|-------------|-----|
| Terület rendezése | 2 |
| Fogadószint építése | 15 |
| Daruzás | 5 |
| Bádogos munkák | 3 |
| Tetőfedés | 6 |
| Kémény szerelés | 3 |
| Külső nyílászárók | 5 |
| Villanyszerelési alapszerelés | 5 |
| Gépészeti alapszerelés | 5 |
| Padlószigetelés | 7 |
| Padlófűtés szerelés | 4 |
| Nyomáspróba | 2 |
| Estrich készítés | 2 |
| Falak kifújása | 2 |
| Gipszkartonozás | 4 |
| Vakolás/Glettelés | 3 |
| Festés | 1 |
| Gépészeti szerelések | 4 |
| Villanyszerelések | 2 |
| Burkolás | 5 |
| Végfestés | 1 |
| Terasz építés | 5 |
| Épület szigetelés | 3 |
| Épület színezés | 8 |

## 7. Visszafelé tervező motor

Az átadási dátumból számít vissza minden tevékenység kezdetét, végét és előkészítési időpontját. Figyelembe veszi: futási idők, függőségek, munkanapok.

## 8. Függőségek

Tevékenységenként megadható előfeltétel(ek). PM, Admin, Menedzsment módosíthatja → automatikus újraszámolás.

Példa: Kémény szerelés → előfeltételek: Bádogos munkák, Tetőfedés.

## 9. Előkészítési dátumok

Alapértelmezett: 14 nap tevékenység kezdete előtt. Tevékenységenként módosítható.

## 10. Előkészítési központ

Külön menüpont. Szűrők: lejárt, mai, 7 napon belüli, 14 napon belüli.

## 11. Saját feladatok

Felhasználó csak a saját szerepköréhez tartozó feladatokat látja.

## 12. Jogosultsági rendszer

| Szerepkör | Jogok |
|-----------|-------|
| Admin | Teljes hozzáférés, felhasználók, paraméterek, audit |
| Projektmenedzser | Saját projektek, dátum/futás/függőség módosítás |
| Menedzsment | Minden projekt, riportok, teljes szerkesztés |
| Beszerzés | Saját + előkészítési feladatok |
| Számlázás | Saját feladatok |

## 13. Dokumentumtár

PDF, DWG, XLSX, DOCX, JPG, PNG — verziózott tárolás.

## 14. Audit napló

Felhasználó, időpont, projekt, módosított mező, régi/új érték.

## 15. Értesítések

- Dashboard: lejárt feladatok, közelgő előkészítések, csúszó projektek
- E-mail: napi automatikus (7 nap feladatai, lejárt előkészítések)

## 16. Technikai architektúra

- **Frontend:** Next.js, TypeScript, Tailwind CSS, ShadCN UI
- **Backend:** Python 3.13, FastAPI, SQLAlchemy, Alembic
- **Adatbázis:** PostgreSQL
- **Fájltároló:** S3-kompatibilis
- **Biztonság:** bcrypt, JWT, refresh token, 8 órás session, HTTPS
- **Proxy:** Nginx
- **Konténer:** Docker Compose

## 17. Mentés

- PostgreSQL: napi snapshot 00:30, 30 napi / 12 heti / 12 havi megőrzés
- S3: napi snapshot 01:00, verziókezelés kötelező
