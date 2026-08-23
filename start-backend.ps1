# Helper function to check if Docker engine is running
function Test-DockerEngine {
    docker info >$null 2>&1
    return ($LASTEXITCODE -eq 0)
}

# 1. Check if Docker daemon is responsive, launch if off
if (-not (Test-DockerEngine)) {
    Write-Host "[!] Launching Docker Desktop..." -ForegroundColor Yellow
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    
    Write-Host "[...] Waiting for Docker engine to start..." -ForegroundColor Yellow
    while (-not (Test-DockerEngine)) {
        Start-Sleep -Seconds 3
    }
    Write-Host "[+] Docker is active!" -ForegroundColor Green
}

# 2. Start Redis container
Write-Host "[*] Starting Redis Stack..." -ForegroundColor Cyan
docker start redis-stack

# 3. Start Backend server
Write-Host "[*] Starting Backend..." -ForegroundColor Green
Set-Location backend
npm run dev