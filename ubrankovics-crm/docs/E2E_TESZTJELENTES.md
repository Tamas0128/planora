# Ubrankovics CRM — teljes end-to-end tesztjelentés (Playwright)

Dátum: 2026-11-20
Branch: `feature/ubrankovics-crm`
Eszköz: [Playwright](https://playwright.dev) (`@playwright/test` + `@axe-core/playwright`), Chromium, az élő dev stack ellen (`http://localhost:3101`, `docker compose up`).
Teszt forrás: `ubrankovics-crm/frontend/e2e/` — 14 spec fájl, 56 teszteset.

## Összefoglaló

| | |
|---|---|
| Funkcionális tesztek | **38/38 PASS** |
| Nem-funkcionális tesztek | **8/18 PASS**, 10 valódi, reprodukálható hiba |
| Összesen | 46/56 PASS |
| Képernyőkép | 33 db, `e2e/screenshots/` (csatolva, `screenshots.zip`) |
| Részletes HTML riport | `frontend/playwright-report/index.html` (`npm run test:e2e:report`-tal nyitható) |

A funkcionális rész **tiszta** — minden modul, amit korábbi meneteken kézzel bejártam, most automatizált tesztként is lefut és zöld. A nem-funkcionális rész **valódi hibákat talált**: ezeket lent részletezem, bizonyító képernyőképpel.

---

## 1. Funkcionális tesztek (38/38 PASS)

| Spec | Lefedettség |
|---|---|
| `01-auth.spec.ts` | Bejelentkezés siker/hiba, nem bejelentkezett → /login redirect, kijelentkezés, token túléli a frissítést |
| `02-ugyfelek.spec.ts` | Lista, létrehozás, szerkesztés, **"Projektek" kártya-szekció** (korábbi hiba), törlés |
| `03-projektek.spec.ts` | Lista, épülettípus-sablonos létrehozás (auto tétel-generálás), fül-váltás (Ütemezés/Fázisok/Dokumentumok) |
| `04-beszerzes.spec.ts` | Tétel-részletező (vállalás/esemény/specifikáció), teljes RFQ/PO folyamat: beszerzési igény → ajánlatkérés → ajánlat → kiválasztás → ügyfél ár |
| `05-utemezes.spec.ts` | Átadási határidő, újraütemezés, felelős/kijelölt hozzárendelés, Gantt PDF letöltés |
| `06-dokumentumok.spec.ts` | Fájlfeltöltés, letöltés (eredeti névvel), törlés, nem engedélyezett fájltípus elutasítása (400) |
| `07-penzugy.spec.ts` | Cash-flow hét/hónap váltás + drill-down, bankegyenleg rögzítés, szerződés+részlet+számla-kiállítás, TIG rögzítés |
| `08-feladatok.spec.ts` | Létrehozás, kész-jelölés, szűrők, lejárt határidő kiemelés |
| `09-riportok.spec.ts` | Értékesítési állapot + pénzügyi összesítő megjelenése |
| `10-dashboard.spec.ts` | Widgetek, navigáció, aktív nav-elem jelzés |
| `11-kereses.spec.ts` | Ctrl+K megnyitás, keresés, Enter-navigáció, Escape, "nincs találat" |
| `12-torzsadatok.spec.ts` | Munkanemek, **alvállalkozó- és személy-kártya** (korábbi hiba) |
| `13-felhasznalok.spec.ts` | Szerepkör-váltás, **RBAC-ellenőrzés külön böngésző-kontextusban**: korlátozott jogú felhasználó ténylegesen nem éri el a /felhasznalok felületet |

---

## 2. Nem-funkcionális tesztek — talált hibák

### 2.1 Akadálymentesség (axe-core, WCAG 2 AA) — ❌ 7/7 oldal elbukik

Minden vizsgált oldalon (`/`, `/ugyfelek`, `/projektek`, `/feladatok`, `/penzugy`, `/riportok`, `/torzsadatok`) **ugyanaz** a `serious` súlyosságú hiba:

> **Elégtelen szövegkontraszt** a `--muted` design-tokenen: előtér `#8a7d61`, háttér `#efe8d8` → kontrasztarány **3.31:1**, a WCAG AA 12px normál szövegnél **4.5:1**-et ír elő.

Ez egyetlen, mindenhol újrafelhasznált CSS-token (`var(--muted)`) hibája — minden halvány, szürkés-barna feliratot érint (pl. Törzsadatok kategória-címkék, "Betöltés…" szövegek, dátumok, "Mind megnyitása" linkek). Mivel egy közös tokenről van szó, **egy helyen javítva mindenhol javul**.

A `/penzugy` oldalon ezen felül 2 további, kisebb súlyosságú hiba is felmerült (`empty-table-header`: a táblázat egy oszlopfejléce üres — ez a Pénzügy táblázat egyik "csak ikon" oszlopa; `label`: egy input mezőhöz nincs programozottan társított label).

**Külön, a teszt írása közben talált, de axe-color-contrast-tól független finding**: a bejelentkezési oldal "Felhasználónév" / "Jelszó" feliratai `<label>` elemek, de **nincs `htmlFor`/`id` összerendelve** az input mezőkkel — képernyőolvasó nem tudja automatikusan a mezőhöz kötni a feliratot (csak vizuálisan vannak egymás mellett). Emiatt a Playwright-tesztben is pozíció szerint (nem `getByLabel`) kellett hivatkozni rájuk.

### 2.2 Reszponzivitás / mobil nézet — ❌ 3/5 oldal túlcsordul, + egy általánosabb UX-probléma

| Oldal | scrollWidth | clientWidth (412px-es mobil) | Eredmény |
|---|---|---|---|
| `/` (Kezdőlap) | 412 | 412 | OK |
| `/feladatok` | 412 | 412 | OK |
| `/ugyfelek` | 415 | 412 | **túlcsordul** (enyhe) |
| `/projektek` | 467 | 412 | **túlcsordul** |
| `/penzugy` | 616 | 412 | **túlcsordul** (jelentős) |

A mellékelt képernyőkép (`screenshots.zip` → mobil nézet) szerint a **tényleges gyökérprobléma ennél általánosabb**: az oldalsáv (sidebar) **fix szélességű és nem csukható össze/nem hamburger-menüs** mobil nézetben — a 412px-es képernyő majdnem felét permanensen elfoglalja, a maradék ~250px-es tartalmi területen a táblázatok (Ügyfelek, Projektek lista, és különösen a Pénzügy cash-flow táblázat sok oszloppal) emiatt oldalra kicsúsznak. A Kezdőlap és a Feladatok oldal csak azért "ok", mert kártyás elrendezésűek, nem táblázatosak — vagyis a mobil-élmény összességében nem kész, nem csak ez az 5 konkrét oldal.

### 2.3 Teljesítmény (puha küszöbök) — ✅ PASS

| Oldal | Betöltési idő (networkidle) |
|---|---|
| `/` | 1092 ms |
| `/projektek` | 1272 ms |
| `/penzugy` | 1174 ms |

Mind jóval a 8 másodperces (nagyvonalú, dev-build helyi szerverre szabott) küszöb alatt.

### 2.4 Hibakezelés — ✅ PASS

- Nem létező projekt-azonosítóra navigálva (`/projektek/999999`) az alkalmazás **nem omlik össze** — érthető hibaszöveget mutat, kliens oldali JS-kivétel nincs.
- Nem létező útvonal (`/ez-nem-letezik-sehol`) helyesen **404**-et ad.

### 2.5 Biztonság-jellegű ellenőrzések — ✅ PASS

- Be nem jelentkezett felhasználó minden védett oldalról `/login`-ra kerül.
- A jelszó soha nem kerül a `localStorage`-ba (csak a JWT tokenek).
- **RBAC valódi böngésző-munkamenetben tesztelve**: egy frissen létrehozott, "kivitelezés" szerepkörű felhasználó bejelentkezve (1) nem látja a "Felhasználók" nav-elemet, (2) URL-lel közvetlenül a `/felhasznalok`-ra navigálva a "Nincs jogosultságod ehhez a felülethez." üzenetet kapja, nem magát a felületet.

---

## 3. Átláthatósági megjegyzés — saját tesztbeli hiba, nem alkalmazás-hiba

A szerepkör-váltás tesztének **első verziója** véletlenül a bejelentkezett **admin saját fiókjának** szerepkörét állította át "vezetes"-re, és egy korábbi lépés elbukása miatt a visszaállítás nem futott le — ez átmenetileg kizárta az admin fiókot minden admin-only felületről (saját hibám, a teszt-DB-ben, nem az alkalmazás kódjában). A DB-ben közvetlenül visszaállítottam (`role='ADMIN'`), és a tesztet átírtam: mostantól egy **eldobható, külön létrehozott teszt-felhasználón** váltja a szerepkört, soha nem a valódi admin fiókon. Ellenőrizve: az admin fiók szerepköre a jelentés elkészülte után is `ADMIN`.

---

## 4. Hogyan futtatható újra

```bash
cd ubrankovics-crm/frontend
npm run test:e2e            # teljes csomag
npm run test:e2e:report     # utolsó futás interaktív HTML riportja (képernyőképekkel, trace-ekkel)
```

A csomag a futó dev stack ellen fut (`http://localhost:3101` — `docker compose up` az `ubrankovics-crm/` alatt), nem indít saját szervert.

## 5. Javaslat (nem végeztem el, döntés kérdése)

1. A `--muted` design-token színét sötétíteni a WCAG AA 4.5:1 eléréséhez (egy helyen javítva az összes oldalt javítja).
2. A bejelentkezési oldal `<label>` elemeihez `htmlFor`/`id` hozzáadása.
3. Az oldalsáv mobil nézetben összecsukható/hamburger-menüs legyen, a táblázatok pedig vízszintesen görgethető wrapperbe kerüljenek (`overflow-x-auto` — néhány helyen, pl. Felhasználók táblázatánál, ez már megvan, csak nem mindenhol).

Szólj, ha ezeket is megépítsem.
