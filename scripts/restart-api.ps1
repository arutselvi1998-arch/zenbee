param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$studioRoot = Split-Path $PSScriptRoot -Parent
$workspacePython = Join-Path (Split-Path $studioRoot -Parent) '.tools/python/python.exe'
$venvPython = Join-Path $studioRoot 'backend/.venv/Scripts/python.exe'
if (Test-Path -LiteralPath $venvPython) { $studioPython = $venvPython }
elseif (Test-Path -LiteralPath $workspacePython) { $studioPython = $workspacePython }
else { throw 'Install the backend Python dependencies first.' }
$resolvedPython = (Resolve-Path -LiteralPath $studioPython).Path
$apiProcesses = @(Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" | Where-Object {
    $_.ExecutablePath -eq $resolvedPython -and $_.CommandLine -match 'uvicorn\s+app\.main:app\s+--host\s+127\.0\.0\.1\s+--port\s+8000(?:\s|$)'
})
if ($apiProcesses.Count -gt 1) { throw 'Multiple matching API processes found. Resolve them before restarting.' }
if ($CheckOnly) { Write-Output "Verified workspace API processes: $($apiProcesses.Count)"; exit 0 }
$logs = Join-Path $studioRoot '.logs'
New-Item -ItemType Directory -Path $logs -Force | Out-Null
Push-Location (Join-Path $studioRoot 'backend')
try {
    # Refuse to interrupt active media generation or a social publishing attempt.
    @'
from pathlib import Path
import sqlite3
from sqlalchemy import inspect, text
from app.db import engine
tables = inspect(engine).get_table_names()
with engine.connect() as connection:
    for table, statuses in [('productionjob', "'rendering'"), ('scheduledrelease', "'publishing'")]:
        if table in tables and connection.execute(text(f"SELECT count(*) FROM {table} WHERE status IN ({statuses})")).scalar():
            raise SystemExit('An active job is running. Wait for it to finish before restarting.')
if engine.dialect.name == 'sqlite' and engine.url.database and Path(engine.url.database).is_file():
    with sqlite3.connect(engine.url.database) as source, sqlite3.connect('../.logs/before-api-restart.db') as target:
        source.backup(target)
print('No active jobs; local SQLite backup prepared when applicable.')
'@ | & $studioPython -
    if ($LASTEXITCODE -ne 0) { throw 'Pre-restart verification failed. API left running.' }
    foreach ($apiProcess in $apiProcesses) {
        Stop-Process -Id $apiProcess.ProcessId -Force
        Wait-Process -Id $apiProcess.ProcessId -Timeout 10 -ErrorAction SilentlyContinue
    }
    $env:AUTH_REQUIRED = '1'
    $env:PRODUCTION_WORKER = '1'
    $startedApi = Start-Process -FilePath $studioPython -ArgumentList @('-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000') -WorkingDirectory (Join-Path $studioRoot 'backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'backend.log') -RedirectStandardError (Join-Path $logs 'backend-error.log') -PassThru
    Set-Content -LiteralPath (Join-Path $logs 'backend.pid') -Value $startedApi.Id
    Write-Output "Workspace API started: $($startedApi.Id)"
} finally { Pop-Location }
