# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Mead Security — multi-tenant security staff management platform (shifts, venues, compliance, leave, invoicing). Three deployable surfaces:

- `backend/` — Django 5.2 + DRF + Channels API, served via Daphne (ASGI)
- `frontend/` — React 18 + Vite + TypeScript admin dashboard (deploys to Vercel, served at `admin.meadsecurity.co.uk`)
- `mobile/` — Expo / React Native staff app (`com.meadsecurity.staffapp`, internal distribution only — not public on App Store)
- `frontend-legacy/` — previous admin UI, kept for reference. Do not modify unless explicitly asked.

Backend deploys to Render (`mead-security-api`) from `main`. Both Vercel and Render auto-deploy from `main` — the redesign branch cutover is complete.

## Development workflow — Docker Compose

The local dev environment runs entirely through `docker/docker-compose.yml`. **Do not run `python manage.py …` or `npm run …` directly on the host** — run them inside the container so they see the right env, DB, and Redis.

```bash
cd docker
docker compose up                  # foreground, all services
docker compose up -d               # background
docker compose down                # stop
docker compose down -v             # nuke db + redis volumes
```

Services:

| Service       | URL                        | Purpose                         |
| ------------- | -------------------------- | ------------------------------- |
| web           | http://localhost:3000      | Vite dev server (HMR)           |
| api           | http://localhost:8000      | Django + Channels (Daphne)      |
| db            | localhost:5432             | Postgres 16                     |
| redis         | localhost:6379             | Redis 7 (cache + Celery broker) |
| celery-worker | —                          | Celery worker                   |
| celery-beat   | —                          | Celery beat scheduler           |
| flower        | http://localhost:5555      | Celery monitor                  |
| mailhog       | http://localhost:8025      | Captures all outbound email     |

Common in-container commands:

```bash
docker compose exec api python manage.py migrate
docker compose exec api python manage.py makemigrations
docker compose exec api python manage.py createsuperuser
docker compose exec api python manage.py shell
docker compose exec api pytest                          # all backend tests
docker compose exec api pytest api/tests/test_views.py  # single file
docker compose exec api pytest -k test_name             # single test
docker compose exec web npm run lint
```

Migrations run automatically via the `migrate` one-shot service before `api` starts. Backend code is bind-mounted, so Django autoreload picks up changes; frontend `src/`, `public/`, and config files are bind-mounted for HMR.

## Per-surface commands (if you must run outside Docker)

### Frontend (`frontend/`)
```bash
npm run dev      # Vite, host 0.0.0.0, port 3000
npm run build    # tsc --noEmit + vite build
npm run lint     # biome lint --write + tsc --noEmit
npm run format   # biome format --write
```
There is **no `npm test` script** — the frontend has no test suite. Don't claim test coverage that isn't there.

### Mobile (`mobile/`)
```bash
npm start                    # expo start (dev menu)
npm run ios / npm run android
npm test                     # jest
npm run build:ios            # EAS production build
npm run build:android:prod   # EAS production build
```
Distribution is internal-only on both stores. See `mobile/DEVELOPMENT_BUILD_SETUP.md` and `mobile/ENV_SETUP.md`. `google-services.json` is gitignored — pull from Firebase console for local dev or use EAS Secrets for builds.

### Backend (`backend/`) — only outside Docker
```bash
python manage.py runserver       # WSGI dev server (no WebSockets)
daphne -b 0.0.0.0 -p 8000 core.asgi:application   # ASGI (matches prod)
pytest                           # configured via pytest.ini / conftest
```

## Architecture

### Backend layout
```
backend/
├── core/                    # Django project (settings, urls, asgi, celery_app, db)
│   ├── settings.py          # main settings; loads .env via python-dotenv
│   └── settings/production.py
├── api/                     # primary app — users, venues, invoices, compliance, recruitment, etc.
│   ├── models.py            # User, StaffProfile, SecurityCompany, Venue, Invoice, ...
│   ├── views.py             # ~60 ViewSets — see api/urls.py for the registry
│   ├── middleware/
│   │   ├── tenant_middleware.py    # multi-tenant company isolation
│   │   ├── websocket_auth.py       # JWT auth for Channels
│   │   └── performance_middleware.py
│   ├── services/            # email + notification services
│   ├── tasks.py             # Celery tasks
│   └── consumers.py         # Channels WS consumers
├── shifts/                  # split-out app for shift + attendance models
├── leave_management/        # leave policies, balances, requests, accruals
├── finance_integrations/    # Xero / QuickBooks / Sage / Zoho OAuth + sync
└── templates/               # Django email templates
```

