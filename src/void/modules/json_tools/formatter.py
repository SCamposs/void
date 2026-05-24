from __future__ import annotations

import json


class JsonFormatError(ValueError):
    """Raised when JSON input cannot be parsed."""


def _parse_json(text: str) -> object:
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise JsonFormatError(
            f"Invalid JSON: {exc.msg} (line {exc.lineno}, col {exc.colno})"
        ) from exc


def format_json(text: str) -> str:
    parsed = _parse_json(text)
    return json.dumps(parsed, indent=2, sort_keys=True)


def minify_json(text: str) -> str:
    parsed = _parse_json(text)
    return json.dumps(parsed, separators=(",", ":"), sort_keys=True)


def is_valid_json(text: str) -> tuple[bool, str | None]:
    try:
        _parse_json(text)
    except JsonFormatError as exc:
        return False, str(exc)
    return True, None
