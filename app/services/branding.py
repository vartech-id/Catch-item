# app/services/branding.py
from fastapi import FastAPI

def cfg(app: FastAPI) -> dict:
    """Quick helper to get branding/config loaded at startup."""
    return app.state.cfg  # type: ignore[attr-defined]
