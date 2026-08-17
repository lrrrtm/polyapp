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
