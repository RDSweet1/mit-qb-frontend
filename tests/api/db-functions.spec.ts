/**
 * Phase 1: API Tests for DB-Only Edge Functions
 *
 * Tests lock_time_entry, unlock_time_entry, auto_enroll_user, and manage_users.
 * These functions only touch the database (no external APIs) so they're safe
 * to test against production Supabase.
 *
 * NOTE: app_users is NOT readable by anon via REST API. We derive admin emails
 * from time_entries.approved_by (which IS readable) or via auto_enroll_user.
 */
import { test, expect } from '@playwright/test';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const fnHeaders = {
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

const restHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

// ---------- helpers ----------

/**
 * Find an admin email by looking at time_entries.approved_by (readable by anon).
 * Users who approve entries are known to have admin/elevated privileges.
 */
async function getAdminEmail(request: any): Promise<string> {
  const res = await request.get(
    `${SUPABASE_URL}/rest/v1/time_entries?approved_by=not.is.null&select=approved_by&limit=1`,
    { headers: restHeaders }
  );
  const data = await res.json();
  if (data.length > 0 && data[0].approved_by) {
    return data[0].approved_by;
  }
  // Fallback: try auto_enroll_user to discover a working email
  throw new Error('No approved_by email found in time_entries — cannot determine admin');
}

/** Find a locked time entry (safe to unlock + re-lock in tests) */
async function getLockedEntry(request: any): Promise<{ id: number; employee_name: string }> {
  const res = await request.get(
    `${SUPABASE_URL}/rest/v1/time_entries?is_locked=eq.true&order=id.desc&limit=1`,
    { headers: restHeaders }
  );
  const data = await res.json();
  if (!data.length) throw new Error('No locked time entry found');
  return { id: data[0].id, employee_name: data[0].employee_name };
}

// ==================================================================
// lock_time_entry / unlock_time_entry
// ==================================================================

test.describe('lock_time_entry + unlock_time_entry', () => {
  test('CORS preflight returns 200 for lock', async ({ request }) => {
    const res = await request.fetch(
      `${SUPABASE_URL}/functions/v1/lock_time_entry`,
      { method: 'OPTIONS', headers: fnHeaders }
    );
    expect(res.status()).toBe(200);
  });

  test('CORS preflight returns 200 for unlock', async ({ request }) => {
    const res = await request.fetch(
      `${SUPABASE_URL}/functions/v1/unlock_time_entry`,
      { method: 'OPTIONS', headers: fnHeaders }
    );
    expect(res.status()).toBe(200);
  });

  test('unlock then re-lock an entry (round-trip)', async ({ request }) => {
    const adminEmail = await getAdminEmail(request);
    const entry = await getLockedEntry(request);

    // Step 1: unlock
    const unlockRes = await request.post(
      `${SUPABASE_URL}/functions/v1/unlock_time_entry`,
      { headers: fnHeaders, data: { entry_id: entry.id, user_email: adminEmail } }
    );
    expect(unlockRes.ok()).toBeTruthy();
    const unlockBody = await unlockRes.json();
    expect(unlockBody.success).toBe(true);
    expect(unlockBody.entry.is_locked).toBe(false);

    try {
      // Step 2: verify DB shows unlocked
      const checkRes = await request.get(
        `${SUPABASE_URL}/rest/v1/time_entries?id=eq.${entry.id}&select=is_locked,unlocked_by`,
        { headers: restHeaders }
      );
      const [row] = await checkRes.json();
      expect(row.is_locked).toBe(false);
      expect(row.unlocked_by).toBe(adminEmail);
    } finally {
      // Step 3: re-lock to restore state
      const lockRes = await request.post(
        `${SUPABASE_URL}/functions/v1/lock_time_entry`,
        { headers: fnHeaders, data: { entry_id: entry.id, user_email: adminEmail } }
      );
      expect(lockRes.ok()).toBeTruthy();
      const lockBody = await lockRes.json();
      expect(lockBody.success).toBe(true);
      expect(lockBody.entry.is_locked).toBe(true);
    }
  });

  test('locking an already-locked entry returns 400', async ({ request }) => {
    const entry = await getLockedEntry(request);
    const adminEmail = await getAdminEmail(request);

    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/lock_time_entry`,
      { headers: fnHeaders, data: { entry_id: entry.id, user_email: adminEmail } }
    );
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('already locked');
  });

  test('lock with invalid entry_id returns 500', async ({ request }) => {
    const adminEmail = await getAdminEmail(request);

    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/lock_time_entry`,
      { headers: fnHeaders, data: { entry_id: 999999999, user_email: adminEmail } }
    );
    expect(res.status()).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('not found');
  });

  test('unlock with invalid entry_id returns 500', async ({ request }) => {
    const adminEmail = await getAdminEmail(request);

    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/unlock_time_entry`,
      { headers: fnHeaders, data: { entry_id: 999999999, user_email: adminEmail } }
    );
    expect(res.status()).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('not found');
  });

  test('lock with missing fields returns 500', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/lock_time_entry`,
      { headers: fnHeaders, data: {} }
    );
    expect(res.status()).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('Missing required');
  });

  test('unlock with missing fields returns 500', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/unlock_time_entry`,
      { headers: fnHeaders, data: {} }
    );
    expect(res.status()).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('Missing required');
  });
});

// ==================================================================
// auto_enroll_user
// ==================================================================

test.describe('auto_enroll_user', () => {
  const testEmail = `e2e-test-${Date.now()}@test-suite.local`;
  let testUserId: string | null = null;

  test('CORS preflight returns 200', async ({ request }) => {
    const res = await request.fetch(
      `${SUPABASE_URL}/functions/v1/auto_enroll_user`,
      { method: 'OPTIONS', headers: fnHeaders }
    );
    expect(res.status()).toBe(200);
  });

  test('enrolls a new user with default permissions', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/auto_enroll_user`,
      {
        headers: fnHeaders,
        data: { email: testEmail, display_name: 'E2E Test User', entra_id: `test-entra-${Date.now()}` },
      }
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.is_new).toBe(true);
    expect(body.user.email).toBe(testEmail);
    expect(body.permissions.can_view).toBe(true);
    expect(body.permissions.is_admin).toBe(false);
    expect(body.permissions.can_edit_time).toBe(false);
    // Store ID for cleanup
    testUserId = body.user.id;
  });

  test('second call is idempotent (updates last_login, not duplicate)', async ({ request }) => {
    // Ensure user exists first (in case prior test ran in different worker)
    const enrollRes = await request.post(
      `${SUPABASE_URL}/functions/v1/auto_enroll_user`,
      {
        headers: fnHeaders,
        data: { email: testEmail, display_name: 'E2E Test User', entra_id: `test-entra-${Date.now()}` },
      }
    );
    const enrollBody = await enrollRes.json();
    testUserId = enrollBody.user?.id || testUserId;

    // Now call again — should be idempotent
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/auto_enroll_user`,
      {
        headers: fnHeaders,
        data: { email: testEmail, display_name: 'E2E Test User', entra_id: `test-entra-${Date.now()}` },
      }
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.is_new).toBe(false);
    expect(body.user.last_login).toBeTruthy();
    testUserId = body.user.id;
  });

  test('missing email returns 500', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/auto_enroll_user`,
      { headers: fnHeaders, data: { display_name: 'No Email' } }
    );
    expect(res.status()).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('email');
  });

  // Cleanup: delete the test user via manage_users edge function
  test('cleanup: delete test user', async ({ request }) => {
    if (!testUserId) {
      // Try to find via manage_users list
      const adminEmail = await getAdminEmail(request);
      const listRes = await request.post(
        `${SUPABASE_URL}/functions/v1/manage_users`,
        { headers: fnHeaders, data: { action: 'list', admin_email: adminEmail } }
      );
      const listBody = await listRes.json();
      if (listBody.success && listBody.users) {
        const found = listBody.users.find((u: any) => u.email === testEmail);
        if (found) testUserId = found.id;
      }
    }

    if (testUserId) {
      const adminEmail = await getAdminEmail(request);
      const delRes = await request.post(
        `${SUPABASE_URL}/functions/v1/manage_users`,
        {
          headers: fnHeaders,
          data: { action: 'delete', admin_email: adminEmail, user_data: { id: testUserId } },
        }
      );
      const delBody = await delRes.json();
      expect(delBody.success).toBe(true);
    }
  });
});

