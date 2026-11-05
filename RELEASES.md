# VOID releases

VOID packages Windows and Linux releases in GitHub Actions. Release tags are
the source of truth, and no installer needs to be built or uploaded from a
developer machine.

## Create a release

1. Confirm the same version in `desktop/package.json`,
   `desktop/src-tauri/Cargo.toml`, and `desktop/src-tauri/tauri.conf.json`.
2. Update both lockfiles and write curated notes in `docs/releases/<tag>.md`.
   Include downloads, notable changes, fixes/removals, and known limitations.
   Keep alpha/beta/rc versions marked as prereleases. Run the local validation commands below.
3. Commit the release-ready changes through your normal review process.
4. Create and push a matching version tag:

   ```text
   git tag -a v0.3.0-alpha -m "VOID v0.3.0-alpha: Visual Foundation"
   git push origin v0.3.0-alpha
   ```

The `Desktop release` workflow validates that the existing annotated tag belongs to
`main`, then builds that exact source commit on Windows and Linux without signing
credentials. A fresh runner in the protected `release-signing` environment signs
the three packages using an independently locked tool. Approve that environment
only after reviewing the source, workflow and unsigned build results.

A separate job without the signing key publishes verified assets and opens a PR
changing only `updater/latest.json`. Review and merge that PR after `Security checks`
passes (approve the bot-created workflow run if GitHub requests it). Merging the
feed PR completes update delivery; publishing the release alone does not. The
installed `main` feed URL and four platform routes remain unchanged. Existing
published assets cannot be replaced, and the feed cannot move backwards.

Manual dispatch must run from `main` with an existing tag. `verify_only` defaults
to true: it builds, signs and verifies without publishing or changing the feed.
Set it to false only for an intended publication. Tags must not be moved or deleted.

## Release assets

Each release contains:

- `VOID-Windows-x64-setup.exe`
- `VOID-Windows-x64-setup.exe.sig`
- `VOID-Windows-x64-setup.exe.sha256`
- `VOID-Linux-x64.deb`
- `VOID-Linux-x64.deb.sha256`
- `VOID-Linux-x64.deb.sig`
- `VOID-Linux-x64.AppImage`
- `VOID-Linux-x64.AppImage.sig`
- `VOID-Linux-x64.AppImage.sha256`
- `latest.json`

The stable filenames keep links and automation predictable. The same files are
retained as workflow artifacts for diagnostics for seven days. Use synthetic QA data;
never upload account profiles, credentials or production conversations.

The Linux feed has explicit `linux-x86_64-deb` and `linux-x86_64-appimage`
entries so the updater selects the installed package format. The generic Linux
entry remains an AppImage fallback for compatibility. DEB installation uses the
system package manager and may request administrator authorization.

## Updater signing

Tauri requires every updater artifact to carry a minisign signature. This is
separate from Windows Authenticode signing and cannot be disabled.

- The public updater key is committed in `desktop/src-tauri/tauri.conf.json`.
- The private key must remain outside the repository and be backed up securely.
- Store the unchanged key only as environment secret `TAURI_SIGNING_PRIVATE_KEY`
  in `release-signing`, restricted to `main` and version tags with owner approval.
  Do not keep a duplicate repository-scoped secret. Only the signing step receives it.
- Keep an access-controlled backup outside all checkouts; never commit the key or
  publish machine-specific backup locations. Normal validation does not need it.

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
  `TAURI_SIGNING_PRIVATE_KEY` environment secret and approve `release-signing` before signing.
- **A version mismatch is reported:** keep the frontend and Tauri configuration
  versions aligned before tagging.
- **Rust or native build errors occur locally:** install the stable Rust
  toolchain plus the platform dependencies listed in the Tauri prerequisites.
  The hosted runners install or provide the required system toolchains.
