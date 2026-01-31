# Run Lock/Unlock E2E Test
# This script launches Playwright in headed mode so you can see the browser

Write-Host "`n🧪 Starting Lock/Unlock E2E Tests...`n" -ForegroundColor Cyan

# Create test-results directory
if (-not (Test-Path "test-results")) {
    New-Item -ItemType Directory -Path "test-results" | Out-Null
    Write-Host "Created test-results directory" -ForegroundColor Gray
}

# Run Playwright test in headed mode with UI
Write-Host "Launching browser (you'll see it open)..." -ForegroundColor Yellow
Write-Host ""

npx playwright test tests/lock-unlock-e2e.spec.ts `
    --headed `
    --project=chromium `
    --timeout=300000 `
    --reporter=list `
    --workers=1

Write-Host "`n✅ Tests complete!" -ForegroundColor Green
Write-Host "Screenshots saved to test-results/" -ForegroundColor Gray
Write-Host ""
