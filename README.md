# Polytech

Minimal FastAPI app with an async client for `ruz.spbstu.ru`.
It also stores SPbSTU admissions snapshots from `my.spbstu.ru` in Postgres and refreshes them every 15 minutes.

## Run

```bash
uv sync
docker compose up -d db
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

Admissions refresh can be disabled locally:

```bash
ADMISSIONS_REFRESH_ENABLED=false uv run uvicorn app.main:app --reload
```

## Test

```bash
uv run pytest
```

## Deploy

GitHub Actions runs tests, builds Docker images on GitHub runners, pushes them to GHCR, then restarts containers on the server without building there.

Required repository variable:

- `VITE_API_BASE_URL` - frontend build-time API base URL, can be empty for same-origin `/api`.

Required repository secrets:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_PATH` - directory with this repository on the server
- `DEPLOY_SSH_PRIVATE_KEY`
- `DEPLOY_SSH_PORT` - optional, defaults to `22`
- `GHCR_TOKEN` - GitHub token with `read:packages` for server-side image pull

Server `.env` should point app images to GHCR:

```bash
API_IMAGE_NAME=ghcr.io/lrrrtm/polyapp-api:latest
FRONTEND_IMAGE_NAME=ghcr.io/lrrrtm/polyapp-frontend:latest
```
