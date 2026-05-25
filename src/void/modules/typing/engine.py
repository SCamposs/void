from __future__ import annotations

from dataclasses import dataclass
from random import Random


@dataclass(frozen=True, slots=True)
class TypingStats:
    elapsed_seconds: float
    typed_characters: int
    correct_characters: int
    incorrect_characters: int
    accuracy_percent: float
    wpm: float


@dataclass(frozen=True, slots=True)
class SubmittedWordResult:
    expected_word: str
    typed_word: str
    is_correct_word: bool
    correct_characters: int
    incorrect_characters: int


@dataclass(frozen=True, slots=True)
class WordFlowStats:
    elapsed_seconds: float
    remaining_seconds: float
    duration_seconds: float
    correct_words: int
    incorrect_words: int
    correct_characters: int
    incorrect_characters: int
    accuracy_percent: float
    wpm: float
    is_finished: bool


def compute_elapsed_seconds(started_at: float, current_time: float) -> float:
    return max(0.0, current_time - started_at)


def compute_should_start_timer(*, started_at: float | None, current_input: str) -> bool:
    return started_at is None and current_input != ""


def compute_remaining_seconds(
    *, elapsed_seconds: float, duration_seconds: float
) -> float:
    return max(0.0, duration_seconds - max(0.0, elapsed_seconds))


def compute_completion_state(
    *, elapsed_seconds: float, duration_seconds: float
) -> bool:
    return max(0.0, elapsed_seconds) >= max(0.0, duration_seconds)


def compute_live_wpm(*, correct_characters: int, elapsed_seconds: float) -> float:
    elapsed = max(0.0, elapsed_seconds)
    if elapsed <= 0.0:
        return 0.0
    elapsed_minutes = elapsed / 60.0
    return round((correct_characters / 5.0) / elapsed_minutes, 2)


def compute_accuracy(*, correct_characters: int, incorrect_characters: int) -> float:
    total = correct_characters + incorrect_characters
    if total <= 0:
        return 100.0
    return round((correct_characters / total) * 100.0, 2)


def generate_word_sequence(
    word_pool: list[str] | tuple[str, ...], *, count: int, seed: int | None = None
) -> list[str]:
    if not word_pool:
        return []
    rng = Random(seed)
    return [rng.choice(word_pool) for _ in range(max(0, count))]


def compare_word(expected: str, typed: str) -> SubmittedWordResult:
    compared = min(len(expected), len(typed))
    correct = 0
    for index in range(compared):
        if expected[index] == typed[index]:
            correct += 1

    mismatched_positions = compared - correct
    extra_typed = max(0, len(typed) - compared)
    missing_expected = max(0, len(expected) - compared)
    incorrect = mismatched_positions + extra_typed + missing_expected
    return SubmittedWordResult(
        expected_word=expected,
        typed_word=typed,
        is_correct_word=(expected == typed),
        correct_characters=correct,
        incorrect_characters=max(0, incorrect),
    )


def compute_word_flow_stats(
    *,
    target_words: list[str],
    submitted_words: list[str],
    elapsed_seconds: float,
    duration_seconds: float,
) -> WordFlowStats:
    elapsed = max(0.0, elapsed_seconds)
    duration = max(0.0, duration_seconds)
    remaining = compute_remaining_seconds(
        elapsed_seconds=elapsed,
        duration_seconds=duration,
    )

    correct_words = 0
    incorrect_words = 0
    correct_characters = 0
    incorrect_characters = 0

    for index, typed_word in enumerate(submitted_words):
        expected_word = target_words[index] if index < len(target_words) else ""
        result = compare_word(expected_word, typed_word)
        if result.is_correct_word:
            correct_words += 1
        else:
            incorrect_words += 1
        correct_characters += result.correct_characters
        incorrect_characters += result.incorrect_characters

    accuracy_percent = compute_accuracy(
        correct_characters=correct_characters,
        incorrect_characters=incorrect_characters,
    )
    wpm = compute_live_wpm(
        correct_characters=correct_characters,
        elapsed_seconds=elapsed,
    )

    return WordFlowStats(
        elapsed_seconds=elapsed,
        remaining_seconds=remaining,
        duration_seconds=duration,
        correct_words=correct_words,
        incorrect_words=incorrect_words,
        correct_characters=correct_characters,
        incorrect_characters=incorrect_characters,
        accuracy_percent=accuracy_percent,
        wpm=wpm,
        is_finished=compute_completion_state(
            elapsed_seconds=elapsed,
            duration_seconds=duration,
        ),
    )


def compute_typing_stats(
    *,
    target: str,
    typed: str,
    elapsed_seconds: float,
) -> TypingStats:
    elapsed = max(0.0, elapsed_seconds)
    compared_length = min(len(target), len(typed))

    correct_characters = 0
    for index in range(compared_length):
        if target[index] == typed[index]:
            correct_characters += 1

    incorrect_characters = len(typed) - correct_characters

    if len(typed) <= 0:
        accuracy_percent = 0.0
    else:
        accuracy_percent = round((correct_characters / len(typed)) * 100.0, 2)

    wpm = compute_live_wpm(
        correct_characters=correct_characters,
        elapsed_seconds=elapsed,
    )

    return TypingStats(
        elapsed_seconds=elapsed,
        typed_characters=len(typed),
        correct_characters=correct_characters,
        incorrect_characters=incorrect_characters,
        accuracy_percent=accuracy_percent,
        wpm=wpm,
    )
