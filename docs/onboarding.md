# Developer Onboarding — The Journey

Start here if you're new to the project. This is the **map**: it explains what you need to get
running, gives you two paths to choose from, and points you to the right doc for each step.

> For the exact commands (copy-paste), the companion cookbook is
> [`docs/local-dev-setup.md`](local-dev-setup.md). This page is the *journey*; that page is the
> *recipe*.

---

## What the app needs to run

NeuroSense FX has two parts: a **frontend** (the chart UI) and a **backend** (talks to cTrader for
prices, handles login, and saves your work). To run it locally you need **five things**:

1. **Code dependencies** — three sets of JavaScript packages (frontend, backend, and the cTrader
   layer). One command installs all of them.
2. **cTrader credentials** — *your* API keys from the cTrader Open API. These are private to you;
   **no script can supply them.**
3. **A database** — PostgreSQL, to store logins, workspaces, drawings, and price markers.
4. **A cache** — Redis, to hold login sessions.
5. **A config file** — `.env`, which wires all of the above together.

Everything below is just arranging those five. The difference between the two paths is **how many of
them get done for you automatically**.

---

## Choose your path

- **Path A — DevContainer (recommended, most automated):** use this if you have Docker. The container
  provisions the database, the cache, all dependencies, and the database tables for you. You only owe
  it your cTrader credentials.
- **Path B — Manual / your own machine:** use this if you can't (or don't want to) run Docker. You
  install and start PostgreSQL and Redis yourself.

---

## Path A — Open in DevContainer

**Starting point:** VS Code with the **Dev Containers** extension, and **Docker** running.
(Equivalent: open the repo in a **GitHub Codespace** — same result.)

1. **Clone the repo** (or open it on GitHub and choose *Open in Codespace*).
2. VS Code offers **"Reopen in Container"** — click it. The container builds from `.devcontainer/`.
3. **It now sets most things up automatically.** The container's `postCreateCommand` runs, in order:
   - `setup_project.sh` → installs all three dependency sets and builds the cTrader layer.
   - `setup_codespace_db.sh` → starts Redis and PostgreSQL, creates the `neurosensefx` user and
     `neurosensefx_dev` database, and runs the table-creation scripts.
   - `setup_claude.sh` → *(optional)* configures the Claude Code AI assistant — only if you've added
     a secret key; otherwise it prints a warning and skips harmlessly.
4. **The one thing you still do by hand — create `.env`:**
   ```bash
   cp .env.example .env
   ```
   Open `.env` and paste in your **cTrader credentials**. The PostgreSQL/Redis values are already
   known (the container set them up) — use the values shown in `.env.example`.
5. **Start the app:**
   ```bash
   ./run.sh dev
   ```
   Backend runs on `:8080`, the UI on `:5174`.
6. Open <http://localhost:5174>, **register an account**, and you're in.

**Items 1, 3, and 4 are handled for you. You only supply the credentials + `.env`.**

---

## Path B — Manual / your own machine

**Starting point:** VS Code on a machine where you'll run PostgreSQL and Redis yourself.

1. **Clone and install everything:**
   ```bash
   git clone https://github.com/timmye/neurosensefx.git
   cd neurosensefx
   ./setup_project.sh
   ```
   `setup_project.sh` installs the frontend, backend, and cTrader-layer dependencies and builds the
   layer.
2. **Provide PostgreSQL + Redis** — either:
   - **Docker (recommended):**
     ```bash
     docker compose -f docker-compose.dev.yml up postgres-dev redis-dev -d
     ```
     This starts PostgreSQL and Redis and auto-creates the tables on first run.
   - **Native install:** install PostgreSQL 15 and Redis, create the user and database, and run the
     two SQL init scripts by hand. See [`local-dev-setup.md`](local-dev-setup.md) → *Option B* for the
     exact commands.
3. **Create `.env`:**
   ```bash
   cp .env.example .env
   ```
   Fill in your cTrader credentials and the PostgreSQL/Redis connection settings.
4. **Start the app:**
   ```bash
   ./run.sh dev
   ```
5. Open <http://localhost:5174>, register, and you're in.

---

## The one thing no path can do for you: cTrader credentials

Every path requires you to put real cTrader API credentials in `.env`:

```
CTRADER_CLIENT_ID=...
CTRADER_CLIENT_SECRET=...
CTRADER_ACCESS_TOKEN=...
CTRADER_REFRESH_TOKEN=...
CTRADER_ACCOUNT_ID=...
```

Obtain these from the **cTrader Open API portal**. This is the single most common place a new
developer stalls — sort these out early.

---

## Resource map — what supports you at each step

| Resource | What it is | Helps you when… |
|---|---|---|
| `README.md` | The front door — what the project is and a quick start | Your first read |
| `docs/onboarding.md` *(this file)* | The guided journey + resource map | Getting oriented before you run anything |
| `docs/local-dev-setup.md` | The detailed command cookbook (Docker + native) | Running the exact setup steps |
| `setup_project.sh` | One-command installer (all deps + builds the cTrader layer) | The single step that replaces three `npm install`s |
| `.env.example` | Template of every config value the app expects | Knowing what belongs in `.env` |
| `.devcontainer/` | The "open in container" definition + auto-setup | Using Path A |
| `scripts/setup_codespace_db.sh` | Auto-provisions PostgreSQL + Redis + tables | Runs automatically in the container — you don't call it |
| `run.sh` | Service manager: `dev`, `start`, `stop`, `status`, `logs` | Starting, stopping, checking the app |
| `CLAUDE.md` (root + each folder) | Project context, file/directory map, conventions | Understanding the codebase layout |
| `docs/health-endpoint.md` | Reading backend feed health + forcing a reconnect | When prices look stale or a feed seems down |
| `libs/cTrader-Layer/CLAUDE.md` | How to rebuild the cTrader layer (`ttsc`, not `tsc`) | Only when **editing the cTrader layer's source** |

---

## A note on the cTrader layer

`libs/cTrader-Layer/` is an **internal vendored fork** — its compiled output is committed to this
repo. That's why a fresh clone needs **no submodule to initialize, no separate repo to clone, and no
npm package to fetch**, and why `setup_project.sh` just works. You only rebuild it (with
`cd libs/cTrader-Layer && npx ttsc`) if you edit its TypeScript sources.

---

## Caveats

- **cTrader credentials are always manual** (see above).
- **Minor version mismatch:** the devcontainer feature installs **PostgreSQL 13**, while the docs say
  **PostgreSQL 15+**. It works fine for development; flag it if you need to match production exactly.
- **`setup_claude.sh` is optional:** it only configures the Claude Code AI assistant, and only if the
  `secrets/claude-api` file exists (it isn't shipped with the repo). If absent, it skips silently and
  does not affect setup.

---

## Where to go next

- Detailed commands for either path → [`local-dev-setup.md`](local-dev-setup.md)
- Operating/monitoring the running backend → [`health-endpoint.md`](health-endpoint.md)
- Codebase layout and conventions → `../CLAUDE.md`
