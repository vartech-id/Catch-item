# app/routers/api.py
from fastapi import APIRouter, Request, Form
from fastapi.responses import JSONResponse, RedirectResponse
import uuid

router = APIRouter()

# Public JSON (optional for frontend use)
@router.get("/config")
def get_config(request: Request):
    return JSONResponse(request.app.state.cfg)

@router.get("/top")
def get_top(request: Request):
    return JSONResponse(request.app.state.scores.top())

# Gameplay flow
@router.post("/start")
def start_game(request: Request, name: str = Form(...), phone: str = Form(...)):
    request.session["player"] = {"name": name.strip(), "phone": phone.strip()}
    request.session["run_id"] = str(uuid.uuid4())
    return RedirectResponse(url="/game", status_code=303)

@router.post("/finish")
def finish(request: Request, score: int = Form(...)):
    player = request.session.get("player") or {"name": "Player"}
    request.app.state.scores.push(player.get("name", "Player"), int(score))
    request.session["last_score"] = int(score)
    return RedirectResponse(url="/scoreboard", status_code=303)
