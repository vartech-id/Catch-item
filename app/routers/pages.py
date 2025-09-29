# app/routers/pages.py
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, RedirectResponse

router = APIRouter()

@router.get("/", response_class=HTMLResponse)
def welcome(request: Request):
    templates = request.app.state.templates
    cfg = request.app.state.cfg
    return templates.TemplateResponse(
        "welcome.html",
        {"request": request, "cfg": cfg, "page": "welcome"},
    )

@router.get("/game", response_class=HTMLResponse)
def game(request: Request):
    templates = request.app.state.templates
    cfg = request.app.state.cfg
    player = request.session.get("player")
    if not player:
        return RedirectResponse(url="/", status_code=303)
    return templates.TemplateResponse(
        "game.html",
        {"request": request, "cfg": cfg, "player": player, "page": "game"},
    )

@router.get("/scoreboard", response_class=HTMLResponse)
def scoreboard(request: Request):
    templates = request.app.state.templates
    cfg = request.app.state.cfg
    player = request.session.get("player") or {"name": "Player"}
    score = request.session.get("last_score", 0)
    top = request.app.state.scores.top()
    return templates.TemplateResponse(
        "scoreboard.html",
        {
            "request": request,
            "cfg": cfg,
            "player": player,
            "score": score,
            "top": top,
            "page": "scoreboard",
        },
    )
