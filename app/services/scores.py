# app/services/scores.py
from dataclasses import dataclass, field
from typing import List, Dict

@dataclass
class ScoreBoard:
    top_n: int = 10
    _rows: List[Dict] = field(default_factory=list)

    def push(self, name: str, score: int):
        self._rows.append({"name": name, "score": int(score)})
        self._rows.sort(key=lambda r: r["score"], reverse=True)
        self._rows = self._rows[: self.top_n]

    def top(self) -> List[Dict]:
        return list(self._rows)

    def clear(self):
        self._rows.clear()
