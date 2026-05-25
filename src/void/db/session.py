from __future__ import annotations

from pathlib import Path

from sqlmodel import Session, SQLModel, create_engine

_DEFAULT_DB_PATH = Path(".void") / "void.db"
_engine = None
_db_path = _DEFAULT_DB_PATH


_TYPING_SESSION_COLUMN_DEFS: tuple[tuple[str, str], ...] = (
    ("correct_words", "INTEGER NOT NULL DEFAULT 0"),
    ("incorrect_words", "INTEGER NOT NULL DEFAULT 0"),
    ("duration_seconds", "REAL NOT NULL DEFAULT 60.0"),
    ("language", "TEXT NOT NULL DEFAULT 'pt-BR'"),
    ("mode", "TEXT NOT NULL DEFAULT 'word-flow-60s'"),
)


def get_db_path() -> Path:
    return _db_path


def init_db(db_path: str | Path | None = None) -> None:
    from void.db import models  # noqa: F401

    global _engine, _db_path

    if db_path is None:
        path = _db_path
    else:
        path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    if _engine is not None and path == _db_path:
        return

    _db_path = path
    database_url = f"sqlite:///{path.resolve().as_posix()}"
    _engine = create_engine(database_url)
    SQLModel.metadata.create_all(_engine)
    _ensure_typing_session_columns()


def _ensure_typing_session_columns() -> None:
    if _engine is None:
        return

    with _engine.connect() as connection:
        existing = {
            row[1]
            for row in connection.exec_driver_sql("PRAGMA table_info(typingsession)")
        }
        for column_name, definition in _TYPING_SESSION_COLUMN_DEFS:
            if column_name in existing:
                continue
            connection.exec_driver_sql(
                f"ALTER TABLE typingsession ADD COLUMN {column_name} {definition}"
            )
        connection.commit()


def get_session() -> Session:
    if _engine is None:
        init_db()
    return Session(_engine)
