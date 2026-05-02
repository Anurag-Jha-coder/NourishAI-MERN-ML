# NourishAI - PowerShell Setup & Start Script
# Run with: Right-click -> "Run with PowerShell"
# Or in terminal: powershell -ExecutionPolicy Bypass -File setup.ps1

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  NourishAI - Setup & Start (PowerShell)   " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

# ── Check Python ────────────────────────────────────────────
Write-Host "[1/5] Checking Python..." -ForegroundColor Yellow
try {
    $pyver = python --version 2>&1
    Write-Host "  $pyver - OK" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Python not found." -ForegroundColor Red
    Write-Host "  Download from: https://www.python.org/downloads/" -ForegroundColor Red
    Write-Host "  IMPORTANT: Check 'Add Python to PATH' during install!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# ── Check Node ──────────────────────────────────────────────
Write-Host "[2/5] Checking Node.js..." -ForegroundColor Yellow
try {
    $nodever = node --version 2>&1
    Write-Host "  Node $nodever - OK" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Node.js not found." -ForegroundColor Red
    Write-Host "  Download from: https://nodejs.org/" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# ── Install Python deps ─────────────────────────────────────
Write-Host "[3/5] Installing Python ML dependencies..." -ForegroundColor Yellow
Set-Location "$ROOT\ml"
python -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR installing Python deps" -ForegroundColor Red; Read-Host; exit 1 }
Write-Host "  Python deps - OK" -ForegroundColor Green
Set-Location $ROOT

# ── Install Node deps ───────────────────────────────────────
Write-Host "[4/5] Installing Node.js dependencies..." -ForegroundColor Yellow
npm install
Set-Location "$ROOT\server"; npm install; Set-Location $ROOT
Set-Location "$ROOT\client"; npm install; Set-Location $ROOT
Write-Host "  Node deps - OK" -ForegroundColor Green

# ── Check MongoDB ───────────────────────────────────────────
Write-Host "[5/5] Checking MongoDB..." -ForegroundColor Yellow
$mongo = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
if ($mongo -and $mongo.Status -eq "Running") {
    Write-Host "  MongoDB service running - OK" -ForegroundColor Green
} else {
    Write-Host "  MongoDB service not detected." -ForegroundColor Yellow
    Write-Host "  Make sure to start it manually: mongod --dbpath C:\data\db" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Setup complete! Starting services...     " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ── Start all 3 services ────────────────────────────────────
Write-Host "Starting ML Service  (port 5001)..." -ForegroundColor Yellow
Start-Process "cmd" -ArgumentList "/k cd /d `"$ROOT\ml`" && python app.py" -WindowStyle Normal

Start-Sleep -Seconds 3

Write-Host "Starting Node API    (port 5000)..." -ForegroundColor Yellow
Start-Process "cmd" -ArgumentList "/k cd /d `"$ROOT\server`" && npm run dev" -WindowStyle Normal

Start-Sleep -Seconds 2

Write-Host "Starting React App   (port 3000)..." -ForegroundColor Yellow
Start-Process "cmd" -ArgumentList "/k cd /d `"$ROOT\client`" && npm start" -WindowStyle Normal

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  All services starting!                   " -ForegroundColor Green
Write-Host ""
Write-Host "  React App  : http://localhost:3000        " -ForegroundColor White
Write-Host "  Node API   : http://localhost:5000        " -ForegroundColor White
Write-Host "  ML Service : http://localhost:5001        " -ForegroundColor White
Write-Host "  ML Metrics : http://localhost:5001/metrics" -ForegroundColor White
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Read-Host "Press Enter to close this window"
