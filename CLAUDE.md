# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Mead Security — multi-tenant security staff management platform (shifts, attendance, venues, compliance, leave, payroll, invoicing). Four surfaces:

- `backend/` — Django 5.2 + DRF + Channels API, served by Daphne (ASGI). Deploys to Render (`mead-security-api`) from `main`.
- `frontend/` — React 18 + Vite + TypeScript admin dashboard. Deploys to Vercel from `main`, served at `admin.meadsecurity.co.uk`.
- `mobile/` — Expo / React Native staff app (`com.meadsecurity.staffapp`). Internal distribution only on both stores.
- `frontend-legacy/` — previous admin UI, **frozen**. Reference only; all new admin work goes in `frontend/`.

`project/`, `costs/`, `monitoring/`, `temp_backup/`, `browser-tools-mcp/` are historical/support directories — not part of any deployed surface.

## Development workflow — Docker Compose

Local dev runs entirely through `docker/docker-compose.yml`. **Do not run `python manage.py …` or `npm run …` on the host** — run them inside the container so they see the right env, DB, and Redis.

First-time setup:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env      # both are required by compose `env_file:`
# docker/.env must define DJANGO_SECRET_KEY and FLOWER_PASSWORD — compose refuses to start without them
```

```bash
cd docker
docker compose up            # foreground, all services
docker compose up -d         # background
docker compose down          # stop
docker compose down -v       # nuke db + redis volumes
docker compose build api     # rebuild after dependency changes
```

| Service       | URL                   | Purpose                             |
| ------------- | --------------------- | ----------------------------------- |
| web           | http://localhost:3000 | Vite dev server (HMR)               |
| api           | http://localhost:8000 | Django + Channels via Daphne        |
| db            | localhost:5432        | Postgres 16                         |
| redis         | localhost:6379        | Redis 7 (channel layer + Celery)    |
| celery-worker | —                     | Celery worker                       |
| celery-beat   | —                     | Celery beat (DatabaseScheduler)     |
| flower        | http://localhost:5555 | Celery monitor (basic auth)         |
| mailhog       | http://localhost:8025 | Captures all outbound email         |

Migrations run automatically via the one-shot `migrate` service before `api` starts. `backend/` is bind-mounted whole (Django autoreload); the frontend mounts only `src/`, `public/`, and config files.

```bash
docker compose exec api python manage.py migrate
docker compose exec api python manage.py makemigrations
docker compose exec api python manage.py createsuperuser
docker compose exec api python manage.py shell
docker compose exec web npm run lint
```

## Tests

### Backend
There is **no `pytest.ini`, `conftest.py`, or `pyproject.toml`** — pytest-django works only because `DJANGO_SETTINGS_MODULE=core.settings` is set in the container environment. Consequences:

- **Never run a bare `pytest` from `backend/`.** It collects the ~24 legacy `backend/test_*.py` files, which are standalone scripts that call `django.setup()` and hit the dev database at import time — not real tests. Always scope to a path:
  ```bash
  docker compose exec api pytest api/tests/ shifts/ shifts/tests.py leave_management/ -q
  docker compose exec api pytest api/tests/test_payroll_math.py     # single file
  docker compose exec api pytest -k test_name                        # single test
  ```
- **`shifts/tests.py` must be named explicitly.** pytest's default `python_files` patterns (`test_*.py`, `*_test.py`) don't match the bare name `tests.py`, so `pytest shifts/` silently skips the largest suite in that app (bulk-create, digest, manual check-in). Same trap applies to `api/tests.py`, `leave_management/tests.py`, `finance_integrations/tests.py`.
- **~51 tests fail on a clean checkout**, concentrated in `api/test_compliance_api.py`, `api/test_regional_compliance_api.py`, `api/tests/test_recruitment_api.py`, `api/tests/test_recruitment_conversion.py`, `api/test_onboarding_api.py`, `api/tests/test_views.py`, `api/test_multi_tenant_performance.py`. `api/tests/test_optimized_reporting_pipeline.py` errors at import (`psutil` missing). Before concluding a change broke something, baseline the *same files* on the pre-change commit and compare per-file counts, not totals.

### Frontend
**No test suite and no `npm test` script.** (`docker/README.md` still advertises `docker compose exec web npm test` — that's stale.) Don't claim frontend test coverage. Verification is `npm run lint` (biome + `tsc --noEmit`) and `npm run build`.

### Mobile
`npm test` runs Jest (`mobile/jest.config.js`).

## Per-surface commands (outside Docker)

**Frontend (`frontend/`)** — `npm run dev` (Vite, 0.0.0.0:3000) · `npm run build` (`tsc --noEmit && vite build`) · `npm run lint` (`biome lint --write && tsc --noEmit`) · `npm run format`.

**Mobile (`mobile/`)** — `npm start` · `npm run ios` / `npm run android` · `npm test` · `npm run build:ios` / `npm run build:android:prod` (EAS). Use `./switch-env.sh local` (auto-detects your LAN IP) or `./switch-env.sh prod` to point the app at a local API vs Render. See `mobile/DEVELOPMENT_BUILD_SETUP.md` and `mobile/ENV_SETUP.md`.

**Backend (`backend/`)** — `daphne -b 0.0.0.0 -p 8000 core.asgi:application` matches prod. `python manage.py runserver` is WSGI and **will not serve WebSockets**. Dependencies live in `backend/requirements/{base,dev,prod}.txt` (`backend/requirements.txt` is the pinned Render install); the **root `requirements.txt` is vestigial and stale** — ignore it.

## Architecture

### Backend
```
backend/
├── core/                 # settings.py (main), settings/production.py, asgi.py, celery_app.py, db.py
├── api/                  # the app — 58 models, ~9.7k-line views.py, ~60 ViewSets
│   ├── models.py         # ALL models for every app live here
│   ├── views.py          # main ViewSets;  views_billing.py holds invoicing/billing
│   ├── serializers.py    # + serializers_billing.py, serializers_frontend.py
│   ├── middleware/       # tenant_middleware.py, websocket_auth.py, performance_middleware.py
│   ├── consumers.py      # Channels consumers;  routing.py → /ws/reports/, /ws/notifications/
│   ├── tasks.py          # Celery tasks (+ optimized_tasks.py)
│   ├── services/         # email + notification services
│   ├── utils/            # PDF/report/export generators, shift_validators.py
│   └── management/commands/   # audit_stranded_shifts, process_auto_checkouts, simulate_mead_history, …
├── shifts/               # views/serializers/urls only — NO models of its own
├── leave_management/     # policies, balances, requests, accruals (has its own models)
├── finance_integrations/ # Xero / QuickBooks / Sage / Zoho OAuth + sync (providers/, scoping.py)
└── templates/            # Django email templates
```

**Models are centralised in `api/models.py`.** `shifts/models.py` is three lines that re-export `Shift` and `ShiftStatusHistory` from `api.models` to keep the Django app structure valid. Add shift/attendance/venue/user/invoice models to `api/models.py` and migrate the `api` app — *not* `shifts`. `leave_management` and `finance_integrations` do own their models.

Routing, all under `/api/v1/`: `api.urls` at the root, plus `shifts/`, `finance/`, `leave/`, and `health/` (Render health check). `/swagger/`, `/redoc/`, `/sentry-debug/` are DEBUG-only.

### Multi-tenancy — the highest-severity bug class here
`SecurityCompany` + `UserCompanyMembership` scope everything. `TenantMiddleware` reads `X-Company-ID` (header), then `company_id` (URL param), then the user's primary company, and sets `request.current_company` / `request.company_id`.

**But the middleware sits after `AuthenticationMiddleware` and before DRF authenticates**, so on a JWT request `request.user` is usually anonymous at middleware time and `request.current_company` ends up `None`. Every view therefore resolves the company itself with a two-step helper — prefer the middleware value, fall back to the user's active membership:

- `api/views.py:635` `get_user_company(self, request)` — redefined per-ViewSet (also at `:1728`, `:2942`); copy the nearest one rather than inventing a new resolution path.
- `api/views_billing.py:58` `_current_company(request)` — module-level equivalent.

New querysets must go through one of these and filter by the resolved company. Never trust `request.current_company` alone, and never write an unscoped queryset in `api/`, `shifts/`, `leave_management/`, or `finance_integrations/`.

### Other cross-cutting backend facts
- `AUTH_USER_MODEL = 'api.User'` (custom user, `StaffProfile` one-to-one).
- **Auth**: SimpleJWT access + refresh, with refresh also accepted via httpOnly cookie (`CookieTokenRefreshView`). Social auth (Apple, Google) in `api/social_auth.py`. WebSocket JWT auth in `api/middleware/websocket_auth.py`.
- **Celery**: Redis broker on db 1, results on db 2; scheduled jobs in `CELERY_BEAT_SCHEDULE` (`core/settings.py`) — auto-checkouts and missed capacity checks every 5 min, attendance exceptions every 15 min, weekly/monthly payroll runs, leave accruals, SIA licence expiry.
- **Deploy**: `backend/build.sh` runs collectstatic, then waits up to 180s for Postgres, then migrates. Migrations live in the build **on purpose** — Render silently drops `preDeployCommand` for this service, and a sleeping DB used to abort the build and 502 the API. Don't "fix" this by moving them.
- **Observability**: Sentry when `SENTRY_DSN` is set; PostHog env vars drive client analytics. Use the Sentry MCP tools for issue triage.
- `render.yaml` has drifted from the live Render services — treat the dashboard as authoritative for IDs and plans.

### Frontend (`frontend/src/`)
`App.tsx`, `main.tsx`, `Router.tsx` at the root; `features/` (one folder per domain: attendance, auth, capacity-logs, compliance, dashboard, incidents, integrations, invoices, leave, payroll, profile, recruitment, scheduling, settings, staff, venues), `components/`, `layouts/`, `contexts/` (Auth, Accent), `services/` (37 axios clients), `design-system/` (tokens, primitives, charts, Icon), `lib/`, `utils/`, `types/`, `styles/`.

- Routing is centralised in `Router.tsx`. Public routes sit under `<AuthLayout />`; protected routes nest under `<AuthGuard />` and then either `<AppLayout />` (sidebar + topbar) or `<FullScreenAppLayout />` for pages that render their own header. Most feature pages use the latter.
- **Auth is hybrid** (`services/api.ts`): `withCredentials: true` for the httpOnly refresh cookie *and* a `Bearer` header from `localStorage.access_token`, because Safari/ITP blocks the cross-site cookie on the Vercel→Render hop. Keep both. A refresh lock (`isRefreshing` / `refreshPromise`) serialises concurrent 401 retries — new axios instances must reuse this client rather than rolling their own interceptors.
- API base URL: locally Vite proxies `/api` and `/ws` to `API_URL` (the compose `api` service); in prod `vercel.json` rewrites `/api/*` to `https://mead-security-api.onrender.com`.
- Server state via TanStack Query. UI is Radix + Tailwind (`tailwind-merge`, `class-variance-authority`), icons from `lucide-react`, maps via `react-leaflet`, DnD via `@dnd-kit`. **No Fluent UI** — ignore older docs saying otherwise.
- Forms are mixed: older screens use Formik + Yup, newer ones React Hook Form + Zod. Match the surrounding file.
- `@/` aliases `src/`.

### Mobile (`mobile/src/`)
Expo 54, React Native 0.81, React 19, new architecture on. React Navigation v7 (stack + bottom-tabs + drawer), Redux Toolkit + redux-persist, `app.config.js` (not `app.json`) for Expo config.

- Tokens auto-refresh on 401 via the axios interceptor. When adding a direct axios call outside the shared client, wire the 401 interceptor up.
- Earnings totals count admin-created drafts and exclude rejected invoices — preserve this when touching invoice math.
- The active-tab logbook list hides signed-off entries.

## Conventions

- **Commits**: conventional, lowercase, scoped by domain — `fix(attendance): let a manager close a shift that ran past midnight`, `feat(shifts): …`, `chore(ios): …`. Subject lines read as sentences describing behaviour, not file lists.
- **Migrations**: generate them inside the `api` container so defaults line up with the prod Postgres schema.
- **Email**: dev mail lands in MailHog. Senders are env-driven and role-specific (`DEFAULT_FROM_EMAIL`, `HR_FROM_EMAIL`, `INFO_FROM_EMAIL`, `PAYMENT_FROM_EMAIL`) — don't hardcode addresses.
- **Never commit**: `mobile/google-services.json` (present on disk, gitignored — GitHub secret-scans the API key; use EAS Secrets for builds), any `.env`, OAuth client secrets. Render and EAS hold the canonical values.

## Docs and references

`docs/` (attendance source-of-truth, payroll–invoicing integration, model docs, mobile build knowledge) · `database_schema/api_endpoints_documentation.md` · `backend/README.md`, `docker/README.md`, `mobile/DEVELOPMENT_BUILD_SETUP.md`, `mobile/ENV_SETUP.md` · Swagger/ReDoc at `/swagger/` and `/redoc/` (DEBUG only). Some docs are stale — verify against code.
