from void.modules.json_tools.formatter import (
    JsonFormatError,
    format_json,
    is_valid_json,
    minify_json,
)


def test_format_json_pretty_prints() -> None:
    raw = '{"name":"void","enabled":true}'

    result = format_json(raw)

    assert result == '{\n  "enabled": true,\n  "name": "void"\n}'


def test_minify_json_removes_whitespace() -> None:
    raw = '{\n  "name": "void",\n  "enabled": true\n}'

    result = minify_json(raw)

    assert result == '{"enabled":true,"name":"void"}'


def test_validate_json_reports_invalid_input() -> None:
    valid, message = is_valid_json('{"ok": true}')
    assert valid is True
    assert message is None

    valid, message = is_valid_json('{"ok": }')
    assert valid is False
    assert message is not None


def test_format_json_raises_error_for_invalid_input() -> None:
    try:
        format_json('{"broken": }')
    except JsonFormatError as exc:
        assert "Invalid JSON" in str(exc)
    else:
        raise AssertionError("Expected JsonFormatError for invalid JSON input")
