// Check for 2026 data specifically
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check2026Data() {
  console.log('🔍 Checking for 2026 data...\n');

  // Check for any 2026 entries
  const { data: entries2026, error, count } = await supabase
    .from('time_entries')
    .select('*', { count: 'exact' })
    .gte('txn_date', '2026-01-01')
    .lte('txn_date', '2026-12-31')
    .order('txn_date', { ascending: false });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`📊 Total 2026 entries in database: ${count}`);

  if (entries2026 && entries2026.length > 0) {
    console.log('\n✅ Found 2026 data!');
    console.log(`   Date range: ${entries2026[entries2026.length - 1].txn_date} to ${entries2026[0].txn_date}`);
    console.log(`   Sample entries:`);
    entries2026.slice(0, 3).forEach(e => {
      console.log(`   - ${e.txn_date}: ${e.employee_name} - ${e.hours}h ${e.minutes}m`);
    });
  } else {
    console.log('❌ No 2026 data found in database');
    console.log('\n🔍 Checking what years we DO have:');

    const { data: allEntries } = await supabase
      .from('time_entries')
      .select('txn_date')
      .order('txn_date', { ascending: false })
      .limit(10);

    if (allEntries && allEntries.length > 0) {
      console.log('   Most recent entries:');
      allEntries.forEach(e => console.log(`   - ${e.txn_date}`));
    }
  }

  // Check QB Time settings
  console.log('\n🔍 Checking QB Time OAuth status:');
  const { data: settings, error: settingsError } = await supabase
    .from('qb_time_settings')
    .select('*')
    .single();

  if (settingsError) {
    console.log('❌ No qb_time_settings table found - OAuth may not be configured');
  } else if (settings) {
    const hasToken = !!settings.access_token;
    const tokenExpiry = settings.token_expiry ? new Date(settings.token_expiry) : null;
    const isExpired = tokenExpiry ? tokenExpiry < new Date() : true;

    console.log(`   OAuth Token: ${hasToken ? '✅ Present' : '❌ Missing'}`);
    if (tokenExpiry) {
      console.log(`   Token Expiry: ${tokenExpiry.toLocaleString()}`);
      console.log(`   Status: ${isExpired ? '❌ EXPIRED' : '✅ Valid'}`);
    }
    console.log(`   Last Sync: ${settings.last_sync_at || 'Never'}`);
  }
}

check2026Data().catch(console.error);
