# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Az Ubrankovics építőipari cég munkatársai: irodai csapat (értékesítés, pénzügy, beszerzés, vezetés) asztali gépen, valamint az építésvezetők mobilon a helyszínen. Szerepkörök: Admin, Értékesítés, Kivitelezés, Beszerzés, Pénzügy, Vezetés. Napi munka: érdeklődők kezelése, projektek és tételek követése, beszerzés, számlák, feladatok.

## Product Purpose
Az Ubrankovics CRM egyetlen rendszerben viszi végig a teljes folyamatot az érdeklődéstől az átadásig: érdeklődő → ügyfél → projekt → tételek → ajánlat és szerződés → beszerzés (RFQ/PO) → kivitelezés → TIG és számlák → átadás. Siker: az iroda és a helyszín ugyanazt az aktuális képet látja, és a pénzügyi kockázat (lejárt számlák, negatív cash-flow) időben kiderül.

## Positioning
Építőipari projekt- és pénzügyi folyamat egyben, nem általános értékesítési CRM: épülettípus-sablonokból generált tételek és fázisok, tételenkénti beszerzési folyamat, szerződéses részletekből kiállított számlák és gördülő cash-flow előrejelzés.

## Operating Context
- Munkafolyamat: ügyfelek és személyek, projektek több ügyféllel és építési címmel, tételek szakaszokkal (Ajánlat → Szerződés → Beszerzés → Kivitelezés → Kész), ~45 elemes munkanem-törzs, 55 lépéses fázissablon 9 fázisban.
- Pénzügy: szerződések, ütemezett részletek, ügyfél- és alvállalkozói számlák, TIG, bankkivonat-import, cash-flow.
- Eszközök: Ctrl+K globális keresés, e-mail/dokumentum küldés sablonokból, fájlfeltöltés (max 25 MB), kommunikációs napló, értesítések.
- Nyelv: magyar felület.

## Capabilities and Constraints
- Frontend: Next.js, React, Tailwind, lucide-react ikonok; backend és Docker Compose a `ubrankovics-crm/` mappában.
- Képernyők: Kezdőlap (dashboard), Érdeklődők, Ügyfelek, Projektek, Alvállalkozók, Személyek, Törzsadatok, Pénzügy, Feladatok, Riportok, Felhasználók, Bejelentkezés.
- A mobil használat (építésvezetők) valós követelmény, a teljes felület nem csak asztali.
- Részletes funkciólista: `docs/FUNKCIOLISTA.md`.

## Brand Commitments
Meglévő logó: `frontend/public/ubrankovics-logo.svg`. Más márka- vagy hangvételi kötöttség nincs megerősítve.

## Evidence on Hand
- `docs/FUNKCIOLISTA.md` és `docs/E2E_TESZTJELENTES.md` (funkcionális és e2e teszteredmények).
- Playwright e2e csomag és axe-core alapú hozzáférhetőségi ellenőrzés a repóban.
- Valódi ügyfél-értékelések, esettanulmányok vagy mérőszámok nincsenek; ilyet nem szabad kitalálni.

## Product Principles
1. A teljes folyamat egy helyen: bárki az érdeklődőtől az átadásig követni tudja, hol tart egy projekt.
2. Az iroda és a helyszín ugyanazt látja: mobilon is használható marad a feladat- és tételkezelés.
3. A pénzügyi kockázat sose rejtőzzön el: lejárt tartozás és negatív egyenleg azonnal látszik.
4. Egy művelet, egy egyértelmű következő lépés: sablonok és automatikus generálás a kézi gépelés helyett.

## Accessibility & Inclusion
Nincs külön követelmény megerősítve; a repóban van axe-core ellenőrzés, a szabvány szintje nyitott döntés.
