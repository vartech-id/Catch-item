# app/services/scores.py
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List, Optional
import sqlite3


@dataclass
class ScoreEntry:
    id: int
    name: str
    phone: Optional[str]
    score: int
    created_at: str
    rank: int


class ScoreStore:
    """Persistence layer for leaderboard scores backed by SQLite."""

    def __init__(self, db_path: Path, top_n: int = 10):
        self.db_path = Path(db_path)
        self.top_n = top_n
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS scores (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    phone TEXT,
                    score INTEGER NOT NULL,
                    created_at TEXT NOT NULL
                )
                """
            )
            self._ensure_columns(conn)
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_scores_order
                ON scores (score DESC, created_at ASC, id ASC)
                """
            )
            conn.commit()

    def _ensure_columns(self, conn: sqlite3.Connection) -> None:
        rows = conn.execute("PRAGMA table_info(scores)").fetchall()
        cols = {row["name"] for row in rows}

        # Legacy column name -> rename to the new convention
        if "name" not in cols:
            if "player_name" in cols:
                conn.execute("ALTER TABLE scores RENAME COLUMN player_name TO name")
            else:
                conn.execute("ALTER TABLE scores ADD COLUMN name TEXT")
            conn.commit()
            cols.add("name")

        # Optional phone contact info for exports
        if "phone" not in cols:
            conn.execute("ALTER TABLE scores ADD COLUMN phone TEXT")
            conn.commit()
            cols.add("phone")

        # Ensure timestamp column exists and is populated
        if "created_at" not in cols:
            now = datetime.utcnow().isoformat(timespec="seconds")
            conn.execute("ALTER TABLE scores ADD COLUMN created_at TEXT")
            conn.execute(
                "UPDATE scores SET created_at = ? WHERE created_at IS NULL", (now,)
            )
            conn.commit()

    def push(self, name: str, score: int, phone: Optional[str] = None) -> int:
        clean_name = (name or "Player").strip() or "Player"
        clean_phone = phone.strip() if isinstance(phone, str) else None
        ts = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        with self._connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO scores (name, phone, score, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (clean_name, clean_phone, int(score), ts),
            )
            conn.commit()
            return int(cur.lastrowid)

    def top(self, limit: Optional[int] = None) -> List[ScoreEntry]:
        limit = limit or self.top_n
        rows = self._ordered(limit=limit)
        return list(rows)

    def fetch(self, score_id: int) -> Optional[ScoreEntry]:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT id, name, phone, score, created_at
                FROM scores
                WHERE id = ?
                """,
                (score_id,),
            ).fetchone()
        if row is None:
            return None
        rank = self._calculate_rank(row["score"], row["created_at"], row["id"])
        return self._row_to_entry(row, rank)

    def rank_for(self, score_id: int) -> Optional[int]:
        entry = self.fetch(score_id)
        return entry.rank if entry else None

    def all_with_rank(self) -> List[ScoreEntry]:
        return list(self._ordered())

    # Internal helpers -------------------------------------------------
    def _ordered(self, limit: Optional[int] = None) -> Iterable[ScoreEntry]:
        query = """
            SELECT id, name, phone, score, created_at
            FROM scores
            ORDER BY score DESC, created_at ASC, id ASC
        """
        params: tuple = ()
        if limit is not None:
            query += " LIMIT ?"
            params = (limit,)
        with self._connect() as conn:
            rows = conn.execute(query, params).fetchall()
        entries: List[ScoreEntry] = []
        for idx, row in enumerate(rows, start=1):
            entries.append(self._row_to_entry(row, idx))
        return entries

    def _row_to_entry(self, row: sqlite3.Row, rank: int) -> ScoreEntry:
        return ScoreEntry(
            id=int(row["id"]),
            name=str(row["name"]),
            phone=str(row["phone"]) if row["phone"] is not None else None,
            score=int(row["score"]),
            created_at=str(row["created_at"]),
            rank=rank,
        )

    def _calculate_rank(self, score: int, created_at: str, row_id: int) -> int:
        with self._connect() as conn:
            better_count = conn.execute(
                """
                SELECT COUNT(*) FROM scores
                WHERE
                    score > ?
                    OR (
                        score = ?
                        AND (
                            created_at < ?
                            OR (created_at = ? AND id < ?)
                        )
                    )
                """,
                (score, score, created_at, created_at, row_id),
            ).fetchone()[0]
        return int(better_count) + 1
