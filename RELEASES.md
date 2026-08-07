# VOID releases

VOID packages Windows and Linux releases in GitHub Actions. Release tags are
the source of truth, and no installer needs to be built or uploaded from a
developer machine.

## Create a release

1. Confirm the same version in `desktop/package.json`,
   `desktop/src-tauri/Cargo.toml`, and `desktop/src-tauri/tauri.conf.json`.
2. Run the local validation commands below.
3. Commit the release-ready changes through your normal review process.
4. Create and push a matching version tag:

   ```text
   git tag v0.1.4-alpha
   git push origin v0.1.4-alpha
   ```

The `Desktop release` workflow checks out that exact tag, validates the app on
both platforms, builds an NSIS installer plus DEB and AppImage packages, and
creates one GitHub Release after every package succeeds. Alpha, beta, and
release-candidate tags are marked as prereleases. The release job also writes
the signed update metadata to `updater/latest.json` on `main`, allowing alpha
builds to discover later alpha releases without relying on GitHub's stable-only
`releases/latest` alias.

The workflow can also be started manually with an existing tag through
`workflow_dispatch`. It deliberately checks out the supplied tag and will not
create a missing tag.

## Release assets

Each release contains:

- `VOID-Windows-x64-setup.exe`
- `VOID-Windows-x64-setup.exe.sig`
- `VOID-Windows-x64-setup.exe.sha256`
- `VOID-Linux-x64.deb`
- `VOID-Linux-x64.deb.sha256`
- `VOID-Linux-x64.AppImage`
- `VOID-Linux-x64.AppImage.sig`
- `VOID-Linux-x64.AppImage.sha256`
- `latest.json`

The stable filenames keep links and automation predictable. The same files are
retained as workflow artifacts for diagnostics.

## Updater signing

Tauri requires every updater artifact to carry a minisign signature. This is
separate from Windows Authenticode signing and cannot be disabled.

- The public updater key is committed in `desktop/src-tauri/tauri.conf.json`.
- The private key must remain outside the repository and be backed up securely.
- The private key content must be stored in the repository secret
  `TAURI_SIGNING_PRIVATE_KEY` before a release is tagged.
- The local key created for this project is expected at
  `C:\Users\zuado\.tauri\void-updater.key`; never commit it.

If this private key is lost, installed builds cannot trust artifacts signed by
a replacement key. Rotate it only through a planned migration release.

Find releases at:

https://github.com/SCamposs/void/releases

## Package verification

VOID installers are currently not Authenticode-signed. Windows SmartScreen may
warn before launching the installer. The updater minisign signature protects
in-app updates but does not remove the SmartScreen warning. Do not bypass or weaken Windows security globally.
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
- **The app cannot check for updates:** confirm `updater/latest.json` exists on
  `main` and references the current signed release assets.
- **The build reports a missing signing key:** configure the
  `TAURI_SIGNING_PRIVATE_KEY` repository secret before publishing.
- **A version mismatch is reported:** keep the frontend and Tauri configuration
  versions aligned before tagging.
- **Rust or native build errors occur locally:** install the stable Rust
  toolchain plus the platform dependencies listed in the Tauri prerequisites.
  The hosted runners install or provide the required system toolchains.
