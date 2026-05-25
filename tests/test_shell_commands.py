from void.ui.commands import execute_shell_command


def test_open_json_command_routes_to_module() -> None:
    command = execute_shell_command("open json")

    assert command.action == "open"
    assert command.target == "json-tools"
    assert command.message == "Opening JSON Tools"


def test_open_shell_command_routes_to_shell_module() -> None:
    command = execute_shell_command("open shell")

    assert command.action == "open"
    assert command.target == "home"
    assert command.message == "Opening SHELL"


def test_modules_command_returns_listing_action() -> None:
    command = execute_shell_command("modules")

    assert command.action == "modules"
    assert command.target is None
    assert command.message.startswith("Modules:")


def test_quit_command_routes_to_quit_action() -> None:
    command = execute_shell_command("quit")

    assert command.action == "quit"
    assert command.target is None


def test_open_typing_command_routes_to_module() -> None:
    command = execute_shell_command("open typing")

    assert command.action == "open"
    assert command.target == "typing"
    assert command.message == "Opening Typing Test"


def test_open_typing_stats_command_routes_to_module() -> None:
    command = execute_shell_command("open typing-stats")

    assert command.action == "open"
    assert command.target == "typing-stats"
    assert command.message == "Opening Typing Stats"


def test_open_orbit_command_routes_to_module() -> None:
    command = execute_shell_command("open orbit")

    assert command.action == "open"
    assert command.target == "ascii-orbit"
    assert command.message == "Opening ASCII Orbit"


def test_open_orbit_shortcut_routes_to_module() -> None:
    command = execute_shell_command("o")

    assert command.action == "open"
    assert command.target == "ascii-orbit"


def test_unknown_command_returns_help_hint() -> None:
    command = execute_shell_command("unknown thing")

    assert command.action == "error"
    assert "Try: open shell" in command.message
