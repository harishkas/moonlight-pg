# Moon Light PG — Phase 1
Local-first Windows application foundation: React + TypeScript + Vite, FastAPI, SQLite, Argon2 password hashing, signed HTTP-only sessions, and scheduled SQLite backups.

## Requirements
Windows 10/11, Python 3.10+, Node.js 20.19+ or 22.12+.

## Setup
1. Copy `backend/.env.example` to `backend/.env`.
2. Set `APP_SECRET` to a random secret of at least 32 characters. Set a unique `ADMIN_PASSWORD` of at least 12 characters.
3. In PowerShell:
```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m app.init_admin
uvicorn app.main:app --host 127.0.0.1 --port 8000
```
4. Open a second PowerShell window:
```powershell
cd frontend
npm install
npm run dev
```
5. Open `http://localhost:5173`.

## Same-Wi-Fi mobile testing
Vite is configured to listen on `0.0.0.0`. Find the laptop IPv4 address using `ipconfig`, then open `http://LAPTOP-IP:5173` on a phone connected to the same trusted Wi-Fi. Allow Node through Windows Firewall on Private networks only. Keep the backend running. This is development mode, not public production hosting.

## Data and backups
Database: `backend/data/moonlight_pg.db`
Backups: `backend/data/backups/`
Logs: `backend/data/logs/`
A backup is created at startup and daily at `BACKUP_TIME` (default 22:00). The backend must be running. Periodically copy backups to a separate USB drive; a backup on the same disk does not protect against disk failure.

## Security
Do not expose this app directly to the internet. Do not commit `.env`. SQLite is accessed only by FastAPI. Phase 1 does not yet implement tenant/document workflows; do not store sensitive identity documents until their access controls, encryption and retention rules are implemented.
