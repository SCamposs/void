# VOID releases

VOID packages Windows releases in GitHub Actions. Release tags are the source
of truth, and no installer needs to be built or uploaded from a developer
machine.

## Create a release

1. Confirm the version in `desktop/package.json` and
   `desktop/src-tauri/tauri.conf.json`.
2. Run the local validation commands below.
3. Commit the release-ready changes through your normal review process.
4. Create and push a matching version tag:

   ```text
   git tag v0.1.1-alpha
   git push origin v0.1.1-alpha
   ```

The `Windows release` workflow checks out that exact tag, validates the app,
builds an NSIS installer, and creates the GitHub Release. Alpha, beta, and
release-candidate tags are marked as prereleases.

The workflow can also be started manually with an existing tag through
`workflow_dispatch`. It deliberately checks out the supplied tag and will not
create a missing tag.

## Release assets

Each release contains:

- `VOID-Windows-x64-setup.exe`
- `VOID-Windows-x64-setup.exe.sha256`

The stable filenames support the latest-download link in the README. The same
files are retained as a workflow artifact for diagnostics.

Find releases at:

https://github.com/SCamposs/void/releases

## Unsigned build warning

VOID installers are currently unsigned. Windows SmartScreen may warn before
launching the installer. Do not bypass or weaken Windows security globally.
Download only from the official release page and compare the installer's
SHA256 hash with the `.sha256` file.

PowerShell verification:

```powershell
Get-FileHash .\VOID-Windows-x64-setup.exe -Algorithm SHA256
Get-Content .\VOID-Windows-x64-setup.exe.sha256
```

## Local validation and build

From `desktop/`:

```text
npm.cmd ci
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run tauri -- build --bundles nsis
```

The local installer is written beneath
`desktop/src-tauri/target/release/bundle/nsis/`. Generated build output and
installers must not be committed.

## Troubleshooting

- **The workflow cannot find an installer:** inspect the Tauri build step and
  confirm NSIS is enabled and the runner is Windows.
- **The manual workflow fails during checkout:** the supplied version tag must
  already exist on the remote.
- **The latest-download link returns 404:** confirm the release completed and
  contains the exact stable asset name shown above.
- **A version mismatch is reported:** keep the frontend and Tauri configuration
  versions aligned before tagging.
- **Rust or native build errors occur locally:** install the stable Rust
  toolchain plus the Windows MSVC and SDK build tools. The hosted Windows runner
  already includes the required system toolchain.
