# app/lifespan.py
from contextlib import asynccontextmanager
from pathlib import Path
import json
from fastapi import FastAPI
from .services.scores import ScoreStore

DEFAULT_CFG = {
    "branding": {
        "backgrounds": {
            "welcome": "/assets/backgrounds/welcome.png",
            "game": "/assets/backgrounds/game.png",
            "scoreboard": "/assets/backgrounds/scoreboard.png",
        },
        "logo": "/assets/logo/event-logo.png",
    },
    "graphics": {"cart": "/assets/cart/cart.svg", "items": ["/assets/items/item1.png"]},
    "theme": {"colors": {"primary": "#FFD700", "text": "#FFFFFF", "hudBg": "rgba(0,0,0,0.35)"},
              "layout": {"safeMargin": 24}},
    "gameplay": {"mode": "timer", "duration": 35, "spawnRate": 0.8, "speed": 1.0},
    "ux": {"countdown": True, "autoReturnSeconds": 12, "sfx": False},
}

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: load config.json (fallback ke DEFAULT_CFG bila kosong/invalid)
    base_dir = Path(__file__).resolve().parents[1]
    cfg_path = base_dir / "config.json"

    cfg = None
    try:
        if cfg_path.exists() and cfg_path.stat().st_size > 0:
            with cfg_path.open("r", encoding="utf-8") as f:
                cfg = json.load(f)
        else:
            print(f"[WARN] config.json tidak ditemukan/ kosong: {cfg_path}")
    except Exception as e:
        print(f"[ERROR] Gagal parse config.json ({cfg_path}): {e}")

    app.state.cfg = cfg or DEFAULT_CFG
    if cfg is None:
        print("[INFO] Menggunakan DEFAULT_CFG (silakan lengkapi config.json Anda).")

    # Services
    data_dir = base_dir / "data"
    app.state.scores = ScoreStore(db_path=data_dir / "scores.db", top_n=10)

    try:
        yield
    finally:
        pass