Routing is mounted at `/api/v1/` with sub-includes:
- `/api/v1/` → `api.urls`
- `/api/v1/shifts/` → `shifts.urls`
- `/api/v1/finance/` → `finance_integrations.urls`
- `/api/v1/leave/` → `leave_management.urls`
- `/api/v1/health/` → load-balancer health check
- `/swagger/`, `/redoc/`, `/sentry-debug/` — DEBUG-only

Key cross-cutting facts:
- `AUTH_USER_MODEL = 'api.User'` — custom user model with `StaffProfile` one-to-one
- **Multi-tenancy**: `SecurityCompany` + `UserCompanyMembership`. `TenantMiddleware` sets `request.current_company` from the `X-Company-ID` header, `company_id` URL param, or user's primary company. Querysets must filter by current_company — don't introduce cross-tenant leaks.
- **Auth**: SimpleJWT access + refresh. Refresh tokens are also accepted via httpOnly cookie (`CookieTokenRefreshView`). Social auth (Apple, Google) lives in `api/social_auth.py`.
- **Async stack**: Daphne (ASGI) + Channels + Redis channel layer. Celery uses Redis broker (`db 1`) and result backend (`db 2`), with `django_celery_beat` for scheduled jobs (see `CELERY_BEAT_SCHEDULE` in `core/settings.py`).
- **Observability**: Sentry SDK initialised in settings when `SENTRY_DSN` is set; PostHog env vars surface client-side analytics. Use the Sentry MCP tools for issue triage rather than scraping the dashboard manually.

### Frontend layout (`frontend/src/`)
```
App.tsx, main.tsx, Router.tsx
features/                # one folder per top-level domain (auth, dashboard, staff, venues, shifts, leave, ...)
components/              # shared cross-feature components
layouts/                 # AppLayout (sidebar + topbar), AuthLayout, FullScreenAppLayout
contexts/                # React Context providers (auth, etc.)
services/                # axios-based API clients
design-system/           # Card, SectionHeader, textStyles, theme tokens
lib/, utils/, types/, styles/
```

- Routing is centralised in `Router.tsx`; protected routes nest under `<AuthGuard />` → `<AppLayout />`.
- Forms: mixed — older screens use Formik + Yup, newer ones use React Hook Form + Zod. Match the surrounding code.
- UI primitives: Radix UI + Tailwind (with `tailwind-merge` / `class-variance-authority`). Icons from `lucide-react`. Maps via `react-leaflet`. **No Fluent UI** — ignore any older docs that say otherwise.
- Server state: TanStack Query (`@tanstack/react-query`).
- API base URL: in dev, `/api/*` is rewritten to the Render backend via `vercel.json`; locally the Docker `web` container talks to the `api` service on the compose network.

### Mobile layout (`mobile/src/`)
- Expo 54, React Native 0.81, React 19, new architecture enabled.
- Navigation: React Navigation v7 (stack + bottom-tabs + drawer).
- Store: Redux Toolkit + redux-persist.
- Auth tokens auto-refresh on 401 via the axios interceptor (recent fix — see commit `16a8463f`). When adding direct axios calls (not through the shared client), make sure the 401 interceptor is wired up.
- Earnings totals count admin-created drafts, not rejected invoices (see `77c31e0f`) — preserve this when touching invoice math.
- Active-tab logbooks hide signed-off entries (see `77f9abcf`).

## Conventions worth knowing

- **Don't bypass tenant scoping.** Queries in `api/`, `shifts/`, `leave_management/`, `finance_integrations/` must respect `request.current_company`. Cross-tenant data is the highest-severity bug class in this codebase.
- **Daphne, not runserver, in prod.** WebSocket consumers (`api/consumers.py`, `api/routing.py`) won't work under WSGI. Local Docker uses Daphne so dev matches prod.
- **Migrations**: always created against the docker-compose Postgres so model defaults line up with the prod schema. Run `makemigrations` inside the `api` container.
- **Email**: locally, all mail goes to MailHog at http://localhost:8025. The `From` addresses are domain-specific (`info@`, `hr@`, `payment@`) — keep using the env-driven settings rather than hardcoding senders.
- **Secrets that must not be committed**: `mobile/google-services.json` (Firebase API key — GitHub secret-scans this), all `.env` files, OAuth client secrets. The Render and EAS dashboards hold the canonical values.
- **`frontend-legacy/` is frozen.** All new admin UI work goes in `frontend/`.

## Docs and references

- `docs/` — model docs, frontend analysis, sprint notes (some may be stale; verify against code)
- `database_schema/api_endpoints_documentation.md` — API endpoint catalogue
- `backend/README.md`, `docker/README.md`, `mobile/DEVELOPMENT_BUILD_SETUP.md`, `mobile/ENV_SETUP.md`
- Swagger / ReDoc at `/swagger/` and `/redoc/` (DEBUG only)
