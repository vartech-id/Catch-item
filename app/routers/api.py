# app/routers/api.py
from fastapi import APIRouter, Request, Form
from fastapi.responses import JSONResponse, RedirectResponse
import uuid
import json
from pathlib import Path

router = APIRouter()

# Public JSON (optional for frontend use)
@router.get("/config")
def get_config(request: Request):
    try:
        base = Path(__file__).resolve().parents[2]
        with (base / "config.json").open("r", encoding="utf-8") as f:
            data = json.load(f)
        return JSONResponse(data, headers={"Cache-Control": "no-store"})
    except Exception:
        return JSONResponse(request.app.state.cfg, headers={"Cache-Control": "no-store"})


@router.post("/admin/save-config")
async def save_config(request: Request, config: str = Form(...)):
    try:
        parsed = json.loads(config)
        base = Path(__file__).resolve().parents[2]
        with (base / "config.json").open("w", encoding="utf-8") as f:
            json.dump(parsed, f, indent=2, ensure_ascii=False)
        request.app.state.cfg = parsed
        return RedirectResponse(url="/admin?saved=1", status_code=303)
    except json.JSONDecodeError as e:
        return JSONResponse({"error": f"Invalid JSON: {e}"}, status_code=400)

@router.get("/top")
def get_top(request: Request):
    scores = request.app.state.scores.top()
    payload = [
        {
            "id": entry.id,
            "name": entry.name,
            "score": entry.score,
            "rank": entry.rank,
            "created_at": entry.created_at,
        }
        for entry in scores
    ]
    return JSONResponse(payload)

# Gameplay flow
@router.post("/start")
def start_game(request: Request, name: str = Form(...), phone: str = Form(...)):
    request.session["player"] = {"name": name.strip(), "phone": phone.strip()}
    request.session["run_id"] = str(uuid.uuid4())
    return RedirectResponse(url="/game", status_code=303)

@router.post("/finish")
def finish(request: Request, score: int = Form(...)):
    player = request.session.get("player") or {"name": "Player"}
    score_id = request.app.state.scores.push(
        player.get("name", "Player"),
        int(score),
        player.get("phone"),
    )
    request.session["last_score"] = int(score)
    request.session["last_score_id"] = score_id
    return RedirectResponse(url="/scoreboard", status_code=303)
