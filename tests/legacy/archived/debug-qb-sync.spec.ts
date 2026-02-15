import { test, expect } from '@playwright/test';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

test.describe('QB Sync Debug - Iterative Testing', () => {

  test('Debug QB Sync - Full Analysis', async ({ request }) => {
    console.log('\n========================================');
    console.log('🔍 QB SYNC COMPREHENSIVE DEBUG');
    console.log('========================================\n');

    // Test 1: Check Edge Function is accessible
    console.log('📡 TEST 1: Checking Edge Function accessibility...');
    const healthCheck = await request.post(
      `${SUPABASE_URL}/functions/v1/qb-time-sync`,
      {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        data: {
          startDate: '2026-01-26',
          endDate: '2026-02-01'
        },
        failOnStatusCode: false
      }
    );

    console.log(`   Status: ${healthCheck.status()}`);
    const responseBody = await healthCheck.json().catch(() => healthCheck.text());
    console.log(`   Response:`, responseBody);

    if (healthCheck.status() === 500) {
      const error = responseBody.error || responseBody;
      console.log('\n❌ SYNC FAILED WITH ERROR:');
      console.log(`   ${error}\n`);

      // Analyze the specific error
      if (error.includes('invalid_client')) {
        console.log('🔍 DIAGNOSIS: Invalid Client Credentials');
        console.log('   The QB_CLIENT_ID or QB_CLIENT_SECRET in Supabase is wrong.\n');

        console.log('✅ SOLUTION:');
        console.log('   1. Go to: https://supabase.com/dashboard/project/migcpasmtbdojqphqyzc/settings/functions');
        console.log('   2. Delete QB_CLIENT_ID and QB_CLIENT_SECRET');
        console.log('   3. Add them again with these exact values:\n');
        console.log('   QB_CLIENT_ID=ABnNKfjxSyDmpFKhNK1PbOCTFxv09Dc2MD5AJNLs8cFUOe0FPO');
        console.log('   QB_CLIENT_SECRET=NEsyhDb1g5nficOBremLWqhqSyfwvOLlhkrSBLye\n');

      } else if (error.includes('Token refresh failed')) {
        console.log('🔍 DIAGNOSIS: Token Refresh Failed');
        console.log('   The access token expired and refresh attempt failed.\n');

        console.log('✅ SOLUTION:');
        console.log('   The refresh token may be expired. You need to re-authenticate with QuickBooks.');
        console.log('   1. Go to: http://localhost:3000/settings');
        console.log('   2. Click "Connect to QuickBooks"');
        console.log('   3. Complete OAuth flow to get fresh tokens\n');

      } else if (error.includes('missing') || error.includes('not set')) {
        console.log('🔍 DIAGNOSIS: Missing Environment Variables');
        console.log('   Required secrets are not configured in Supabase.\n');

        console.log('✅ SOLUTION:');
        console.log('   Add these 6 secrets in Supabase Edge Functions:');
        console.log('   - QB_CLIENT_ID');
        console.log('   - QB_CLIENT_SECRET');
        console.log('   - QB_ACCESS_TOKEN');
        console.log('   - QB_REFRESH_TOKEN');
        console.log('   - QB_REALM_ID');
        console.log('   - QB_ENVIRONMENT\n');

      } else {
        console.log('🔍 DIAGNOSIS: Unknown Error');
        console.log('   This is an unexpected error.\n');
        console.log('   Full error message:', error);
      }

      // Test 2: Check Supabase Edge Function Logs
      console.log('📋 NEXT STEP: Check Supabase Edge Function Logs');
      console.log('   URL: https://supabase.com/dashboard/project/migcpasmtbdojqphqyzc/logs/edge-functions');
      console.log('   Look for logs from "qb-time-sync" function');
      console.log('   You should see detailed debug output with emojis (🔄, ✅, ❌)\n');

    } else if (healthCheck.status() === 200) {
      console.log('\n✅ SYNC SUCCEEDED!');
      console.log(`   Synced: ${responseBody.synced}/${responseBody.total} entries`);
      console.log(`   Customers: ${responseBody.customers}`);
      console.log(`   Date Range: ${responseBody.dateRange?.start} to ${responseBody.dateRange?.end}\n`);
    }

    // Test 3: Verify secrets are set (check digest changes)
    console.log('📋 TEST 2: Verifying Supabase secrets configuration...');
    console.log('   Go to: https://supabase.com/dashboard/project/migcpasmtbdojqphqyzc/settings/functions');
    console.log('   Verify these secrets exist and have recent UPDATED timestamps:');
    console.log('   - QB_CLIENT_ID');
    console.log('   - QB_CLIENT_SECRET');
    console.log('   - QB_ACCESS_TOKEN');
    console.log('   - QB_REFRESH_TOKEN');
    console.log('   - QB_REALM_ID (value: 9341455753458595)');
    console.log('   - QB_ENVIRONMENT (value: production)\n');

    // Test 4: Test with minimal date range
    console.log('📋 TEST 3: Testing with single day to minimize data...');
    const minimalTest = await request.post(
      `${SUPABASE_URL}/functions/v1/qb-time-sync`,
      {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        data: {
          startDate: '2026-01-30',
          endDate: '2026-01-30'
        },
        failOnStatusCode: false
      }
    );

    console.log(`   Status: ${minimalTest.status()}`);
    const minimalResponse = await minimalTest.json().catch(() => minimalTest.text());
    console.log(`   Response:`, minimalResponse);

    console.log('\n========================================');
    console.log('📊 SUMMARY');
    console.log('========================================');
    console.log(`Main Test Status: ${healthCheck.status()}`);
    console.log(`Minimal Test Status: ${minimalTest.status()}`);

    if (healthCheck.status() !== 200) {
      console.log('\n❌ QB Sync is NOT working');
      console.log('   Follow the SOLUTION steps above to fix it.');
    } else {
      console.log('\n✅ QB Sync is WORKING!');
    }
    console.log('\n========================================\n');
  });

  test('Test QB Sync with different date ranges', async ({ request }) => {
    console.log('\n🔄 Testing multiple date ranges...\n');

    const dateRanges = [
      { name: 'Today', start: '2026-01-31', end: '2026-01-31' },
      { name: 'This Week', start: '2026-01-26', end: '2026-02-01' },
      { name: 'Last Week', start: '2026-01-19', end: '2026-01-25' },
    ];

    for (const range of dateRanges) {
      console.log(`\n📅 Testing: ${range.name} (${range.start} to ${range.end})`);

      const response = await request.post(
        `${SUPABASE_URL}/functions/v1/qb-time-sync`,
        {
          headers: {
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          },
          data: {
            startDate: range.start,
            endDate: range.end
          },
          failOnStatusCode: false
        }
      );

      const body = await response.json().catch(() => response.text());

      if (response.status() === 200) {
        console.log(`   ✅ Success - Synced ${body.synced} entries from ${body.customers} customers`);
      } else {
        console.log(`   ❌ Failed - ${body.error || body}`);
        break; // Stop testing if one fails
      }
    }
  });
});
