from __future__ import annotations

from textual.app import ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical
from textual.screen import Screen
from textual.widgets import Input

from void.core.modules import (
    ShellModule,
    get_shell_module_by_shortcut,
    list_shell_modules,
)
from void.ui.commands import execute_shell_command
from void.ui.widgets.sidebar import Sidebar
from void.ui.widgets.status_bar import StatusBar
from void.ui.widgets.telemetry_panel import TelemetryPanel, TelemetrySnapshot
from void.ui.widgets.top_bar import TopBar
from void.ui.widgets.workspace import Workspace


class ShellScreen(Screen):
    BINDINGS = [
        Binding("up", "select_prev", "Up", show=False),
        Binding("down", "select_next", "Down", show=False),
        Binding("enter", "open_selected", "Open", show=False),
        Binding("h", "open_shortcut('h')", "Shell", show=False),
        Binding("t", "open_shortcut('t')", "Typing", show=False),
        Binding("o", "open_shortcut('o')", "Orbit", show=False),
        Binding("k", "open_shortcut('k')", "Stacker", show=False),
        Binding("q", "quit_requested", "Quit", show=False),
    ]

    def __init__(self) -> None:
        super().__init__()
        self._modules: tuple[ShellModule, ...] = list_shell_modules()
        self._selected_index = 0
        self._active_module_id = self._modules[0].module_id
        self._command_count = 0

    def compose(self) -> ComposeResult:
        with Vertical(id="shell-root"):
            yield TopBar()
            with Horizontal(id="main-layout"):
                yield Sidebar(self._modules)
                yield Workspace()
                yield TelemetryPanel()
            yield StatusBar()

    def on_mount(self) -> None:
        self._refresh_ui(mode="boot")
        self.workspace.terminal().focus_prompt()

    @property
    def sidebar(self) -> Sidebar:
        return self.query_one(Sidebar)

    @property
    def workspace(self) -> Workspace:
        return self.query_one(Workspace)

    @property
    def telemetry(self) -> TelemetryPanel:
        return self.query_one(TelemetryPanel)

    def on_input_submitted(self, event: Input.Submitted) -> None:
        if event.input.id != "prompt-input":
            return
        self._run_command(event.value)

    def on_sidebar_module_selected(self, message: Sidebar.ModuleSelected) -> None:
        self._activate_module(message.module_id, mode="mouse")
        self.workspace.terminal().append_log(
            f"opened {self._module_label(message.module_id)}"
        )

    def on_workspace_quick_open_requested(
        self, message: Workspace.QuickOpenRequested
    ) -> None:
        if message.module_id == "shell":
            self._activate_module("shell", mode="workspace")
            self.workspace.terminal().append_log("already in shell workspace")
            return

        module = self._get_module(message.module_id)
        if module is None:
            return
        self.workspace.terminal().append_log(
            f"launching full module: {self._module_label(message.module_id)}"
        )
        self.app.switch_screen(module.screen_id)

    def action_select_prev(self) -> None:
        self._selected_index = (self._selected_index - 1) % len(self._modules)
        self.sidebar.set_active(self._modules[self._selected_index].module_id)

    def action_select_next(self) -> None:
        self._selected_index = (self._selected_index + 1) % len(self._modules)
        self.sidebar.set_active(self._modules[self._selected_index].module_id)

    def action_open_selected(self) -> None:
        prompt_input = self.workspace.terminal().query_one("#prompt-input", Input)
        if self.focused is prompt_input:
            self._run_command(self.workspace.terminal().pull_prompt_value())
            return
        self._activate_module(
            self._modules[self._selected_index].module_id, mode="keyboard"
        )

    def action_open_shortcut(self, shortcut: str) -> None:
        if self.focused is self.workspace.terminal().query_one("#prompt-input", Input):
            return
        module = get_shell_module_by_shortcut(shortcut)
        if module is None:
            return
        self._activate_module(module.module_id, mode=f"shortcut:{shortcut}")

    def action_quit_requested(self) -> None:
        if self.focused is self.workspace.terminal().query_one("#prompt-input", Input):
            return
        self.app.exit()

    def _run_command(self, raw: str) -> None:
        raw = raw.strip()
        if raw == "":
            self.workspace.terminal().append_log("[SYS] empty command ignored")
            self.workspace.terminal().clear_prompt()
            return

        command = execute_shell_command(raw)
        self.workspace.terminal().append_log(f"[#6bdc96]>[/] {raw}")
        self._command_count += 1

        if command.action == "open" and command.target is not None:
            if self._get_module(command.target) is not None:
                self._activate_module(command.target, mode="command")
                self.workspace.terminal().append_log(
                    f"opened {self._module_label(command.target)}"
                )
            elif command.target == "typing-stats":
                self.workspace.terminal().append_log("opened Typing Stats")
                self.app.switch_screen("typing-stats")
                return
        elif command.action == "modules":
            self.workspace.terminal().append_log(
                "available modules: shell, typing, orbit, stacker"
            )
        elif command.action == "help":
            self.workspace.terminal().append_log(command.message)
        elif command.action == "disabled":
            self.workspace.terminal().append_log(f"[yellow]{command.message}[/]")
        elif command.action == "clear":
            self.workspace.terminal().clear_log()
            self.workspace.terminal().append_log("[SYS] terminal cleared")
        elif command.action == "quit":
            self.app.exit()
            return
        else:
            self.workspace.terminal().append_log(f"[red]{command.message}[/]")

        self._refresh_telemetry(mode="command")
        self.workspace.terminal().clear_prompt()
        self.workspace.terminal().focus_prompt()

    def _module_label(self, module_id: str) -> str:
        module = self._get_module(module_id)
        if module is not None:
            return module.label.replace("_", " ").title()
        return module_id

    def _get_module(self, module_id: str) -> ShellModule | None:
        for module in self._modules:
            if module.module_id == module_id:
                return module
        return None

    def _activate_module(self, module_id: str, *, mode: str) -> None:
        for index, module in enumerate(self._modules):
            if module.module_id == module_id:
                self._selected_index = index
                self._active_module_id = module_id
                self._refresh_ui(mode=mode)
                return

    def _refresh_ui(self, *, mode: str) -> None:
        self.sidebar.set_active(self._active_module_id)
        self.workspace.render_module(self._active_module_id)
        self._refresh_telemetry(mode=mode)

    def _refresh_telemetry(self, *, mode: str) -> None:
        self.telemetry.update_snapshot(
            TelemetrySnapshot(
                active_module=self._active_module_id,
                mode=mode,
                sqlite_status="READY",
                command_count=self._command_count,
                workspace_path="/usr/void/local",
            )
        )
