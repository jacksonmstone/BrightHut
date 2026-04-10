# BrightHut

Platform supporting safe-house operations for Lighthouse Sanctuary in the Philippines — shelter management, donor tracking, and impact reporting.

---

## Required Environment Variables

### Backend (ASP.NET Core)

| Variable | Description |
|---|---|
| `JWT__KEY` | JWT signing secret — minimum 32 characters, cryptographically random |
| `CONNECTIONSTRINGS__DEFAULTCONNECTION` | Azure SQL connection string (set in App Service) |

#### Local development

For local runs the backend falls back to an embedded dev-only key if `JWT__KEY` is not set. This is safe for development only. Set it explicitly to test production-like behavior:

```bash
export JWT__KEY="$(openssl rand -hex 32)"
```

Or add it to `backend/Brighthut/Brighthut/Properties/launchSettings.json` under `environmentVariables`.

#### Azure App Service (production)

In Azure Portal → App Service → **Configuration → Application settings**, add:

```
JWT__KEY = <strong random secret, 32+ chars>
```

The double underscore (`__`) maps to the nested config key `Jwt:Key` in ASP.NET Core.  
If `JWT__KEY` is missing in production the API will **refuse to start** with a clear error.

---

### Seed script (`database/seed_users.py`)

| Variable | Description |
|---|---|
| `SEED_ADMIN_PASSWORD` | Password for `admin@brighthut.org` |
| `SEED_DONOR_PASSWORD` | Password for `donor@brighthut.org` |

```bash
export SEED_ADMIN_PASSWORD="<strong password>"
export SEED_DONOR_PASSWORD="<strong password>"
python database/seed_users.py
```

The script will exit with a clear error if either variable is missing. Passwords are never stored in source code — only bcrypt hashes are written to the database.

---

## Local Setup

```bash
# Frontend
cd frontend
npm install
npm run dev

# Backend (requires .NET 10 SDK)
cd backend/Brighthut/Brighthut
dotnet run
```

The frontend defaults to the cloud API. To use a local backend, create `frontend/.env.local`:

```
VITE_API_BASE_URL=http://localhost:5287
```

---

## Secret Hygiene

- `appsettings.json` contains only non-sensitive placeholders — never real secrets.
- `.env` and `.env.*` files are gitignored (except `.env.example`).
- `appsettings.Production.json` and other environment-specific overrides are gitignored.
