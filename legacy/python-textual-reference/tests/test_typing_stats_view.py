from void.modules.typing.stats_view import build_wpm_sparkline, format_summary_block
from void.modules.typing.repository import TypingSummary


def test_build_wpm_sparkline_empty() -> None:
    result = build_wpm_sparkline([])

    assert result == "-"


def test_build_wpm_sparkline_scales_values() -> None:
    result = build_wpm_sparkline([10.0, 20.0, 30.0, 40.0])

    assert len(result) == 4
    assert result[0] <= result[-1]


def test_format_summary_block_contains_metrics() -> None:
    summary = TypingSummary(
        total_sessions=3,
        best_wpm=42.5,
        average_wpm=31.2,
        average_accuracy=88.4,
    )

    text = format_summary_block(summary)

    assert "total sessions: 3" in text
    assert "best wpm: 42.50" in text
    assert "average wpm: 31.20" in text
    assert "average accuracy: 88.40%" in text
