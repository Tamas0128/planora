# PLANora — telepítési leírás (production)

Ez a csomag a PLANora forráskódját tartalmazza, **teszt- és fejlesztői adatok nélkül**. Friss adatbázissal indul: nincs benne teszt-projekt, teszt-felhasználó vagy próba-dokumentum. Az ütemtervhez tartozó 24 alapértelmezett tevékenységsablon (Terület rendezése, Fogadószint építése, stb. — a `docs/SPEC.md` 6. fejezete szerint) **automatikusan létrejön** első induláskor, ez nem teszt adat, hanem a rendszer működéséhez szükséges alapkonfiguráció.

## 1. Előfeltételek

- **Docker Desktop** (Windows/Mac) vagy Docker Engine + Docker Compose plugin (Linux) — a `docker compose version` parancsnak v2-t kell mutatnia.
- Legalább **4 GB szabad RAM** és **5 GB szabad lemezterület** a build-hez és a konténer-image-ekhez.
- Szabad portok a célgépen: **80, 443, 3001, 5433, 8025, 8080, 8443, 9000, 9001** (lásd 4. pont — nem mindegyik kötelező kifelé nyitva legyen, de ha valamelyiket más program már használja, a `docker compose up` hibát fog dobni rá).

## 2. Kicsomagolás

Csomagold ki a zip-et egy tetszőleges könyvtárba, pl. `C:\planora` vagy Linuxon `/opt/planora`.

## 3. Környezeti változók beállítása

```bash
cp .env.example .env
```

Nyisd meg a `.env` fájlt, és **töltsd ki/cseréld le minden `CHANGE_ME` értéket**:

| Változó | Mire való | Kötelező cserélni? |
|---|---|---|
| `POSTGRES_PASSWORD` | Adatbázis jelszó | Igen |
| `MINIO_ROOT_PASSWORD` | Dokumentum/fotó-tároló jelszó | Igen |
| `SECRET_KEY` | JWT token aláíró kulcs — generálás: `python -c "import secrets; print(secrets.token_hex(32))"` | Igen |
| `ADMIN_PASSWORD` | Az automatikusan létrejövő `admin` fiók jelszava | Igen |
| `S3_PUBLIC_ENDPOINT` | Csak akkor kell módosítani, ha a MinIO más címen érhető el a böngészőből, mint a backend-ről | Csak ha eltér |
| `CORS_ORIGINS` | Minden domain/port, ahonnan a böngésző eléri az appot | Igen — írd át a saját domained/IP-d szerint |

**Fontos:** ha az `ADMIN_PASSWORD`-öt üresen hagyod, a rendszer első indításkor véletlenszerű jelszót generál, és **csak a backend konténer logjában** írja ki egyszer — mentsd el onnan, vagy inkább állíts be előre egy saját jelszót.

## 4. Első indítás

```bash
docker compose up --build -d
```

Ez felépíti és elindítja az összes szolgáltatást:

| Szolgáltatás | Elérés | Megjegyzés |
|---|---|---|
| Frontend közvetlenül | `http://<gép-IP>:3001` | Fejlesztői/gyors ellenőrzéshez |
| Nginx — HTTP | `http://<gép-IP>:80` vagy `:8080` | |
| Nginx — HTTPS | `https://<gép-IP>` vagy `:8443` | Önaláírt tanúsítvány (ld. 6. pont) |
| MinIO konzol | `http://<gép-IP>:9001` | Dokumentumtár admin felülete |
| Mailpit | `http://<gép-IP>:8025` | A napi e-mail digest itt jelenik meg teszt-SMTP szerverként — **ha valódi e-mail küldés kell, cseréld le a `docker-compose.yml`-ben az `SMTP_HOST`-ot egy valós SMTP szerverre** |

Az induláshoz 1-3 perc kell (build + a Postgres/MinIO egészség-ellenőrzés + a 24 alap tevékenységsablon automatikus betöltése).

## 5. Bejelentkezés

- **Felhasználónév:** `admin`
- **Jelszó:** a `.env`-ben megadott `ADMIN_PASSWORD`

Első bejelentkezés után javasolt admin oldalon (`Felhasználók`) további felhasználókat felvenni a valós szerepkörökkel (Projektmenedzser, Építésvezető, Beszerzés, Számlázás, Menedzsment).

