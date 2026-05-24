from void.modules.typing.engine import (
    TypingStats,
    compute_elapsed_seconds,
    compute_typing_stats,
)


def test_perfect_typing() -> None:
    target = "void shell"
    typed = "void shell"

    stats = compute_typing_stats(target=target, typed=typed, elapsed_seconds=30.0)

    assert stats.correct_characters == 10
    assert stats.incorrect_characters == 0
    assert stats.typed_characters == 10
    assert stats.accuracy_percent == 100.0
    assert stats.wpm == 4.0


def test_partially_incorrect_typing() -> None:
    target = "void shell"
    typed = "voit shellz"

    stats = compute_typing_stats(target=target, typed=typed, elapsed_seconds=30.0)

    assert stats.correct_characters == 9
    assert stats.incorrect_characters == 2
    assert stats.typed_characters == 11
    assert stats.accuracy_percent == 81.82
    assert stats.wpm == 3.6


def test_empty_input() -> None:
    stats = compute_typing_stats(target="void", typed="", elapsed_seconds=15.0)

    assert stats.correct_characters == 0
    assert stats.incorrect_characters == 0
    assert stats.typed_characters == 0
    assert stats.accuracy_percent == 0.0
    assert stats.wpm == 0.0


def test_zero_elapsed_time_is_safe() -> None:
    stats = compute_typing_stats(target="void", typed="void", elapsed_seconds=0.0)

    assert stats.correct_characters == 4
    assert stats.wpm == 0.0


def test_wpm_calculation_sanity() -> None:
    stats = compute_typing_stats(
        target="alpha beta gamma",
        typed="alpha beta gamma",
        elapsed_seconds=60.0,
    )

    assert stats.correct_characters == 16
    assert stats.wpm == 3.2


def test_near_zero_elapsed_time_is_safe() -> None:
    stats = compute_typing_stats(target="void", typed="void", elapsed_seconds=0.0001)

    assert stats.correct_characters == 4
    assert stats.wpm > 0.0


def test_elapsed_seconds_never_negative() -> None:
    elapsed = compute_elapsed_seconds(started_at=10.0, current_time=8.0)

    assert elapsed == 0.0


def test_stats_dataclass_shape() -> None:
    stats = TypingStats(
        elapsed_seconds=1.0,
        typed_characters=2,
        correct_characters=2,
        incorrect_characters=0,
        accuracy_percent=100.0,
        wpm=24.0,
    )

    assert stats.elapsed_seconds == 1.0
