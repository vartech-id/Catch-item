# app/routers/pages.py
from datetime import datetime
from html import escape

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, RedirectResponse, Response

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

    def to_ordinal(n: int) -> str:
        if 10 <= n % 100 <= 20:
            suffix = "th"
        else:
            suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
        return f"{n}{suffix}"

    score_service = request.app.state.scores
    top_entries = score_service.top()
    decorated_top = [
        {
            "id": entry.id,
            "rank": entry.rank,
            "ordinal": to_ordinal(entry.rank),
            "name": entry.name,
            "score": entry.score,
            "created_at": entry.created_at,
            "is_player": False,
        }
        for entry in top_entries
    ]

    last_score_id_raw = request.session.get("last_score_id")
    try:
        last_score_id = int(last_score_id_raw) if last_score_id_raw is not None else None
    except (TypeError, ValueError):
        last_score_id = None
    player_entry = score_service.fetch(last_score_id) if last_score_id else None
    if player_entry:
        player_rank = {
            "id": player_entry.id,
            "rank": player_entry.rank,
            "ordinal": to_ordinal(player_entry.rank),
            "name": player_entry.name,
            "score": player_entry.score,
            "created_at": player_entry.created_at,
            "is_player": True,
        }
        if player_entry.rank > score_service.top_n:
            decorated_top.append({"ellipsis": True})
            decorated_top.append(player_rank)
        else:
            for row in decorated_top:
                if row.get("id") == player_entry.id:
                    row["is_player"] = True
                    break
    else:
        player_rank = None

    return templates.TemplateResponse(
        "scoreboard.html",
        {
            "request": request,
            "cfg": cfg,
            "player": player,
            "score": score,
            "rows": decorated_top,
            "player_entry": player_entry,
            "player_rank": player_rank,
            "page": "scoreboard",
        },
    )


@router.get("/admin")
def export_scores(request: Request):
    score_service = request.app.state.scores
    entries = score_service.all_with_rank()
    timestamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")

    table_rows = []
    if entries:
        for entry in entries:
            table_rows.append(
                "<tr>"
                f"<td>{entry.rank}</td>"
                f"<td>{escape(entry.name)}</td>"
                f"<td>{escape(entry.phone or '')}</td>"
                f"<td>{entry.score}</td>"
                f"<td>{escape(entry.created_at)}</td>"
                "</tr>"
            )
    else:
        table_rows.append(
            "<tr><td colspan='5' style='text-align:center'>No scores recorded yet.</td></tr>"
        )

    html_table = (
        "<html><head>"
        "<meta charset='utf-8'/>"
        "<style>"
        "body{font-family:Arial,Helvetica,sans-serif;}"
        "table{border-collapse:collapse;width:100%;}"
        "th,td{border:1px solid #333;padding:8px;text-align:left;}"
        "th{background:#222;color:#fff;}"
        "</style>"
        "</head><body>"
        f"<h1>Catch Item Leaderboard Export</h1>"
        f"<p>Generated at {escape(datetime.utcnow().isoformat(timespec='seconds'))} UTC</p>"
        "<table>"
        "<thead><tr>"
        "<th>Rank</th><th>Name</th><th>Phone</th><th>Score</th><th>Recorded At (UTC)</th>"
        "</tr></thead>"
        "<tbody>"
        + "".join(table_rows)
        + "</tbody></table>"
        "</body></html>"
    )

    headers = {
        "Content-Disposition": f"attachment; filename=leaderboard-{timestamp}.xls"
    }
    return Response(
        content=html_table,
        media_type="application/vnd.ms-excel",
        headers=headers,
    )
