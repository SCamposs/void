# VOID updater feed

`latest.json` is generated and committed by the desktop release workflow after both signed Windows and Linux updater artifacts are published.

The app reads the raw `main/updater/latest.json` URL so prerelease versions remain discoverable. Do not hand-edit the generated manifest or commit updater private keys.
