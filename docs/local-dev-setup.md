# Local Development Setup (Auth-Enabled)

A step-by-step guide to get NeuroSense FX running on your machine with authentication, PostgreSQL persistence, and Redis sessions.

---

## Prerequisites

- **Node.js** (v18+) and **npm**
- **Docker** (recommended) OR native **PostgreSQL 15+** and **Redis 7+**

---

## Option A: Docker (Recommended)

This is the simplest path. Docker handles PostgreSQL, Redis, and database initialization automatically.

### 1. Clone and install dependencies

```bash
git clone <repo-url> neurosensefx
cd neurosensefx
npm install
cd services/tick-backend && npm install && cd ../..
```

### 2. Create your `.env` file

```bash
cp .env.example .env
```

Open `.env` and fill in your cTrader credentials (you need these from the cTrader Open API portal). Then add the PostgreSQL and Redis variables at the bottom:

```
# PostgreSQL
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=neurosensefx_dev
PG_USER=neurosensefx
PG_PASSWORD=neurosensefx_dev_123

# Redis
REDIS_URL=redis://localhost:6379
```

### 3. Start PostgreSQL and Redis via Docker

```bash
docker compose -f docker-compose.dev.yml up postgres-dev redis-dev -d
```

This starts:
- **PostgreSQL 15** on `localhost:5432` (database: `neurosensefx_dev`, user: `neurosensefx`)
- **Redis 7** on `localhost:6379`

The init scripts in `docker/postgres/init/` run automatically on first startup, creating all required tables (users, sessions, workspaces, drawings, price_markers).

### 4. Start the app

```bash
./run.sh dev
```

This starts:
- **Backend** on `http://localhost:8080` (WebSocket + REST API)
- **Frontend** on `http://localhost:5174` (Vite dev server with hot reload)

Open `http://localhost:5174` in your browser. You will see a login form. Register a new account and you are in.

### 5. Stop when done

```bash
./run.sh stop
docker compose -f docker-compose.dev.yml down
```

---

## Option B: Native Install (Codespaces / No Docker)

Use this if you cannot run Docker (e.g., GitHub Codespaces with limited permissions) or prefer to run services directly on the host.

### 1. Install dependencies

```bash
git clone <repo-url> neurosensefx
cd neurosensefx
npm install
cd services/tick-backend && npm install && cd ../..
```

### 2. Install PostgreSQL and Redis

On Ubuntu/Debian:

```bash
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib redis-server
```

### 3. Set up PostgreSQL

If the default PostgreSQL cluster starts without issues, skip to step 3c. If you hit permission errors (common in Codespaces), initialize a custom data directory:

```bash
# Stop the default cluster if it exists
sudo pg_ctlcluster 15 main stop 2>/dev/null || true

# Create a custom data directory
mkdir -p /tmp/pgdata
sudo chown $(whoami) /tmp/pgdata

# Initialize a fresh cluster
/usr/lib/postgresql/15/bin/initdb -D /tmp/pgdata

# Start the custom cluster
/usr/lib/postgresql/15/bin/pg_ctl -D /tmp/pgdata -l /tmp/pgdata/logfile start
```

Now create the database and user:

```bash
# If using the default cluster, use: sudo -u postgres psql
# If using the custom cluster, use: psql
psql

# Inside the psql shell:
CREATE USER neurosensefx WITH PASSWORD 'neurosensefx_dev_123';
CREATE DATABASE neurosensefx_dev OWNER neurosensefx;
\q
```

### 4. Run the database init scripts

The init scripts create extensions and tables. Run them in order:

```bash
# If using the default cluster:
psql -U neurosensefx -d neurosensefx_dev -f docker/postgres/init/01-init.sql

# If using the custom cluster (no password prompt):
psql -h localhost -U neurosensefx -d neurosensefx_dev -f docker/postgres/init/01-init.sql

# Then the auth tables:
psql -h localhost -U neurosensefx -d neurosensefx_dev -f docker/postgres/init/02-auth-tables.sql
```

If you get a "password authentication failed" error, edit `pg_hba.conf` to allow local trust auth for the development database, or set the `PGPASSWORD` environment variable:

```bash
export PGPASSWORD=neurosensefx_dev_123
```

### 5. Start Redis

```bash
sudo service redis-server start
# or: redis-server --daemonize yes
```

Verify it is running:

```bash
redis-cli ping
# Should return: PONG
```

### 6. Create your `.env` file

```bash
cp .env.example .env
```

Open `.env`, fill in your cTrader credentials, and add:

