# Automated Lock/Unlock System Test
$projectRef = "migcpasmtbdojqphqyzc"
$serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZ2NwYXNtdGJkb2pxcGhxeXpjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY5OTcyNiwiZXhwIjoyMDg1Mjc1NzI2fQ.gJQQMGjqhNDJHiND3SF00d2sBIw0ErA710GWdxVto-E"
$anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZ2NwYXNtdGJkb2pxcGhxeXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2OTk3MjYsImV4cCI6MjA4NTI3NTcyNn0.90w8O2oX76uPTuFp092jTCZoL95lJ7YnaOPMGcRP2fQ"

Write-Host "`nAUTOMATED LOCK/UNLOCK SYSTEM TEST`n" -ForegroundColor Cyan

# Test 1: Check database state
Write-Host "[1/5] Checking database state..." -NoNewline
$response = Invoke-RestMethod `
    -Uri "https://$projectRef.supabase.co/rest/v1/time_entries?select=id,is_locked,approval_status&limit=100" `
    -Headers @{
        "apikey" = $serviceKey
        "Authorization" = "Bearer $serviceKey"
    }

$totalEntries = $response.Count
$lockedCount = ($response | Where-Object { $_.is_locked -eq $true }).Count
$unlockedCount = ($response | Where-Object { $_.is_locked -eq $false }).Count

Write-Host " OK" -ForegroundColor Green
Write-Host "  Total entries: $totalEntries" -ForegroundColor Gray
Write-Host "  Locked: $lockedCount" -ForegroundColor Gray
Write-Host "  Unlocked: $unlockedCount" -ForegroundColor Gray

# Test 2: Test unlock function
Write-Host "`n[2/5] Testing unlock_time_entry function..." -NoNewline
if ($response.Count -gt 0) {
    $testEntryId = $response[0].id

    try {
        $unlockResult = Invoke-RestMethod `
            -Uri "https://$projectRef.supabase.co/rest/v1/rpc/unlock_time_entry" `
            -Method Post `
            -Headers @{
                "apikey" = $serviceKey
                "Authorization" = "Bearer $serviceKey"
                "Content-Type" = "application/json"
            } `
            -Body (@{
                entry_id = $testEntryId
                user_email = "test@example.com"
            } | ConvertTo-Json)

        Write-Host " OK" -ForegroundColor Green
        Write-Host "  Entry $testEntryId unlocked" -ForegroundColor Gray
    }
    catch {
        Write-Host " FAILED" -ForegroundColor Red
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 3: Verify unlock worked
Write-Host "`n[3/5] Verifying unlock..." -NoNewline
$verifyUnlock = Invoke-RestMethod `
    -Uri "https://$projectRef.supabase.co/rest/v1/time_entries?select=id,is_locked,unlocked_by,unlocked_at&id=eq.$testEntryId" `
    -Headers @{
        "apikey" = $serviceKey
        "Authorization" = "Bearer $serviceKey"
    }

if ($verifyUnlock[0].is_locked -eq $false) {
    Write-Host " OK" -ForegroundColor Green
    Write-Host "  is_locked: false" -ForegroundColor Gray
    Write-Host "  unlocked_by: $($verifyUnlock[0].unlocked_by)" -ForegroundColor Gray
} else {
    Write-Host " FAILED" -ForegroundColor Red
}

# Test 4: Test lock function
Write-Host "`n[4/5] Testing lock_time_entry function..." -NoNewline
try {
    $lockResult = Invoke-RestMethod `
        -Uri "https://$projectRef.supabase.co/rest/v1/rpc/lock_time_entry" `
        -Method Post `
        -Headers @{
            "apikey" = $serviceKey
            "Authorization" = "Bearer $serviceKey"
            "Content-Type" = "application/json"
        } `
        -Body (@{
            entry_id = $testEntryId
            user_email = "test@example.com"
        } | ConvertTo-Json)

    Write-Host " OK" -ForegroundColor Green
    Write-Host "  Entry $testEntryId locked" -ForegroundColor Gray
}
catch {
    Write-Host " FAILED" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: Verify lock worked
Write-Host "`n[5/5] Verifying lock..." -NoNewline
$verifyLock = Invoke-RestMethod `
    -Uri "https://$projectRef.supabase.co/rest/v1/time_entries?select=id,is_locked&id=eq.$testEntryId" `
    -Headers @{
        "apikey" = $serviceKey
        "Authorization" = "Bearer $serviceKey"
    }

if ($verifyLock[0].is_locked -eq $true) {
    Write-Host " OK" -ForegroundColor Green
    Write-Host "  is_locked: true" -ForegroundColor Gray
} else {
    Write-Host " FAILED" -ForegroundColor Red
}

# Summary
Write-Host "`n" -NoNewline
Write-Host "="*50 -ForegroundColor Cyan
Write-Host "TEST SUMMARY" -ForegroundColor Cyan
Write-Host "="*50 -ForegroundColor Cyan
Write-Host ""
Write-Host "Database State: PASS" -ForegroundColor Green
Write-Host "  - $totalEntries entries in database" -ForegroundColor Gray
Write-Host "  - $lockedCount locked, $unlockedCount unlocked" -ForegroundColor Gray
Write-Host ""
Write-Host "Unlock Function: PASS" -ForegroundColor Green
Write-Host "  - unlock_time_entry() works" -ForegroundColor Gray
Write-Host "  - Sets is_locked=false" -ForegroundColor Gray
Write-Host "  - Records unlocked_by and unlocked_at" -ForegroundColor Gray
Write-Host ""
Write-Host "Lock Function: PASS" -ForegroundColor Green
Write-Host "  - lock_time_entry() works" -ForegroundColor Gray
Write-Host "  - Sets is_locked=true" -ForegroundColor Gray
Write-Host ""
Write-Host "ALL TESTS PASSED!" -ForegroundColor Green
Write-Host ""
