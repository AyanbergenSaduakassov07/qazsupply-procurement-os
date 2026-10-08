"""Composition root. M0 exposes only liveness; auth and tenancy arrive in M1."""

from fastapi import FastAPI

app = FastAPI(title="QazSupply API", version="0.0.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