## 6. HTTPS és saját domain beállítása (opcionális)

Az nginx alapból egy **önaláírt** TLS-tanúsítvánnyal fut (`CN=planora.local`) — ez azt jelenti, hogy a böngésző "nem biztonságos kapcsolat" figyelmeztetést fog mutatni, amíg egyszer manuálisan el nem fogadod ("Speciális" → "Folytatás mindenképp"). Ez production környezetben is működik, csak nem "zöld lakat" — ha valódi, böngésző által megbízhatónak jelzett tanúsítvány kell, cseréld le Let's Encrypt/Certbot-tal generált tanúsítványra az `infra/nginx/` alatt.

Ha saját domain-nevet (pl. `planora.pelda-cegem.local`) szeretnél használni belső hálózaton:

1. Cseréld le az `infra/nginx/Dockerfile`-ban az `openssl req ... -subj "/CN=planora.local"` sort a saját domain-nevedre.
2. A célgépen (vagy minden kliens gépen, ahonnan elérik) vegyél fel egy hosts-bejegyzést a domain névre mutatva a szerver IP-jére:
   - Windows: `C:\Windows\System32\drivers\etc\hosts` (rendszergazdaként szerkesztve) — `<szerver-IP> planora.pelda-cegem.local`
   - Linux/Mac: `/etc/hosts`
3. Add hozzá a domain-t a `.env` `CORS_ORIGINS` listájához.
4. `docker compose up --build -d nginx backend` az újraépítéshez.

## 7. Mentés (backup)

A csomag már tartalmazza az automatikus mentést, nincs extra teendő:

- **PostgreSQL:** napi 00:30-kor, 30 napi / 12 heti / 12 havi megőrzéssel, a `postgres_backups` Docker volume-ba.
- **MinIO (dokumentumok/fotók):** napi 01:00-kor tükrözve a `minio_backups` Docker volume-ba, plusz a bucket verziózás is be van kapcsolva.

Ha a volume-okat külső géphez/tárolóhoz szeretnéd kimenteni, azt a Docker volume-ok host-mountolásával vagy egy külön `docker cp`/rsync feladattal old meg.

## 8. Frissítés egy későbbi verzióra

```bash
git pull                                   # ha Git-tel követed a kódot
docker compose build --no-cache backend frontend
docker compose up -d
```

Az adatbázis-migrációk (`backend/migrations/`) automatikusan lefutnak a backend konténer indulásakor — nincs kézi lépés.

## 9. Gyakori hibák

| Tünet | Ok / megoldás |
|---|---|
| `docker compose up` port-ütközési hibával leáll | Valamelyik port (80/443/3001/stb.) már foglalt a gépen — vagy szabadítsd fel, vagy módosítsd a `docker-compose.yml` port-mappingjeit (`"HOST_PORT:CONTAINER_PORT"`). |
| Bejelentkezéskor "Hibás felhasználónév vagy jelszó" | Ellenőrizd, hogy a `.env`-ben lévő `ADMIN_PASSWORD` egyezik-e azzal, amit beírsz — ha üresen hagytad, nézd meg a generált jelszót: `docker compose logs backend \| grep "generated random admin password"` |
| Böngésző "nem biztonságos kapcsolat" figyelmeztetés HTTPS-en | Elvárt viselkedés önaláírt tanúsítvánnyal (ld. 6. pont) — kattints "Folytatás mindenképp"-re, vagy állíts be valódi tanúsítványt. |
| Fotó/dokumentum feltöltés nem működik, de minden más igen | A `S3_PUBLIC_ENDPOINT` valószínűleg rossz — ennek olyan címnek kell lennie, amit a **böngésző** el tud érni, nem csak a szerver belső hálózata. |
| Térkép nézet nem geokódolja az új projekteket | Ez a `GEOCODING_ENABLED=true` mellett is csak akkor működik, ha a szervernek van kimenő internet-elérése (a nyilvános OpenStreetMap Nominatim szolgáltatást hívja) — tűzfal mögötti/légrés-hálózaton szándékosan nem fog geokódolni, ez nem hiba. |
