from void.modules.typing.engine import (
    SubmittedWordResult,
    TypingStats,
    WordFlowStats,
    compare_word,
    compute_accuracy,
    compute_completion_state,
    compute_elapsed_seconds,
    compute_live_wpm,
    compute_remaining_seconds,
    compute_should_start_timer,
    compute_typing_stats,
    compute_word_flow_stats,
    generate_word_sequence,
)
from void.modules.typing.screen import TypingScreen
from void.modules.typing.words import PT_BR_WORDS


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


def test_timed_mode_word_sequence_target_is_long() -> None:
    sequence = generate_word_sequence(
        PT_BR_WORDS, count=TypingScreen.WORD_COUNT, seed=9
    )

    assert len(sequence) >= 300


def test_word_sequence_generation_is_deterministic_with_seed() -> None:
    words = ["casa", "tempo", "mundo", "codigo"]

    seq_a = generate_word_sequence(words, count=12, seed=42)
    seq_b = generate_word_sequence(words, count=12, seed=42)

    assert seq_a == seq_b


def test_should_start_timer_only_on_meaningful_input() -> None:
    assert compute_should_start_timer(started_at=None, current_input="") is False
    assert compute_should_start_timer(started_at=None, current_input="c") is True
    assert compute_should_start_timer(started_at=1.0, current_input="c") is False


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
    assert stats.accuracy_percent == 100.0
    assert stats.wpm == 0.0


def test_word_flow_empty_submitted_word_is_incorrect() -> None:
    stats = compute_word_flow_stats(
        target_words=["casa"],
        submitted_words=[""],
        elapsed_seconds=10.0,
        duration_seconds=60.0,
    )

    assert stats.correct_words == 0
    assert stats.incorrect_words == 1
    assert stats.correct_characters == 0
    assert stats.incorrect_characters == 4


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


def test_compute_remaining_seconds_safe_floor() -> None:
    assert compute_remaining_seconds(elapsed_seconds=61.0, duration_seconds=60.0) == 0.0


def test_finish_state_when_duration_is_reached() -> None:
    is_finished = compute_completion_state(elapsed_seconds=60.0, duration_seconds=60.0)

    assert is_finished is True


def test_word_flow_not_finished_before_time_even_with_many_submissions() -> None:
    stats = compute_word_flow_stats(
        target_words=["casa"] * 5,
        submitted_words=["casa"] * 50,
        elapsed_seconds=59.9,
        duration_seconds=60.0,
    )

    assert stats.is_finished is False


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


def test_compare_word_different_character_rule() -> None:
    result = compare_word("casa", "caza")

    assert result.correct_characters == 3
    assert result.incorrect_characters == 1
    assert result.is_correct_word is False


def test_compare_word_extra_character_rule() -> None:
    result = compare_word("casa", "casas")

    assert result.correct_characters == 4
    assert result.incorrect_characters == 1


def test_compare_word_missing_character_rule() -> None:
    result = compare_word("casa", "cas")

    assert result.correct_characters == 3
    assert result.incorrect_characters == 1


def test_final_wpm_for_60s_equals_correct_chars_divided_by_five() -> None:
    stats = compute_word_flow_stats(
        target_words=["casa", "tempo"],
        submitted_words=["casa", "tempo"],
        elapsed_seconds=60.0,
        duration_seconds=60.0,
    )

    assert stats.correct_characters == 9
    assert stats.wpm == 1.8


def test_compute_live_wpm_avoids_division_by_zero() -> None:
    assert compute_live_wpm(correct_characters=10, elapsed_seconds=0.0) == 0.0


def test_accuracy_formula_behavior() -> None:
    assert compute_accuracy(correct_characters=8, incorrect_characters=2) == 80.0


def test_submitted_word_result_dataclass_shape() -> None:
    result = SubmittedWordResult(
        expected_word="casa",
        typed_word="caza",
        is_correct_word=False,
        correct_characters=3,
        incorrect_characters=1,
    )

    assert result.expected_word == "casa"
