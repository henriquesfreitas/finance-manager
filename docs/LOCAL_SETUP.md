# Local Development Setup

This guide sets up Finance Manager on a developer machine with PostgreSQL in Docker and the API and client running locally. For a fresh Ubuntu VPS, use [Production VPS Setup](PRODUCTION_VPS_SETUP.md).

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for PostgreSQL)
- [Node.js 24.22.1](https://nodejs.org/) (the repository pins this patched LTS release in `.nvmrc`; Node 22.23.4 or newer also meets the package engine requirement)
- **Windows users**: run all commands in **Command Prompt (cmd)**, not PowerShell. PowerShell may block npm scripts due to execution policy. Open cmd with `Win + R → cmd`.

## Set up the local development environment

### 1. Clone and install

```cmd
git clone <repo-url>
cd finance-manager

:: Install server dependencies
cd server
npm install

:: Install client dependencies (uses legacy-peer-deps via .npmrc — required for eslint-plugin-react)
cd ..\client
npm install
```

### 2. Configure environment variables

```cmd
:: Return from client/ to the project root
cd ..
copy .env.example server\.env
:: Edit server\.env if you need non-default DB credentials
```

### 3. Start PostgreSQL

This Compose file starts PostgreSQL for local development. Production uses a separate guide and Compose file.

```cmd
:: From the project root
docker compose -f docker-compose.dev.yml up -d
```

### 4. Run database migrations

```cmd
cd server
npx prisma migrate deploy
npx prisma generate
```

### 5. Start development servers

Return to the project root, then start the API and client together in one terminal:

```cmd
cd ..
npm run dev
```

The API runs at http://localhost:3000 and the Vite dev server at http://localhost:5173. Press Ctrl+C to stop both.

Open [http://localhost:5173](http://localhost:5173) in your browser.
