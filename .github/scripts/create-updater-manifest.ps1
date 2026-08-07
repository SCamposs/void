param(
  [Parameter(Mandatory = $true)]
  [string]$Tag,
  [Parameter(Mandatory = $true)]
  [string]$Repository,
  [Parameter(Mandatory = $true)]
  [string]$AssetDirectory
)

$ErrorActionPreference = "Stop"
$version = $Tag.TrimStart("v")
if ($version -notmatch '^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$') {
  throw "The release tag must contain a valid semantic version. Received: $Tag"
}

$assets = (Resolve-Path -LiteralPath $AssetDirectory).Path
$windowsSignature = (Get-Content -Raw -LiteralPath (Join-Path $assets "VOID-Windows-x64-setup.exe.sig")).Trim()
$linuxSignature = (Get-Content -Raw -LiteralPath (Join-Path $assets "VOID-Linux-x64.AppImage.sig")).Trim()
if (-not $windowsSignature -or -not $linuxSignature) {
  throw "Updater signature files cannot be empty."
}

$baseUrl = "https://github.com/$Repository/releases/download/$Tag"
$manifest = [ordered]@{
  version = $version
  notes = "See the GitHub release notes for $Tag."
  pub_date = (Get-Date).ToUniversalTime().ToString("o")
  platforms = [ordered]@{
    "windows-x86_64" = [ordered]@{
      signature = $windowsSignature
      url = "$baseUrl/VOID-Windows-x64-setup.exe"
    }
    "linux-x86_64" = [ordered]@{
      signature = $linuxSignature
      url = "$baseUrl/VOID-Linux-x64.AppImage"
    }
  }
}

$json = $manifest | ConvertTo-Json -Depth 5
$encoding = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $assets "latest.json"), $json, $encoding)
