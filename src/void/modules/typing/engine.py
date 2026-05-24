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


def compute_completion_state(
    *, elapsed_seconds: float, duration_seconds: float
) -> bool:
    return max(0.0, elapsed_seconds) >= max(0.0, duration_seconds)


def generate_word_sequence(
    word_pool: list[str] | tuple[str, ...], *, count: int, seed: int | None = None
) -> list[str]:
    if not word_pool:
        return []
    rng = Random(seed)
    return [rng.choice(word_pool) for _ in range(max(0, count))]


def _score_word(target_word: str, typed_word: str) -> tuple[int, int, bool]:
    matches = 0
    compared = min(len(target_word), len(typed_word))
    for index in range(compared):
        if target_word[index] == typed_word[index]:
            matches += 1

    incorrect = (len(target_word) - matches) + (len(typed_word) - matches)
    return matches, max(0, incorrect), typed_word == target_word


def compute_word_flow_stats(
    *,
    target_words: list[str],
    submitted_words: list[str],
    elapsed_seconds: float,
    duration_seconds: float,
) -> WordFlowStats:
    elapsed = max(0.0, elapsed_seconds)
    duration = max(0.0, duration_seconds)
    remaining = max(0.0, duration - elapsed)

    correct_words = 0
    incorrect_words = 0
    correct_characters = 0
    incorrect_characters = 0

    for index, typed_word in enumerate(submitted_words):
        target_word = target_words[index] if index < len(target_words) else ""
        word_correct_chars, word_incorrect_chars, is_exact = _score_word(
            target_word, typed_word
        )
        correct_characters += word_correct_chars
        incorrect_characters += word_incorrect_chars
        if is_exact:
            correct_words += 1
        else:
            incorrect_words += 1

    total_chars = correct_characters + incorrect_characters
    if total_chars == 0:
        accuracy_percent = 0.0
    else:
        accuracy_percent = (correct_characters / total_chars) * 100.0

    if elapsed <= 0.0:
        wpm = 0.0
    else:
        elapsed_minutes = elapsed / 60.0
        # v0.2 scoring: WPM = (correct_characters / 5) / elapsed_minutes
        wpm = (correct_characters / 5.0) / elapsed_minutes

    return WordFlowStats(
        elapsed_seconds=elapsed,
        remaining_seconds=remaining,
        duration_seconds=duration,
        correct_words=correct_words,
        incorrect_words=incorrect_words,
        correct_characters=correct_characters,
        incorrect_characters=incorrect_characters,
        accuracy_percent=round(accuracy_percent, 2),
        wpm=round(wpm, 2),
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
    """Compatibility helper for v0.1 style string scoring tests."""
    elapsed = max(0.0, elapsed_seconds)
    typed_characters = len(typed)
    compared_length = min(len(target), typed_characters)

    correct_characters = 0
    for index in range(compared_length):
        if target[index] == typed[index]:
            correct_characters += 1

    incorrect_characters = typed_characters - correct_characters

    if typed_characters == 0:
        accuracy_percent = 0.0
    else:
        accuracy_percent = (correct_characters / typed_characters) * 100

    if elapsed <= 0.0:
        wpm = 0.0
    else:
        minutes = elapsed / 60.0
        wpm = (correct_characters / 5.0) / minutes

    return TypingStats(
        elapsed_seconds=elapsed,
        typed_characters=typed_characters,
        correct_characters=correct_characters,
        incorrect_characters=incorrect_characters,
        accuracy_percent=round(accuracy_percent, 2),
        wpm=round(wpm, 2),
    )
