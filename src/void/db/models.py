from __future__ import annotations

from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


class TypingSession(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    target_text: str
    typed_text: str
    elapsed_seconds: float
    correct_characters: int
    incorrect_characters: int
    accuracy: float
    wpm: float
    correct_words: int = 0
    incorrect_words: int = 0
    duration_seconds: float = 60.0
    language: str = "pt-BR"
    mode: str = "word-flow-60s"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
