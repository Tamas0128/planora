---
name: Ubrankovics CRM
description: Nyugodt, krém alapú munkafelület építőipari projekt- és pénzügyi folyamatokhoz, sötét oldalsávval és Ubrankovics-zölddel.
colors:
  primary: "#22582b"
  primary-hover: "#1a4521"
  primary-foreground: "#faf6ee"
  moss-500: "#2f6b3b"
  moss-400: "#5f9268"
  moss-300: "#9cc0a1"
  moss-200: "#c9ddcc"
  moss-100: "#e8f0e9"
  oat-page: "#efe8d8"
  oat-card: "#fdf6ee"
  oat-subtle: "#faf6ee"
  oat-line: "#e0d7c2"
  oat-400: "#c7bc9f"
  oat-500: "#a89b7c"
  oat-muted: "#8a7d61"
  oat-700: "#6b6049"
  oat-800: "#453d2e"
  bark-sidebar: "#25221d"
  bark-hover: "#34302a"
  bark-text: "#d9d2c0"
  ink: "#2b271f"
  clay-critical: "#ae523a"
  clay-critical-bg: "#f6e4dc"
  amber-warning: "#b8873a"
  amber-warning-bg: "#f7ecd6"
typography:
  title:
    fontFamily: "Raleway, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
  section:
    fontFamily: "Raleway, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.43
  body:
    fontFamily: "Archivo, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Archivo, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
rounded:
  sm: "0.55rem"
  md: "0.85rem"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  input:
    backgroundColor: "{colors.oat-card}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "6px 8px"
  card:
    backgroundColor: "{colors.oat-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "16px"
  badge-status:
    backgroundColor: "{colors.moss-100}"
    textColor: "{colors.primary-hover}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  nav-item:
    textColor: "{colors.bark-text}"
    typography: "{typography.body}"
    padding: "8px 16px"
  nav-item-active:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
---

# Design System: Ubrankovics CRM

## Overview

**Creative North Star: "A Rendezett Faház"**

