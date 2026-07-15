$ErrorActionPreference = "Stop"

$SUPERSET_SCRIPT_DIR = $PSScriptRoot
$ROOT_DIR = (Resolve-Path "$SUPERSET_SCRIPT_DIR\..").Path
Set-Location $ROOT_DIR

$LOCAL_DB_PROJECT = "superset-local"

Write-Host "Tearing down DB stack..."
docker compose -p $LOCAL_DB_PROJECT -f "$ROOT_DIR\docker-compose.yml" down -v

Write-Host "Removing dev data..."
if (Test-Path "$ROOT_DIR\superset-dev-data") {
    Remove-Item -Recurse -Force "$ROOT_DIR\superset-dev-data"
}

Write-Host "Teardown complete" -ForegroundColor Green
