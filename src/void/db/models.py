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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
