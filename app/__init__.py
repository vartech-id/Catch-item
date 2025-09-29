# app/__init__.py
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware

from .lifespan import lifespan
from .settings import Settings
from .routers import pages, api

def create_app() -> FastAPI:
    app = FastAPI(lifespan=lifespan)

    # ----- Middleware harus dipasang SEBELUM startup -----
    settings = Settings()
    app.add_middleware(SessionMiddleware, secret_key=settings.session_secret)

    # ----- Static & Templates -----
    base_dir = Path(__file__).resolve().parents[1]
    app.mount("/static", StaticFiles(directory=str(base_dir / "static")), name="static")
    app.mount("/assets", StaticFiles(directory=str(base_dir / "assets")), name="assets")
    app.state.templates = Jinja2Templates(directory=str(base_dir / "templates"))

    # ----- Routers -----
    app.include_router(pages.router, tags=["pages"])
    app.include_router(api.router, tags=["api"])

    return app
