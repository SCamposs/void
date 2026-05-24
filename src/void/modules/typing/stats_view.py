from __future__ import annotations

from void.modules.typing.repository import TypingSummary

_BARS = " .:-=+*#%@"


def build_wpm_sparkline(values: list[float]) -> str:
    if not values:
        return "-"

    low = min(values)
    high = max(values)
    if high == low:
        return _BARS[-1] * len(values)

    scale = (len(_BARS) - 1) / (high - low)
    chars: list[str] = []
    for value in values:
        index = int((value - low) * scale)
        chars.append(_BARS[index])
    return "".join(chars)


def format_summary_block(summary: TypingSummary) -> str:
    return (
        "SUMMARY\n"
        "-------\n"
        f"total sessions: {summary.total_sessions}\n"
        f"best wpm: {summary.best_wpm:.2f}\n"
        f"average wpm: {summary.average_wpm:.2f}\n"
        f"average accuracy: {summary.average_accuracy:.2f}%"
    )
