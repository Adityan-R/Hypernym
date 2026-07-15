$ErrorActionPreference = "Stop"

$SUPERSET_SCRIPT_DIR = $PSScriptRoot
$ROOT_DIR = (Resolve-Path "$SUPERSET_SCRIPT_DIR\..").Path
Set-Location $ROOT_DIR

$ELECTRIC_SECRET_VALUE = "local_electric_dev_secret"
$LOCAL_KV_TOKEN_VALUE = "local_dev_token"

Write-Host "Preparing .env..."
if (-not (Test-Path ".env")) {
    if (-not (Test-Path ".env.local.example")) {
        Write-Error ".env.local.example not found in $ROOT_DIR"
        exit 1
    }
    Copy-Item ".env.local.example" ".env"
    Write-Host "Created .env from .env.local.example" -ForegroundColor Green
} else {
    Write-Host ".env already exists - leaving as-is" -ForegroundColor Green
}

if (-not (Get-Command "bun" -ErrorAction SilentlyContinue)) {
    Write-Error "bun is not installed or not in PATH. Please install bun via: powershell -c `"irm bun.sh/install.ps1 | iex`""
    exit 1
}

Write-Host "Allocating ports..."
$BASE = 3000
$LOCAL_PG_PORT = $BASE + 14
$LOCAL_NEON_PROXY_PORT = $BASE + 15
$LOCAL_ELECTRIC_PORT = $BASE + 9
$LOCAL_REDIS_PORT = $BASE + 16
$LOCAL_SRH_PORT = $BASE + 17
$LOCAL_DB_PROJECT = "superset-local"

Write-Host "Starting DB stack..."
docker compose -p $LOCAL_DB_PROJECT -f "$ROOT_DIR\docker-compose.yml" up -d

Write-Host "Waiting for services to become ready..."
Start-Sleep -Seconds 10 # Basic sleep for Windows MVP instead of complex curl loop

Write-Host "Applying database migrations..."
$env:DATABASE_URL = "postgres://postgres:postgres@db.localtest.me:$LOCAL_NEON_PROXY_PORT/main"
$env:DATABASE_URL_UNPOOLED = "postgres://postgres:postgres@localhost:$LOCAL_PG_PORT/main"
bun run db:migrate

Write-Host "Seeding dev account..."
bun run db:seed-dev

Write-Host "Writing workspace .env..."
$envAdditions = @"

# ===== Local workspace overrides (setup.local.ps1) =====
SUPERSET_WORKSPACE_NAME="local"
SUPERSET_HOME_DIR="$ROOT_DIR\superset-dev-data"
SUPERSET_PORT_BASE="$BASE"
LOCAL_PG_PORT="$LOCAL_PG_PORT"
LOCAL_NEON_PROXY_PORT="$LOCAL_NEON_PROXY_PORT"
LOCAL_ELECTRIC_PORT="$LOCAL_ELECTRIC_PORT"
LOCAL_REDIS_PORT="$LOCAL_REDIS_PORT"
LOCAL_SRH_PORT="$LOCAL_SRH_PORT"
DATABASE_URL="$env:DATABASE_URL"
DATABASE_URL_UNPOOLED="$env:DATABASE_URL_UNPOOLED"
KV_REST_API_URL="http://localhost:$LOCAL_SRH_PORT"
KV_REST_API_TOKEN="$LOCAL_KV_TOKEN_VALUE"
KV_URL="redis://localhost:$LOCAL_REDIS_PORT"
ELECTRIC_PORT="$LOCAL_ELECTRIC_PORT"
ELECTRIC_SECRET="$ELECTRIC_SECRET_VALUE"
"@

Add-Content -Path ".env" -Value $envAdditions

Write-Host "Setup complete. You can now run 'bun run dev'" -ForegroundColor Green
