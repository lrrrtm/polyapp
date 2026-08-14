# Polytech

Minimal FastAPI app with an async client for `ruz.spbstu.ru`.

## Run

```bash
uv sync
docker compose up -d db
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

## Test

```bash
uv run pytest
```
