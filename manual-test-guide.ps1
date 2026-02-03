# Manual Testing Guide for Lock/Unlock Feature
# Run this script and follow the prompts

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "   Lock/Unlock Feature Testing Guide" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Grant Permission
Write-Host "STEP 1: Grant yourself permission" -ForegroundColor Yellow
Write-Host ""
Write-Host "Open Supabase SQL Editor:" -ForegroundColor White
Write-Host "https://supabase.com/dashboard/project/migcpasmtbdojqphqyzc/sql" -ForegroundColor Gray
Write-Host ""
Write-Host "Run this SQL:" -ForegroundColor White
Write-Host ""
Write-Host "UPDATE app_users" -ForegroundColor Green
Write-Host "SET can_edit_time_entries = true" -ForegroundColor Green
Write-Host "WHERE email = 'YOUR_EMAIL@example.com';" -ForegroundColor Green
Write-Host ""
Read-Host "Press Enter when done"

# Step 2: Open App
Write-Host ""
Write-Host "STEP 2: Opening app in browser..." -ForegroundColor Yellow
Start-Process "https://rdsweet1.github.io/mit-qb-frontend/"
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "In the browser:" -ForegroundColor White
Write-Host "1. Login with Microsoft" -ForegroundColor Gray
Write-Host "2. Click 'Time Entries' or 'View All Entries'" -ForegroundColor Gray
Write-Host ""
Read-Host "Press Enter when on Time Entries page"

# Step 3: Test Sync
Write-Host ""
Write-Host "STEP 3: Test QuickBooks Sync" -ForegroundColor Yellow
Write-Host ""
Write-Host "Actions:" -ForegroundColor White
Write-Host "1. Click 'Sync from QB' button" -ForegroundColor Gray
Write-Host "2. Wait for sync to complete" -ForegroundColor Gray
Write-Host "3. Verify entries appear" -ForegroundColor Gray
Write-Host ""
Write-Host "Expected Result:" -ForegroundColor White
Write-Host "- Should see 90+ time entries" -ForegroundColor Green
Write-Host "- Each entry should have a LOCK icon" -ForegroundColor Green
Write-Host ""
$syncWorked = Read-Host "Did sync work? (y/n)"

if ($syncWorked -ne "y") {
    Write-Host ""
    Write-Host "DEBUG: Check browser console (F12)" -ForegroundColor Red
    Write-Host "Look for errors in the Console tab" -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to continue anyway"
}

# Step 4: Test Lock Icons
Write-Host ""
Write-Host "STEP 4: Verify Lock Icons" -ForegroundColor Yellow
Write-Host ""
Write-Host "Look for:" -ForegroundColor White
Write-Host "- Small lock icon (🔒) next to each entry" -ForegroundColor Gray
Write-Host "- Should be after the billable status badge" -ForegroundColor Gray
Write-Host ""
$hasLocks = Read-Host "Do you see lock icons? (y/n)"

if ($hasLocks -ne "y") {
    Write-Host ""
    Write-Host "TROUBLESHOOT:" -ForegroundColor Red
    Write-Host "1. Hard refresh: Ctrl+Shift+R" -ForegroundColor Yellow
    Write-Host "2. Check if deployment completed" -ForegroundColor Yellow
    Write-Host "3. Clear browser cache" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Try those steps, then press Enter"
}

# Step 5: Test Unlock
Write-Host ""
Write-Host "STEP 5: Test Unlock" -ForegroundColor Yellow
Write-Host ""
Write-Host "Actions:" -ForegroundColor White
Write-Host "1. Click any LOCK icon" -ForegroundColor Gray
Write-Host "2. Warning dialog should appear" -ForegroundColor Gray
Write-Host "3. Read the warning message" -ForegroundColor Gray
Write-Host "4. Click 'Yes, Unlock It'" -ForegroundColor Gray
Write-Host ""
Write-Host "Expected Result:" -ForegroundColor White
Write-Host "- Icon changes to UNLOCK (🔓)" -ForegroundColor Green
Write-Host "- Orange warning banner appears at top" -ForegroundColor Green
Write-Host "- Banner says 'unlocked and editable'" -ForegroundColor Green
Write-Host ""
$unlockWorked = Read-Host "Did unlock work? (y/n)"

if ($unlockWorked -eq "y") {
    Write-Host "✅ Unlock feature working!" -ForegroundColor Green
} else {
    Write-Host "❌ Unlock failed - check console for errors" -ForegroundColor Red
}

# Step 6: Test Lock
Write-Host ""
Write-Host "STEP 6: Test Lock (Re-lock)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Actions:" -ForegroundColor White
Write-Host "1. Click the UNLOCK icon (🔓)" -ForegroundColor Gray
Write-Host "2. Confirmation dialog should appear" -ForegroundColor Gray
Write-Host "3. Click 'Yes, Lock It'" -ForegroundColor Gray
Write-Host ""
Write-Host "Expected Result:" -ForegroundColor White
Write-Host "- Icon changes back to LOCK (🔒)" -ForegroundColor Green
Write-Host "- Orange warning banner disappears" -ForegroundColor Green
Write-Host ""
$lockWorked = Read-Host "Did re-lock work? (y/n)"

if ($lockWorked -eq "y") {
    Write-Host "✅ Lock feature working!" -ForegroundColor Green
} else {
    Write-Host "❌ Lock failed - check console for errors" -ForegroundColor Red
}

# Summary
Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   TEST SUMMARY" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

if ($syncWorked -eq "y") {
    Write-Host "✅ QB Sync: PASSED" -ForegroundColor Green
} else {
    Write-Host "❌ QB Sync: FAILED" -ForegroundColor Red
}

if ($hasLocks -eq "y") {
    Write-Host "✅ Lock Icons: PASSED" -ForegroundColor Green
} else {
    Write-Host "❌ Lock Icons: FAILED" -ForegroundColor Red
}

if ($unlockWorked -eq "y") {
    Write-Host "✅ Unlock: PASSED" -ForegroundColor Green
} else {
    Write-Host "❌ Unlock: FAILED" -ForegroundColor Red
}

if ($lockWorked -eq "y") {
    Write-Host "✅ Re-Lock: PASSED" -ForegroundColor Green
} else {
    Write-Host "❌ Re-Lock: FAILED" -ForegroundColor Red
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

if ($syncWorked -eq "y" -and $hasLocks -eq "y" -and $unlockWorked -eq "y" -and $lockWorked -eq "y") {
    Write-Host "🎉 ALL TESTS PASSED!" -ForegroundColor Green
    Write-Host "Lock/Unlock system is fully functional!" -ForegroundColor Green
} else {
    Write-Host "⚠️  SOME TESTS FAILED" -ForegroundColor Yellow
    Write-Host "Check browser console (F12) for errors" -ForegroundColor Yellow
}

Write-Host ""
