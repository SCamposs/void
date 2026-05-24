from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class TypingStats:
    elapsed_seconds: float
    typed_characters: int
    correct_characters: int
    incorrect_characters: int
    accuracy_percent: float
    wpm: float


def compute_elapsed_seconds(started_at: float, current_time: float) -> float:
    return max(0.0, current_time - started_at)


def compute_typing_stats(
    *,
    target: str,
    typed: str,
    elapsed_seconds: float,
) -> TypingStats:
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