// ==================================================================
// manage_users
// ==================================================================

test.describe('manage_users', () => {
  const testUserEmail = `manage-test-${Date.now()}@test-suite.local`;
  let createdUserId: string | null = null;

  test('CORS preflight returns 200', async ({ request }) => {
    const res = await request.fetch(
      `${SUPABASE_URL}/functions/v1/manage_users`,
      { method: 'OPTIONS', headers: fnHeaders }
    );
    expect(res.status()).toBe(200);
  });

  test('list action returns array of users', async ({ request }) => {
    const adminEmail = await getAdminEmail(request);

    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/manage_users`,
      { headers: fnHeaders, data: { action: 'list', admin_email: adminEmail } }
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.users)).toBeTruthy();
    expect(body.users.length).toBeGreaterThan(0);

    // Each user should have required fields
    const first = body.users[0];
    expect(first.email).toBeTruthy();
    expect(first.display_name).toBeTruthy();
    expect(typeof first.is_admin).toBe('boolean');
  });

  test('create action adds a new user', async ({ request }) => {
    const adminEmail = await getAdminEmail(request);

    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/manage_users`,
      {
        headers: fnHeaders,
        data: {
          action: 'create',
          admin_email: adminEmail,
          user_data: {
            email: testUserEmail,
            display_name: 'Manage Test User',
            can_view: true,
            can_edit_time: false,
          },
        },
      }
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.user.email).toBe(testUserEmail);
    createdUserId = body.user.id;
  });

  test('delete action removes the test user', async ({ request }) => {
    // If create didn't succeed, try to find via list
    if (!createdUserId) {
      const adminEmail = await getAdminEmail(request);
      const listRes = await request.post(
        `${SUPABASE_URL}/functions/v1/manage_users`,
        { headers: fnHeaders, data: { action: 'list', admin_email: adminEmail } }
      );
      const listBody = await listRes.json();
      if (listBody.success && listBody.users) {
        const found = listBody.users.find((u: any) => u.email === testUserEmail);
        if (found) createdUserId = found.id;
      }
      if (!createdUserId) return; // nothing to delete
    }

    const adminEmail = await getAdminEmail(request);

    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/manage_users`,
      {
        headers: fnHeaders,
        data: { action: 'delete', admin_email: adminEmail, user_data: { id: createdUserId } },
      }
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('non-admin email is rejected', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/manage_users`,
      {
        headers: fnHeaders,
        data: { action: 'list', admin_email: 'not-a-real-admin@example.com' },
      }
    );
    expect(res.status()).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('missing action returns 500', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/manage_users`,
      { headers: fnHeaders, data: { admin_email: 'test@example.com' } }
    );
    expect(res.status()).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});
