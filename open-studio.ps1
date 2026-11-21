param([switch]$OpenBrowser)
$ErrorActionPreference = 'Stop'
$studioRoot = $PSScriptRoot
$logs = Join-Path $studioRoot '.logs'
New-Item -ItemType Directory -Path $logs -Force | Out-Null
$workspacePython = Join-Path (Split-Path $studioRoot -Parent) '.tools/python/python.exe'
$venvPython = Join-Path $studioRoot 'backend/.venv/Scripts/python.exe'
if (Test-Path -LiteralPath $venvPython) { $studioPython = $venvPython }
elseif (Test-Path -LiteralPath $workspacePython) { $studioPython = $workspacePython }
else { throw 'Install Python and the backend requirements first. See README.md.' }
$node = (Get-Command node.exe -ErrorAction Stop).Source
function Get-StudioResponse($address) {
    try { return Invoke-WebRequest $address -UseBasicParsing -TimeoutSec 2 }
    catch { return $null }
}
$api = Get-StudioResponse 'http://127.0.0.1:8000/openapi.json'
if ($api -and (($api.Content | ConvertFrom-Json).info.title -ne 'ZENBEE Studio API')) {
    throw 'Port 8000 is being used by another application.'
}
if (-not $api) {
    $env:AUTH_REQUIRED = '0'
    $env:PRODUCTION_WORKER = '1'
    $startedApi = Start-Process -FilePath $studioPython -ArgumentList @('-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000') -WorkingDirectory (Join-Path $studioRoot 'backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'backend.log') -RedirectStandardError (Join-Path $logs 'backend-error.log') -PassThru
    Set-Content -LiteralPath (Join-Path $logs 'backend.pid') -Value $startedApi.Id
}
$frontend = Get-StudioResponse 'http://127.0.0.1:3000'
if ($frontend -and $frontend.Content -notmatch 'ZENBEE') {
    throw 'Port 3000 is being used by another application.'
}
if (-not $frontend) {
    $next = Join-Path $studioRoot 'frontend/node_modules/next/dist/bin/next'
    if (-not (Test-Path -LiteralPath $next)) { throw 'Install frontend dependencies with npm.cmd ci in frontend first.' }
    $startedFrontend = Start-Process -FilePath $node -ArgumentList @($next,'dev','--hostname','127.0.0.1','--port','3000') -WorkingDirectory (Join-Path $studioRoot 'frontend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'frontend.log') -RedirectStandardError (Join-Path $logs 'frontend-error.log') -PassThru
    Set-Content -LiteralPath (Join-Path $logs 'frontend.pid') -Value $startedFrontend.Id
}
$ready = $false
for ($attempt = 0; $attempt -lt 40; $attempt++) {
    $apiReady = Get-StudioResponse 'http://127.0.0.1:8000/api/health'
    $pageReady = Get-StudioResponse 'http://127.0.0.1:3000'
    if ($apiReady -and $pageReady -and $pageReady.Content -match 'ZENBEE') { $ready = $true; break }
    Start-Sleep -Seconds 1
}
if (-not $ready) { throw "ZENBEE did not start. Check $logs for startup errors." }
Write-Output 'ZENBEE Studio is ready: http://localhost:3000'
if ($OpenBrowser) { Start-Process 'http://localhost:3000' }
