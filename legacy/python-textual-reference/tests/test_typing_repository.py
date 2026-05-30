from pathlib import Path

from void.db.session import init_db
from void.modules.typing.repository import (
    get_typing_summary,
    list_typing_sessions,
    save_typing_session,
)


def test_save_and_list_typing_sessions(tmp_path: Path) -> None:
    db_path = tmp_path / "void-test.db"
    init_db(db_path)

    save_typing_session(
        target_text="abc",
        typed_text="abc",
        elapsed_seconds=10.0,
        correct_characters=3,
        incorrect_characters=0,
        accuracy=100.0,
        wpm=3.6,
    )

    sessions = list_typing_sessions(limit=10)

    assert len(sessions) == 1
    assert sessions[0].target_text == "abc"
    assert sessions[0].typed_text == "abc"
    assert sessions[0].language == "pt-BR"
    assert sessions[0].mode == "word-flow-60s"


def test_typing_summary_aggregates_values(tmp_path: Path) -> None:
    db_path = tmp_path / "void-summary.db"
    init_db(db_path)

    save_typing_session(
        target_text="a",
        typed_text="a",
        elapsed_seconds=5.0,
        correct_characters=1,
        incorrect_characters=0,
        accuracy=100.0,
        wpm=12.0,
    )
    save_typing_session(
        target_text="b",
        typed_text="bx",
        elapsed_seconds=5.0,
        correct_characters=1,
        incorrect_characters=1,
        accuracy=50.0,
        wpm=8.0,
    )

    summary = get_typing_summary()

    assert summary.total_sessions == 2
    assert summary.best_wpm == 12.0
    assert summary.average_wpm == 10.0
    assert summary.average_accuracy == 75.0
