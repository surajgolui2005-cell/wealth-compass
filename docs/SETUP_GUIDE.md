# Developer Onboarding & Setup Guide — Wealth Compass Platform

**Document ID:** SG-001  
**Version:** 1.0.0  
**Status:** Approved for Production  
**Target Audience:** New Engineers, Full-Stack Developers, DevOps/QA Specialists  
**Last Updated:** 2026-09-06

---

## 1. System Requirements & Prerequisites

Before setting up Wealth Compass, ensure your local workstation meets these minimum specifications:

| Tool               | Minimum Version | Recommended Version   | Verification Command     |
| :----------------- | :-------------- | :-------------------- | :----------------------- |
| **Node.js**        | `v20.0.0` (LTS) | `v20.18.x` or `v22.x` | `node -v`                |
| **pnpm**           | `v8.0.0`        | `v11.x`               | `pnpm -v`                |
| **Docker Engine**  | `v24.0.0`       | Latest Docker Desktop | `docker -v`              |
| **Docker Compose** | `v2.20.0`       | Latest                | `docker compose version` |
| **Python**         | `v3.11.0`       | `v3.12.x`             | `python --version`       |
| **Git**            | `v2.38.0`       | Latest                | `git --version`          |

> [!TIP]
> On Windows, we strongly recommend running inside **PowerShell 7** or **WSL 2** with Docker Desktop integration enabled.

---

## 2. Quick Start (3-Command Boot)

For developers who have Docker and Node.js already configured, the full platform boots locally with three commands:

```bash
# 1. Install all dependencies across monorepo workspaces
pnpm install

# 2. Boot background backing services (PostgreSQL 16 TimescaleDB & Redis 7)
docker-compose up -d

# 3. Launch Turborepo development processes (API, Web, and Workers)
pnpm dev
```

Once running:

