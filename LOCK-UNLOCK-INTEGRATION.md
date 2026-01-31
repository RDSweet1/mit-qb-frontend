# Lock/Unlock UI Integration Guide

## Components Created

✅ **LockIcon.tsx** - Interactive lock/unlock button with tooltip
✅ **UnlockWarningDialog.tsx** - Confirmation dialog with QB sync warning
✅ **EditWarningBanner.tsx** - Banner shown on unlocked entries
✅ **UnlockAuditLog.tsx** - Admin view of all unlock events

## Integration Steps

### 1. Add Lock/Unlock Functions

Add these functions to `app/time-entries-enhanced/page.tsx`:

```typescript
// Handle lock/unlock toggle
const handleLockToggle = (entry: TimeEntry) => {
  setSelectedEntry(entry);
  setIsLockingAction(entry.is_locked === false); // If currently unlocked, we're locking
  setUnlockDialogOpen(true);
};

// Confirm unlock/lock action
const confirmLockToggle = async () => {
  if (!selectedEntry || !user) return;

  try {
    const functionName = isLockingAction ? 'lock_time_entry' : 'unlock_time_entry';

    const { data, error } = await supabase.rpc(functionName, {
      entry_id: selectedEntry.id,
      user_email: user.username
    });

    if (error) throw error;

    // Update local state
    setEntries(entries.map(e =>
      e.id === selectedEntry.id
        ? {
            ...e,
            is_locked: isLockingAction,
            unlocked_by: isLockingAction ? null : user.username,
            unlocked_at: isLockingAction ? null : new Date().toISOString()
          }
        : e
    ));

    setUnlockDialogOpen(false);
    setSelectedEntry(null);
  } catch (err: any) {
    alert('Error: ' + err.message);
  }
};
```

### 2. Update Time Entries Query

Change the SELECT to include lock fields:

```typescript
const { data, error } = await supabase
  .from('time_entries')
  .select(`
    *,
    approval_status,
    is_locked,
    unlocked_by,
    unlocked_at
  `)
  .gte('txn_date', startDate)
  .lte('txn_date', endDate);
```

### 3. Add Lock Icon to Table

In the time entries table, add a new column:

```tsx
<th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
  Lock
</th>

// In tbody
<td className="px-3 py-2">
  <LockIcon
    isLocked={entry.is_locked}
    unlockedBy={entry.unlocked_by}
    unlockedAt={entry.unlocked_at}
    onToggle={() => handleLockToggle(entry)}
  />
</td>
```

### 4. Add Warning Banner for Unlocked Entries

At the top of the entries list (before the table):

```tsx
{entries.some(e => !e.is_locked) && (
  <div className="mb-4">
    <div className="bg-orange-50 border-l-4 border-orange-500 p-3 rounded-r-md">
      <p className="text-sm text-orange-800">
        <strong>{entries.filter(e => !e.is_locked).length} entries</strong> are unlocked and editable.
        Changes will not sync to QuickBooks.
      </p>
    </div>
  </div>
)}
```

### 5. Add Dialog at End of Component

```tsx
<UnlockWarningDialog
  isOpen={unlockDialogOpen}
  isLocking={isLockingAction}
  entryDetails={selectedEntry}
  onConfirm={confirmLockToggle}
  onCancel={() => {
    setUnlockDialogOpen(false);
    setSelectedEntry(null);
  }}
/>
```

### 6. Add Audit Log Page (Optional)

Create `app/audit/unlock-log/page.tsx`:

```tsx
'use client'

import { ProtectedPage } from '@/components/ProtectedPage'
import { UnlockAuditLog } from '@/components/time-entries/UnlockAuditLog'

export default function UnlockAuditPage() {
  return (
    <ProtectedPage>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Time Entry Unlock Audit Log
          </h1>
          <UnlockAuditLog />
        </div>
      </div>
    </ProtectedPage>
  )
}
```

## Testing Checklist

### Visual Tests

- [ ] Lock icon (🔒) shows on all locked entries
- [ ] Lock icon (🔓) shows on unlocked entries
- [ ] Tooltip appears on hover with correct info
- [ ] Clicking lock icon opens dialog

### Functional Tests

- [ ] **Unlock flow:**
  - [ ] Click 🔒 → Dialog opens
  - [ ] Dialog shows warning about QB sync
  - [ ] Click "Yes, Unlock It" → Entry unlocks
  - [ ] Icon changes to 🔓
  - [ ] Tooltip shows who unlocked and when

- [ ] **Lock flow:**
  - [ ] Click 🔓 → Dialog opens
  - [ ] Click "Yes, Lock It" → Entry locks
  - [ ] Icon changes to 🔒
  - [ ] Entry protected again

- [ ] **Permissions:**
  - [ ] Users without `can_edit_time_entries` permission can't unlock
  - [ ] Error message shows if unauthorized

### Database Tests

- [ ] Check `is_locked` updates in database
- [ ] Check `unlocked_by` and `unlocked_at` saved correctly
- [ ] Verify audit log view shows entries

```sql
-- Test queries
SELECT id, is_locked, unlocked_by, unlocked_at
FROM time_entries
WHERE unlocked_at IS NOT NULL
ORDER BY unlocked_at DESC
LIMIT 5;

SELECT * FROM unlocked_time_entries LIMIT 10;
```

## User Permissions

Grant unlock permission to users:

```sql
-- Give permission to specific user
UPDATE app_users
SET can_edit_time_entries = true
WHERE email = 'manager@example.com';

-- Check who has permission
SELECT email, can_edit_time_entries, can_approve_time
FROM app_users
WHERE can_edit_time_entries = true
   OR can_approve_time = true;
```

## Troubleshooting

### "Permission denied" errors

Check RLS policy:
```sql
SELECT * FROM pg_policies
WHERE tablename = 'time_entries'
AND policyname LIKE '%edit%';
```

### Lock/unlock not working

1. Check if functions exist:
```sql
SELECT proname FROM pg_proc
WHERE proname IN ('lock_time_entry', 'unlock_time_entry');
```

2. Test functions directly:
```sql
SELECT unlock_time_entry(7, 'test@example.com');
SELECT lock_time_entry(7, 'test@example.com');
```

### Audit log empty

Check view exists:
```sql
SELECT * FROM unlocked_time_entries LIMIT 5;
```

## Next Steps

1. **Build and test locally:**
   ```bash
   cd frontend
   npm run dev
   ```

2. **Test unlock flow** with a real entry

3. **Verify QB sync** doesn't break when entries unlocked

4. **Deploy to production:**
   ```bash
   npm run build
   git push
   ```

## Summary

**Lock Mechanism:**
- 🔒 = Protected, read-only, QB is source of truth
- 🔓 = Editable, local changes only, QB sync warning shown
- All entries locked by default after QB sync
- Explicit unlock required with acknowledgment
- Audit trail of all unlock events

**User Experience:**
1. Click lock icon → See warning
2. Acknowledge warning → Entry unlocked
3. Make changes (optional)
4. Click to lock again → Entry protected

**Data Integrity:**
- QuickBooks remains source of truth
- Local edits clearly marked and tracked
- Next QB sync can overwrite unlocked entries
- Prevents accidental data conflicts
