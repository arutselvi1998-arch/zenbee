$ErrorActionPreference = 'Stop'
$studioRoot = $PSScriptRoot
$workspacePython = Join-Path (Split-Path $studioRoot -Parent) '.tools/python/python.exe'
$venvPython = Join-Path $studioRoot 'backend/.venv/Scripts/python.exe'
if (Test-Path -LiteralPath $venvPython) { $studioPython = $venvPython }
elseif (Test-Path -LiteralPath $workspacePython) { $studioPython = $workspacePython }
else { throw 'Install Python and backend dependencies using README.md first.' }
$logs = Join-Path $studioRoot '.logs'
$env:PRODUCTION_WORKER = '1'
$env:AUTH_REQUIRED = '1'
New-Item -ItemType Directory -Path $logs -Force | Out-Null
$backendProcess = Start-Process -FilePath $studioPython -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000') -WorkingDirectory (Join-Path $studioRoot 'backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'backend.log') -RedirectStandardError (Join-Path $logs 'backend-error.log') -PassThru
Write-Host 'ZENBEE Studio: http://localhost:3000'
Write-Host 'Backend logs: .logs/backend-error.log'
try {
    Set-Location (Join-Path $studioRoot 'frontend')
    & npm.cmd run dev
} finally {
    Stop-Process -Id $backendProcess.Id -ErrorAction SilentlyContinue
    Set-Location $studioRoot
}
