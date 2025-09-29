# app/settings.py
import os
from dataclasses import dataclass

@dataclass
class Settings:
    session_secret: str = os.getenv("SESSION_SECRET", "change-me-please")
