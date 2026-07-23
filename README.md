# PLANora

Webalapú építőipari projektütemező rendszer — könnyűszerkezetes családi házak kivitelezésének teljes életciklusa.

## Stack

| Réteg | Technológia |
|-------|-------------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, ShadCN UI |
| Backend | Python 3.13, FastAPI, SQLAlchemy, Alembic |
| Adatbázis | PostgreSQL 16 |
| Fájltároló | S3-kompatibilis (MinIO dev módban) |
| Proxy | Nginx |
| Konténer | Docker Compose |

## Gyors indítás

```bash
# Teljes stack (első alkalommal build is)
docker compose up --build

# Frontend: http://localhost:3001
# Backend API: http://localhost:8000/docs
# PostgreSQL: localhost:5433 (5432 foglalt más projekt miatt)
# MinIO console: http://localhost:9001
```

### Alapértelmezett admin

- **Felhasználónév:** `admin`
- **Jelszó:** a `.env` fájlban megadott `ADMIN_PASSWORD` (ha üresen hagyod, első indításkor véletlenszerű jelszót generál a rendszer, és kiírja a backend konténer logjába)

> Első indításkor automatikusan létrejön az admin felhasználó és a 24 alap tevékenység sablon.

Production telepítéshez lásd a [TELEPITES.md](TELEPITES.md) leírást.

## Fejlesztés (Docker nélkül)

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Dokumentáció

- [Funkcionális specifikáció](docs/SPEC.md)
- [Design referencia](docs/design.jpg)

## Projekt struktúra

```
planora/
├── backend/          # FastAPI API
├── frontend/         # Next.js UI
├── nginx/            # Reverse proxy config
├── docs/             # Specifikáció, design
└── docker-compose.yml
```
