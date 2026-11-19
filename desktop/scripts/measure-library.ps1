param()
$ErrorActionPreference = 'Stop'
$taskDesktop = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskManifest = Join-Path $taskDesktop 'library-core/Cargo.toml'
$taskBuild = & cargo test --locked --manifest-path $taskManifest --no-run --message-format=json
if ($LASTEXITCODE -ne 0) { throw 'Could not build Library evaluation tests.' }
$taskArtifact = $taskBuild | ForEach-Object { $_ | ConvertFrom-Json } | Where-Object { $_.reason -eq 'compiler-artifact' -and $_.target.name -eq 'library' -and $_.executable } | Select-Object -Last 1
if (-not $taskArtifact) { throw 'Library evaluation executable was not found.' }
$taskTempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$taskTemp = [IO.Path]::GetFullPath((Join-Path $taskTempBase ('void-library-metrics-' + [Guid]::NewGuid().ToString('N'))))
if (-not $taskTemp.StartsWith($taskTempBase,[StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $taskTemp)) { throw 'Unexpected metrics workspace.' }
New-Item -ItemType Directory -Path $taskTemp | Out-Null
try {
    $taskClock = [Diagnostics.Stopwatch]::StartNew()
    $taskProcess = Start-Process -FilePath $taskArtifact.executable -ArgumentList @('mixed_collection','--nocapture','--test-threads=1') -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskTemp 'stdout.txt') -RedirectStandardError (Join-Path $taskTemp 'stderr.txt')
    [long]$taskPeak = 0
    while (-not $taskProcess.HasExited) {
        $taskProcess.Refresh()
        if (-not $taskProcess.HasExited) { $taskPeak = [Math]::Max($taskPeak,$taskProcess.PeakWorkingSet64) }
        Start-Sleep -Milliseconds 10
    }
    $taskProcess.WaitForExit()
    $taskClock.Stop()
    if ($taskProcess.ExitCode -ne 0) { throw (Get-Content -LiteralPath (Join-Path $taskTemp 'stderr.txt') -Raw) }
    $taskLog = Get-Content -LiteralPath (Join-Path $taskTemp 'stderr.txt') | Where-Object { $_ -like 'LIBRARY_MIXED_EVALUATION*' }
    [ordered]@{ date='2026-11-19'; platform='Windows x64'; profile='debug'; fixture='mixed_collection_evaluation_uses_real_extractors_and_all_search_pages'; parentPeakWorkingSetBytes=$taskPeak; harnessWallMs=$taskClock.ElapsedMilliseconds; benchmark=$taskLog; scope='Parent indexing/test process only. Excludes WebView and PDF subprocess RSS. Each PDF subprocess has a separately enforced 512 MiB committed-memory ceiling; that ceiling is not an observed usage measurement.' } | ConvertTo-Json
} finally {
    # Remove only the unique temporary workspace created above, after the process exited.
    $taskResolved = [IO.Path]::GetFullPath($taskTemp)
    if ($taskResolved.StartsWith($taskTempBase,[StringComparison]::OrdinalIgnoreCase) -and [IO.Path]::GetFileName($taskResolved).StartsWith('void-library-metrics-')) { Remove-Item -LiteralPath $taskResolved -Recurse -Force }
}
