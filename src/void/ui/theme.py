from __future__ import annotations

VOID_LOGO = r"""\
 _    _  ____  _____ _____
| |  | |/ __ \|_   _|  __ \\
| |  | | |  | | | | | |  | |
| |  | | |  | | | | | |  | |
| |__| | |__| |_| |_| |__| |
 \____/ \____/|_____|_____/
"""


VOID_THEME_CSS = """
Screen {
    background: #0d0f0d;
    color: #e5e2e1;
}

#shell-root {
    layout: vertical;
}

#top-bar {
    height: 3;
    border-bottom: solid #3e4a40;
    background: #111211;
    padding: 0 1;
}

#main-layout {
    height: 1fr;
    layout: horizontal;
}

#sidebar {
    width: 32;
    border-right: solid #3e4a40;
    background: #090c0a;
}

#workspace {
    width: 1fr;
    padding: 1;
    background: #111311;
    layout: vertical;
}

#telemetry {
    width: 32;
    border-left: solid #3e4a40;
    background: #111311;
}

#status-bar {
    height: 1;
    background: #01a89d;
    color: #003531;
}

.panel {
    border: solid #3e4a40;
    background: #101211;
    padding: 1;
}

.title-green {
    color: #6bdc96;
    text-style: bold;
}

.title-cyan {
    color: #5adace;
    text-style: bold;
}

.muted {
    color: #bdcabd;
}

.tiny {
    color: #879488;
}

#workspace-label {
    height: 1;
    color: #879488;
}

#workspace-stack {
    height: 1fr;
}

#workspace-viewport {
    height: 2fr;
    border: solid #3e4a40;
    content-align: center middle;
    color: #6bdc96;
    padding: 1;
}

.workspace-action {
    height: 3;
    margin-top: 1;
    border: solid #3e4a40;
    background: #1a221d;
    color: #6bdc96;
    text-style: bold;
}

.workspace-quick {
    height: 3;
    border: solid #3e4a40;
    background: #131916;
    color: #bdcabd;
}

#terminal-panel {
    height: 1fr;
    border: solid #3e4a40;
    padding: 1;
}

#terminal-log {
    height: 1fr;
    color: #bdcabd;
}

#prompt-line {
    height: 3;
    border-top: dashed #3e4a40;
    color: #6bdc96;
    padding-top: 1;
}

#prompt-prefix {
    width: 2;
    color: #6bdc96;
}

#prompt-input {
    border: none;
    background: transparent;
    color: #6bdc96;
    height: 1;
}

.side-button {
    background: #5adace;
    color: #000000;
    text-style: bold;
    content-align: center middle;
    height: 3;
}

.module-item {
    height: 3;
    color: #bdcabd;
    border: none;
    background: transparent;
    text-align: left;
}

.module-active {
    background: #2a2a2a;
    color: #5adace;
    text-style: bold;
}

#telemetry-title {
    height: 3;
    background: #2a2a2a;
    border-bottom: solid #3e4a40;
    padding: 0 1;
    text-style: bold;
}
"""
