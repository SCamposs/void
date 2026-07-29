# Local data

VOID stores settings and local history in the Tauri WebView's app-local web
storage. Data stays on the device and is not sent to a server.

The storage schema is versioned. On first launch after this upgrade, compatible
legacy theme, sidebar, and typing keys are copied to version 2 keys. Existing
Stacker history and tuning keys remain readable.

The Settings module can:

- export all VOID-owned local data to a JSON backup;
- import a valid VOID backup;
- reset all VOID-owned local data.

Import merges the backup into current storage and then reloads the app. Reset
removes only keys owned by VOID. SQLite remains a future option if structured
queries or substantially larger histories become necessary.