- **Web App:** [http://localhost:3000](http://localhost:3000)
- **API Server & Swagger Docs:** [http://localhost:3000/api/docs](http://localhost:3000/api/docs)
- **API Health Check:** [http://localhost:3000/health/readiness](http://localhost:3000/health/readiness)
- **PostgreSQL Adminer UI:** [http://localhost:8080](http://localhost:8080) (Server: `postgres`, User: `postgres`, Pass: `postgres_dev_password_only`)

---

## 3. Comprehensive Step-by-Step Setup

Follow these detailed steps for a fresh developer environment installation.

### Step 3.1: Clone the Repository

```bash
git clone https://github.com/wealth-compass/investor-portfolio-system.git
cd "investor-portfolio-system"
```

### Step 3.2: Environment Variable Configuration

Copy the example configuration file:

```bash
cp .env.example .env
```

Review the key parameters in `.env`:

| Variable             | Default Value                                                                               | Description                                                   |
| :------------------- | :------------------------------------------------------------------------------------------ | :------------------------------------------------------------ |
| `NODE_ENV`           | `development`                                                                               | Runtime environment (`development`, `test`, `production`).    |
| `PORT`               | `3000`                                                                                      | NestJS API listening port.                                    |
| `DATABASE_URL`       | `postgresql://postgres:postgres_dev_password_only@localhost:5432/investor_pm?schema=public` | PostgreSQL connection string.                                 |
| `REDIS_URL`          | `redis://localhost:6379`                                                                    | Redis connection URL for BullMQ and caching.                  |
| `JWT_ACCESS_SECRET`  | `dev_access_secret_min_32_chars_long_for_security_123`                                      | Secret for signing 15-minute access tokens.                   |
| `JWT_REFRESH_SECRET` | `dev_refresh_secret_min_32_chars_long_for_security_456`                                     | Secret for signing 7-day refresh tokens.                      |
| `ENCRYPTION_KEY`     | _(64-hex chars)_                                                                            | 256-bit cryptographic key for AES-256-GCM encryption at rest. |
| `QUANT_ENGINE_URL`   | `http://localhost:8001`                                                                     | Local endpoint for Python Quantitative microservice.          |

> [!IMPORTANT]
> If you need to generate a new `ENCRYPTION_KEY`, run:
>
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

### Step 3.3: Boot Backing Infrastructure (Docker)

Start the containerized backing services:

```bash
docker-compose up -d
```

Verify that all three containers are healthy:

```bash
docker-compose ps
```

Expected output:

```
NAME                    IMAGE                             STATUS                    PORTS
investor_pm_adminer     adminer:latest                    Up (healthy)              0.0.0.0:8080->8080/tcp
investor_pm_postgres    timescale/timescaledb:latest-pg16 Up (healthy)              0.0.0.0:5432->5432/tcp
investor_pm_redis       redis:7-alpine                    Up (healthy)              0.0.0.0:6379->6379/tcp
```

---

### Step 3.4: Database Schema Initialization & Prisma Generation

Generate the Prisma Client and apply database schema migrations:

```bash
# Generate type-safe Prisma client
pnpm --filter @investor-pm/api run prisma:generate

# Execute database migrations
pnpm --filter @investor-pm/api run prisma:migrate
```

---

### Step 3.5: Python Quantitative Engine Setup

The quantitative risk analytics engine (`apps/quant-engine`) executes high-performance calculations in Python:

```bash
cd apps/quant-engine

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS / Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Return to root directory
cd ../..
```

To run the Python microservice standalone:

```bash
uvicorn apps.quant-engine.src.main:app --host 0.0.0.0 --port 8001 --reload
```

---

## 4. Running the Development Stack

### Option A: Monorepo Full-Stack (Turborepo)

From the project root:

```bash
pnpm dev
```

Turborepo concurrently launches:

- NestJS REST API (`@investor-pm/api`) with file-watcher hot reload
- Next.js 14 Web Frontend (`@investor-pm/web`) on port 3000

### Option B: Running Individual Workspaces

You can run individual services in dedicated terminal tabs:

```bash
# Terminal 1: NestJS API Backend
pnpm --filter @investor-pm/api dev

# Terminal 2: Next.js Frontend
pnpm --filter @investor-pm/web dev

# Terminal 3: Python Quant Microservice
cd apps/quant-engine && uvicorn src.main:app --port 8001 --reload

# Terminal 4: React Native / Expo Mobile App
pnpm --filter @investor-pm/mobile start
```

---

## 5. Verification & Testing

Verify that your local environment is functioning with zero errors:

### 5.1 Run Automated Tests

```bash
# Run all unit, integration, and E2E test suites across monorepo
pnpm test:all

# Run backend API tests only (346 tests)
pnpm --filter @investor-pm/api test

# Run frontend web tests only (46 tests)
pnpm --filter @investor-pm/web test

# Run quant engine pytest suite (363 tests)
cd apps/quant-engine && pytest
```

### 5.2 Deep Health & Readiness Probe

Test the live readiness probe:

```bash
curl -i http://localhost:3000/health/readiness
```

Expected JSON response (HTTP 200 OK):

```json
{
  "status": "ok",
  "isHealthy": true,
  "checks": {
    "database": { "status": "up", "latencyMs": 1 },
    "redis": { "status": "up", "latencyMs": 0 },
    "python_analytics": { "status": "up", "latencyMs": 2, "url": "http://localhost:8001/health" }
  }
}
```

---

## 6. Recommended Developer Tooling

### VS Code Extensions

- **Prisma** (`Prisma.prisma`): Syntax highlighting and schema auto-formatting.
- **Tailwind CSS IntelliSense** (`bradlc.vscode-tailwindcss`): Autocomplete for Tailwind CSS classes.
- **ESLint** (`dbaeumer.vscode-eslint`): In-editor linting feedback.
- **Prettier - Code formatter** (`esbenp.prettier-vscode`): Enforces consistent formatting on save.
- **Python** (`ms-python.python`): Virtualenv resolution and linting for `apps/quant-engine`.

### Git Hooks (Husky & Lint-Staged)

Pre-commit hooks are automatically configured on `pnpm install` via `husky`. Every `git commit` automatically runs Prettier formatting against staged files.