A felület egy rendben tartott faház belső tere: meleg krém felületek, sötét kéreg-színű oldalsáv, és egyetlen mély, erdőzöld hang, amely az Ubrankovics weboldalának gombszínéből származik (#22582b). A hangulat nyugodt, megbízható és magabiztos. Ez munkaeszköz, nem showroom: a márka a részletekben él (a szín, a Raleway címek, a logó), nem a díszítésben.

Az információ sűrű, de levegős: keretes, lapos kártyák, vékony elválasztók, kis (14px) szöveg. Az érdeklődőtől az átadásig minden képernyő ugyanazt a nyelvet beszéli, hogy az iroda és a helyszín ugyanazt a képet lássa.

Visszautasított irányok: színes SaaS-dashboard, neon, üveghatás (glassmorphism).

**Key Characteristics:**
- Meleg, krém alapú neutrálisok zöldes-barna árnyalattal, soha hideg szürke.
- Egyetlen akcentus (erdőzöld), a státusz-jelzések külön, földszínű család.
- Lapos felületek kerettel; árnyék csak lebegő elemen.
- Lekerekített, de visszafogott formák (0.85rem).
- Raleway címek, Archivo törzsszöveg.

## Colors

Meleg, földszínű paletta: krém és zab neutrálisok, kéreg-barna oldalsáv, erdőzöld akcentus, agyag- és borostyán státuszszínek.

### Primary
- **Ubrankovics Erdőzöld** (#22582b, `--primary`): elsődleges gombok, aktív navigáció, kulcsfontosságú jelzések. Hover: **Mély Erdőzöld** (#1a4521).
- **Moha-skála** (#2f6b3b, #5f9268, #9cc0a1, #c9ddcc, #e8f0e9): halvány zöldek állapot-jelvényekhez és kiemelésekhez; a legvilágosabb (#e8f0e9) a jelvény háttere.

### Neutral
- **Zabpehely Oldalháttér** (#efe8d8, `--background`): az oldal háttere.
- **Meleg Krém Kártya** (#fdf6ee, `--card`): kártyák, táblázatok, modálok felülete.
- **Halvány Krém** (#faf6ee): finom alapfelület, az elsődleges gomb szövege.
- **Zab Vonal** (#e0d7c2, `--border`): kártyakeretek és elválasztók.
- **Néma Barna** (#8a7d61, `--muted`): másodlagos szöveg, hint, címke.
- **Tinta** (#2b271f, `--foreground`): törzsszöveg.
- **Kéreg Oldalsáv** (#25221d), **Kéreg Hover** (#34302a), **Kéreg Szöveg** (#d9d2c0): az oldalsáv felülete, hoverje és szövege.

### Semantic
- **Agyag Kritikus** (#ae523a) és háttere (#f6e4dc): hiba, törlés, lejárt határidő. A kód ma főként szövegszínként használja.
- **Borostyán Figyelmeztetés** (#b8873a) és háttere (#f7ecd6): figyelmeztetés (a meglévő tokenek között).

### Named Rules
**Az Egy Hang Szabály.** Az erdőzöld az egyetlen akcentus. Aktív állapotot, elsődleges műveletet és pozitív jelvényt jelöl; dekorációra nem használjuk.

**A Meleg Neutrális Szabály.** Minden semleges árnyalat zöldes-barna irányba hajlik. Hideg szürke vagy tiszta fekete/fehér nem kerül a felületre.

## Typography

**Display/Heading Font:** Raleway (Helvetica Neue, Helvetica, Arial tartalékkal)
**Body Font:** Archivo (system-ui tartalékkal)

**Character:** Raleway a weboldal saját betűtípusa, ez adja a márka hangját a címekben; az Archivo semleges, jól olvasható munkabetű a sűrű adatokhoz.

### Hierarchy
- **Title** (Raleway 600, 1.5rem, 1.33): oldalcímek.
- **Section** (Raleway 600, 0.875rem, 1.43): kártya- és modálcímek (h2).
- **Body** (Archivo 400, 0.875rem, 1.43): űrlapok, táblázatok, listák; a felület alapmérete.
- **Label** (Archivo 500, 0.75rem): jelvények, metaadat, billentyűkombináció-hint.

### Named Rules
**A Két Betű Szabály.** Raleway csak címekre (h1–h3, `.font-heading`), minden más Archivo. Harmadik betűtípus nem kerül be.

## Layout

Fix 15rem (w-60) széles bal oldalsáv és egy `flex-1` főterület 2rem (p-8) belső margóval. A tartalom kártyákban és táblázatokban él; a ritmus Tailwind-skála (4/8/12/16px), szekciók között 12–16px, a főterület kerete 32px.

Megfigyelés: a jelenlegi kód nem tartalmaz érdemi reszponzív viselkedést (a komponensekben csak elvétve van töréspont), az oldalsáv mobilon sem csukódik össze. A PRODUCT.md szerint az építésvezetők mobilon dolgoznak, ezért ez a rendszer ismert hiánya, nem szándékos döntése.

## Elevation & Depth

Lapos alapállapot: a mélységet a krém kártya és a zab oldalháttér tónusa meg a 1px-es keret adja, nem az árnyék. Árnyék csak lebegő rétegen jelenik meg (modál `shadow-lg`, globális keresés `shadow-xl`).

### Named Rules
**A Lapos Alapállapot Szabály.** Kártyák és táblázatok nem kapnak árnyékot. Árnyék csak ott van, ahol a felület az oldal fölé lebeg.

## Shapes

Lekerekített, de visszafogott: a fő sugár 0.85rem (kártyák, gombok, mezők), kisebb elemeknél 0.55rem, jelvényeknél teljes kerekítés (pill). A kártyák 1px keretet kapnak (`--border`), a listák belső elválasztóval (`divide-y`). Az oldalsáv navigációs sorai szögletesek és teljes szélességűek.

## Components

### Buttons
- **Shape:** 0.85rem sugár.
- **Primary:** erdőzöld háttér (#22582b), halvány krém szöveg (#faf6ee), 14px, 500 vastagság, kb. 6px 12px belső margó.
- **Hover:** mélyebb zöld (#1a4521). Másodlagos és szellem gombok keret nélküli vagy kerettel jelölt szövegek, `--muted` színnel.

### Chips / Jelvények
- **Style:** pill alakú, 12px; állapotjelvény: halványzöld háttér (#e8f0e9), mély zöld szöveg; semleges: halvány fekete 5% átfedés, néma barna szöveg; számláló: agyag háttér, fehér szöveg.

### Cards / Containers
- **Corner Style:** 0.85rem.
- **Background:** Meleg Krém Kártya (#fdf6ee).
- **Shadow Strategy:** nincs (lásd Elevation).
- **Border:** 1px Zab Vonal (#e0d7c2).
- **Internal Padding:** 16px; listakártyákon `divide-y` elválasztók.

### Inputs / Fields
- **Style:** 1px Zab Vonal keret, 0.85rem sugár, 14px szöveg, kb. 8px × 6px belső margó. A mezők mindenhol ugyanazt az `inputCls` mintát használják.
- **Focus / Error / Disabled:** nincs egységesen definiálva a kódban; kitűzendő tisztázás.

### Navigation
- **Style:** Kéreg Oldalsáv (#25221d), 14px, ikon (lucide, 16px) + felirat. Alapállapot: Kéreg Szöveg (#d9d2c0); hover: #34302a; aktív: erdőzöld háttér, fehér, 500 vastagság.
- A logó krém kártyán ül az oldalsáv tetején; alatta Ctrl+K keresőgomb és értesítés-csengő.

### Modal
- Kártya-stílusú doboz 0.85rem sugárral, 16px belső margóval, `shadow-lg`, 30%-os fekete háttér; keskeny (max-w-md) vagy széles (max-w-3xl) változat.

## Do's and Don'ts

### Do:
- **Do** használd a CSS-változókat (`var(--primary)`, `var(--card)`, `var(--border)`), ne új hex értékeket.
- **Do** tartsd az erdőzöldet (#22582b) elsődleges műveletre, aktív állapotra és pozitív jelvényre.
- **Do** hagyd laposnak a kártyákat: 1px Zab Vonal keret, 0.85rem sugár, árnyék nélkül.
- **Do** használj Ralewayt a címekhez és Archivót minden máshoz, törzsszöveg 14px.
- **Do** a hiba- és lejárt-jelzéshez az Agyag Kritikus (#ae523a) színt használd.

### Don't:
- **Don't** használj hideg szürkét, tiszta fekete/fehér felületet vagy kék akcentust.
- **Don't** adj kártyára árnyékot vagy üveghatást (glassmorphism); a visszautasított irány a színes SaaS-dashboard és a neon.
- **Don't** használd az erdőzöldet díszítésre.
- **Don't** vezess be harmadik betűtípust.
