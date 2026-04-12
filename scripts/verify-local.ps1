$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$serverOutLog = Join-Path $root ".server-smoke.out.log"
$serverErrLog = Join-Path $root ".server-smoke.err.log"
$serverPidFile = Join-Path $root ".server-smoke.pid"

Push-Location $root

try {
  npm run db:start
  npm run prisma:generate
  npm run prisma:migrate:dev
  npm run seed
  npm run build

  if (Test-Path $serverPidFile) {
    Remove-Item $serverPidFile -Force -ErrorAction SilentlyContinue
  }

  $server = Start-Process -FilePath "node" -ArgumentList "dist/server.js" -WorkingDirectory $root -PassThru -RedirectStandardOutput $serverOutLog -RedirectStandardError $serverErrLog
  Set-Content -Path $serverPidFile -Value $server.Id

  for ($i = 0; $i -lt 30; $i++) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:4000/health" -TimeoutSec 2
      if ($response.StatusCode -eq 200) {
        break
      }
    } catch {
      Start-Sleep -Seconds 1
    }
  }

  npm run smoke
} finally {
  if (Test-Path $serverPidFile) {
    $serverPid = Get-Content $serverPidFile | Select-Object -First 1
    if ($serverPid) {
      Stop-Process -Id ([int]$serverPid) -Force -ErrorAction SilentlyContinue
    }
    Remove-Item $serverPidFile -Force -ErrorAction SilentlyContinue
  }

  Pop-Location
}
