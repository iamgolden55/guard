# Docker Development Environment

## Quick Start

```bash
cd docker

# Start everything (first run will build images)
docker compose up

# Start in background
docker compose up -d

# View logs
docker compose logs -f api
docker compose logs -f web

# Stop everything
docker compose down

# Reset everything (including database)
docker compose down -v
```

## Services

| Service        | URL                          | Purpose                    |
| -------------- | ---------------------------- | -------------------------- |
| **web**        | http://localhost:3000         | React frontend (Vite HMR)  |
| **api**        | http://localhost:8000         | Django API (Daphne ASGI)    |
| **mailhog**    | http://localhost:8025         | Email capture UI            |
| **flower**     | http://localhost:5555         | Celery task monitor         |
| **db**         | localhost:5432                | PostgreSQL 16               |
| **redis**      | localhost:6379                | Redis 7                     |

## First Time Setup

1. Copy environment files:
   ```bash
   cp ../backend/.env.example ../backend/.env
   cp ../frontend/.env.example ../frontend/.env
   ```

2. Start the stack:
   ```bash
   docker compose up
   ```

3. Create a superuser:
   ```bash
   docker compose exec api python manage.py createsuperuser
   ```

4. (Optional) Load initial data:
   ```bash
   docker compose exec api python manage.py loaddata initial_data
   ```

## Monitoring Setup

Set these in `docker/.env` to enable monitoring:

- **Sentry**: Get a DSN from https://sentry.io → set `SENTRY_DSN`
- **PostHog**: Get an API key from https://posthog.com → set `POSTHOG_API_KEY`

## Useful Commands

```bash
# Run Django management commands
docker compose exec api python manage.py shell
docker compose exec api python manage.py makemigrations
docker compose exec api python manage.py migrate

# Run backend tests
docker compose exec api pytest

# Run frontend tests
docker compose exec web npm test

# Rebuild after dependency changes
docker compose build api
docker compose build web

# View all captured emails
open http://localhost:8025
```
