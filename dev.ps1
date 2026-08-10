# dev.ps1 - Kill ALL node processes then start dev services
# Usage: .\dev.ps1
# On Windows, Ctrl+C on turbo leaves child node processes alive.
# This script ensures a clean slate before starting.

Write-Host "[*] Killing all node processes..." -ForegroundColor Cyan
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1

# Verify ports are free
$blocked = netstat -ano | Select-String ":(8081|3000|3001)\s" | Select-String "LISTENING"
if ($blocked) {
    Write-Host "[!] Some ports still occupied, force-killing..." -ForegroundColor Yellow
    $blocked | ForEach-Object {
        $parts = ($_ -split '\s+')
        $procId = $parts[-1].Trim()
        if ($procId -match '^\d+$' -and $procId -ne '0') {
            taskkill /F /PID $procId 2>&1 | Out-Null
        }
    }
    Start-Sleep -Seconds 1
}

Write-Host "[OK] Ports clear" -ForegroundColor Green
Write-Host ""
Write-Host "[*] Starting Docker services..." -ForegroundColor Cyan
docker compose up -d db redis meilisearch

Write-Host ""
Write-Host "[*] Starting dev servers..." -ForegroundColor Cyan
pnpm dev
