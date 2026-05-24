from void.modules.typing.engine import (
    TypingStats,
    WordFlowStats,
    compute_completion_state,
    compute_elapsed_seconds,
    compute_typing_stats,
    compute_word_flow_stats,
    generate_word_sequence,
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


def test_word_sequence_generation_length() -> None:
    words = ["casa", "tempo", "mundo", "codigo"]

    sequence = generate_word_sequence(words, count=20, seed=7)

    assert len(sequence) == 20
    assert set(sequence).issubset(set(words))


def test_word_flow_exact_match_word() -> None:
    stats = compute_word_flow_stats(
        target_words=["casa", "tempo"],
        submitted_words=["casa"],
        elapsed_seconds=10.0,
        duration_seconds=60.0,
    )

    assert stats.correct_words == 1
    assert stats.incorrect_words == 0
    assert stats.correct_characters == 4
    assert stats.incorrect_characters == 0


def test_word_flow_incorrect_word_and_missing_chars() -> None:
    stats = compute_word_flow_stats(
        target_words=["casa"],
        submitted_words=["cas"],
        elapsed_seconds=10.0,
        duration_seconds=60.0,
    )

    assert stats.correct_words == 0
    assert stats.incorrect_words == 1
    assert stats.correct_characters == 3
    assert stats.incorrect_characters == 1


def test_word_flow_extra_characters_count_as_incorrect() -> None:
    stats = compute_word_flow_stats(
        target_words=["dia"],
        submitted_words=["diass"],
        elapsed_seconds=10.0,
        duration_seconds=60.0,
    )

    assert stats.correct_words == 0
    assert stats.correct_characters == 3
    assert stats.incorrect_characters == 2


def test_word_flow_empty_input() -> None:
    stats = compute_word_flow_stats(
        target_words=["mundo"],
        submitted_words=[],
        elapsed_seconds=0.0,
        duration_seconds=60.0,
    )

    assert stats.correct_words == 0
    assert stats.incorrect_words == 0
    assert stats.correct_characters == 0
    assert stats.incorrect_characters == 0
    assert stats.accuracy_percent == 0.0
    assert stats.wpm == 0.0


def test_word_flow_wpm_zero_time_safety() -> None:
    stats = compute_word_flow_stats(
        target_words=["codigo"],
        submitted_words=["codigo"],
        elapsed_seconds=0.0,
        duration_seconds=60.0,
    )

    assert stats.wpm == 0.0


def test_remaining_time_calculation() -> None:
    stats = compute_word_flow_stats(
        target_words=["projeto"],
        submitted_words=["projeto"],
        elapsed_seconds=12.0,
        duration_seconds=60.0,
    )

    assert stats.remaining_seconds == 48.0


def test_finish_state_when_duration_is_reached() -> None:
    is_finished = compute_completion_state(elapsed_seconds=60.0, duration_seconds=60.0)

    assert is_finished is True


def test_word_flow_stats_dataclass_shape() -> None:
    stats = WordFlowStats(
        elapsed_seconds=1.0,
        remaining_seconds=59.0,
        duration_seconds=60.0,
        correct_words=1,
        incorrect_words=0,
        correct_characters=5,
        incorrect_characters=0,
        accuracy_percent=100.0,
        wpm=60.0,
        is_finished=False,
    )

    assert stats.duration_seconds == 60.0
