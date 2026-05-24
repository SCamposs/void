from __future__ import annotations

from dataclasses import dataclass

from sqlmodel import desc, select

from void.db.models import TypingSession
from void.db.session import get_session, init_db


@dataclass(frozen=True, slots=True)
class TypingSummary:
    total_sessions: int
    best_wpm: float
    average_wpm: float
    average_accuracy: float


def save_typing_session(
    *,
    target_text: str,
    typed_text: str,
    elapsed_seconds: float,
    correct_characters: int,
    incorrect_characters: int,
    accuracy: float,
    wpm: float,
) -> TypingSession:
    init_db()
    item = TypingSession(
        target_text=target_text,
        typed_text=typed_text,
        elapsed_seconds=elapsed_seconds,
        correct_characters=correct_characters,
        incorrect_characters=incorrect_characters,
        accuracy=accuracy,
        wpm=wpm,
    )
    with get_session() as session:
        session.add(item)
        session.commit()
        session.refresh(item)
        return item


def list_typing_sessions(limit: int = 10) -> list[TypingSession]:
    init_db()
    max_items = max(1, limit)
    statement = (
        select(TypingSession).order_by(desc(TypingSession.created_at)).limit(max_items)
    )
    with get_session() as session:
        return list(session.exec(statement).all())


def get_typing_summary() -> TypingSummary:
    init_db()
    with get_session() as session:
        sessions = list(session.exec(select(TypingSession)).all())

    if not sessions:
        return TypingSummary(0, 0.0, 0.0, 0.0)

    total = len(sessions)
    best_wpm = max(item.wpm for item in sessions)
    average_wpm = sum(item.wpm for item in sessions) / total
    average_accuracy = sum(item.accuracy for item in sessions) / total
    return TypingSummary(
        total_sessions=total,
        best_wpm=round(best_wpm, 2),
        average_wpm=round(average_wpm, 2),
        average_accuracy=round(average_accuracy, 2),
    )
