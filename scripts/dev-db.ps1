param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("init", "start", "stop", "status", "reset")]
  [string]$Action
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $root "docker-compose.dev.yml"

function Invoke-Compose([string[]]$composeArgs) {
  $dockerArgs = @("compose", "-f", $composeFile) + $composeArgs
  & docker @dockerArgs
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose $($composeArgs -join ' ') failed with exit code $LASTEXITCODE"
  }
}

switch ($Action) {
  "init" {
    Invoke-Compose @("up", "-d", "--wait", "postgres")
    Write-Host "Development PostgreSQL container is ready."
  }
  "start" {
    Invoke-Compose @("up", "-d", "--wait", "postgres")
    Write-Host "Development PostgreSQL container is ready."
  }
  "stop" {
    Invoke-Compose @("stop", "postgres")
    Write-Host "Development PostgreSQL container stop requested."
  }
  "status" {
    Invoke-Compose @("ps", "postgres")
  }
  "reset" {
    Invoke-Compose @("down", "-v")
    Write-Host "Development PostgreSQL container and volume reset complete."
  }
}
