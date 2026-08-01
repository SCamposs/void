# VOID releases

VOID packages Windows and Linux releases in GitHub Actions. Release tags are
the source of truth, and no installer needs to be built or uploaded from a
developer machine.

## Create a release

1. Confirm the version in `desktop/package.json` and
   `desktop/src-tauri/tauri.conf.json`.
2. Run the local validation commands below.
3. Commit the release-ready changes through your normal review process.
4. Create and push a matching version tag:

   ```text
   git tag v0.1.3-alpha
   git push origin v0.1.3-alpha
   ```

The `Desktop release` workflow checks out that exact tag, validates the app on
both platforms, builds an NSIS installer plus DEB and AppImage packages, and
creates one GitHub Release after every package succeeds. Alpha, beta, and
release-candidate tags are marked as prereleases.

The workflow can also be started manually with an existing tag through
`workflow_dispatch`. It deliberately checks out the supplied tag and will not
create a missing tag.

## Release assets

Each release contains:

- `VOID-Windows-x64-setup.exe`
- `VOID-Windows-x64-setup.exe.sha256`
- `VOID-Linux-x64.deb`
- `VOID-Linux-x64.deb.sha256`
- `VOID-Linux-x64.AppImage`
- `VOID-Linux-x64.AppImage.sha256`

The stable filenames keep links and automation predictable. The same files are
retained as workflow artifacts for diagnostics.

Find releases at:

https://github.com/SCamposs/void/releases

## Package verification

VOID installers are currently unsigned. Windows SmartScreen may warn before
launching the installer. Do not bypass or weaken Windows security globally.
Download only from the official release page and compare the installer's
SHA256 hash with the `.sha256` file.

PowerShell verification (Windows):

```powershell
Get-FileHash .\VOID-Windows-x64-setup.exe -Algorithm SHA256
Get-Content .\VOID-Windows-x64-setup.exe.sha256
```

SHA256 verification (Linux):

```sh
sha256sum --check VOID-Linux-x64.deb.sha256
sha256sum --check VOID-Linux-x64.AppImage.sha256
```

## Local validation and build

From `desktop/`:

```sh
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
```

Package for the current platform:

```sh
# Windows (PowerShell or cmd.exe)
npm run tauri -- build --bundles nsis

# Linux
npm run tauri -- build --bundles deb,appimage
```

The local installer is written beneath
`desktop/src-tauri/target/release/bundle/`. Generated build output and packages
must not be committed.

## Troubleshooting

- **The workflow cannot find an installer:** inspect the Tauri build step and
  confirm the requested bundle is supported by its runner.
- **The manual workflow fails during checkout:** the supplied version tag must
  already exist on the remote.
- **The latest-download link returns 404:** confirm the release completed and
  contains the exact stable asset name shown above.
- **A version mismatch is reported:** keep the frontend and Tauri configuration
  versions aligned before tagging.
- **Rust or native build errors occur locally:** install the stable Rust
  toolchain plus the platform dependencies listed in the Tauri prerequisites.
  The hosted runners install or provide the required system toolchains.