```
# PostgreSQL
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=neurosensefx_dev
PG_USER=neurosensefx
PG_PASSWORD=neurosensefx_dev_123

# Redis
REDIS_URL=redis://localhost:6379
```

### 7. Start the app

```bash
./run.sh dev
```

Open `http://localhost:5174`. Register a new account on first visit.

---

## Environment Variables

All variables go in the `.env` file at the project root.

| Variable | Description | Status |
|----------|-------------|--------|
| `CTRADER_CLIENT_ID` | cTrader API client ID | In `.env.example` |
| `CTRADER_CLIENT_SECRET` | cTrader API client secret | In `.env.example` |
| `CTRADER_ACCESS_TOKEN` | cTrader API access token | In `.env.example` |
| `CTRADER_REFRESH_TOKEN` | cTrader API refresh token | In `.env.example` |
| `CTRADER_ACCOUNT_ID` | cTrader account ID | In `.env.example` |
| `CTRADER_ACCOUNT_TYPE` | `LIVE` or `DEMO` | In `.env.example` |
| `CTRADER_HOST_TYPE` | `LIVE` or `DEMO` | In `.env.example` |
| `HOST` | cTrader host (e.g., `live.ctraderapi.com`) | In `.env.example` |
| `PORT` | cTrader port (e.g., `5035`) | In `.env.example` |
| `VITE_BACKEND_URL` | WebSocket URL for the frontend (`ws://localhost:8080` in dev) | In `.env.example` |
| `PG_HOST` | PostgreSQL host | In `.env.example` |
| `PG_PORT` | PostgreSQL port (default `5432`) | In `.env.example` |
| `PG_DATABASE` | Database name (`neurosensefx_dev`) | In `.env.example` |
| `PG_USER` | Database user (`neurosensefx`) | In `.env.example` |
| `PG_PASSWORD` | Database password | In `.env.example` |
| `REDIS_URL` | Redis connection URL (`redis://localhost:6379`) | In `.env.example` |

---

## Running the App

- **`./run.sh dev`** starts both backend and frontend.
- Backend runs on **port 8080** (REST API and WebSocket).
- Frontend runs on **port 5174** (Vite dev server with hot reload).
- The Vite dev server proxies `/api/*` and `/ws` requests to the backend automatically (configured in `vite.config.js`).
- On first visit, you will see a **login form**. Click "Register" to create a new account.
- After login, any existing data in your browser's localStorage or IndexedDB is automatically migrated to the server.

### Other useful commands

```bash
./run.sh status       # Check if services are running
./run.sh stop         # Stop all services
./run.sh logs         # Follow backend + frontend logs
./run.sh logs backend # Follow backend logs only
```

---

## Troubleshooting

### Backend starts but auth does not work (login/register returns errors)

PostgreSQL or Redis is probably not running.

```bash
# Check PostgreSQL
psql -h localhost -U neurosensefx -d neurosensefx_dev -c "SELECT 1;"

# Check Redis
redis-cli ping
```

If either fails, start the service (see Option A step 3 or Option B steps 3-5).

### "Schema verification failed" or "relation does not exist"

The database exists but the init scripts have not been run. Run them manually:

```bash
psql -h localhost -U neurosensefx -d neurosensefx_dev -f docker/postgres/init/01-init.sql
psql -h localhost -U neurosensefx -d neurosensefx_dev -f docker/postgres/init/02-auth-tables.sql
```

If you get a "database does not exist" error, create it first:

```bash
psql -h localhost -U neurosensefx -d postgres -c "CREATE DATABASE neurosensefx_dev OWNER neurosensefx;"
```

### Login cookie not being stored

The Vite proxy might not be forwarding cookies correctly. Check `vite.config.js` to confirm the proxy is configured (it should have `/api` and `/ws` entries pointing to `localhost:8080`). If you are running the frontend on a different port or without Vite, cookies will not work because the browser sees the frontend and API as different origins.

### E2E tests fail because a login form is visible

The existing E2E test suite (55 tests) was written before auth was added. These tests skip login and go straight to the chart, which no longer works. The tests need a login step added before each test. This is a known gap.

---

## What Works

- User registration, login, and logout
- Session persistence across page reloads (via HTTP-only cookie)
- Workspace layout saved to PostgreSQL
- Chart drawings saved to PostgreSQL (per symbol and resolution)
- Price markers saved to PostgreSQL
- WebSocket market data streaming (shared across all authenticated users)
- Hot module replacement in development (Vite HMR)

---

## What Does Not Work Yet (Locally)

- **55 pre-auth E2E tests** need a login step added before they can run
- **5 server persistence integration tests** exist but have not been validated
- **SSL/HTTPS** is not configured in development (uses plain HTTP)
