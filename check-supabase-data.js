// Check Supabase database for time entries
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
const { createClient } = require('@supabase/supabase-js');

console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'NOT SET');
console.log('Supabase Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'NOT SET');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkData() {
  console.log('🔍 Checking Supabase database...\n');

  // Check time_entries table
  console.log('📊 Time Entries:');
  const { data: entries, error: entriesError, count } = await supabase
    .from('time_entries')
    .select('*', { count: 'exact' });

  if (entriesError) {
    console.error('❌ Error fetching time entries:', entriesError);
  } else {
    console.log(`✅ Total time entries: ${count}`);
    if (entries && entries.length > 0) {
      console.log(`   Sample entry:`, entries[0]);

      // Show date range
      const dates = entries.map(e => e.txn_date).sort();
      console.log(`   Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
    } else {
      console.log('   ⚠️  No time entries found in database');
    }
  }

  console.log('\n📊 Customers:');
  const { data: customers, error: customersError } = await supabase
    .from('customers')
    .select('*')
    .eq('is_active', true);

  if (customersError) {
    console.error('❌ Error fetching customers:', customersError);
  } else {
    console.log(`✅ Total active customers: ${customers?.length || 0}`);
    if (customers && customers.length > 0) {
      console.log(`   Sample customers:`, customers.slice(0, 3).map(c => c.display_name));
    } else {
      console.log('   ⚠️  No customers found in database');
    }
  }

  console.log('\n📊 QB Time Settings:');
  const { data: settings, error: settingsError } = await supabase
    .from('qb_time_settings')
    .select('*')
    .single();

  if (settingsError) {
    console.error('❌ Error fetching QB Time settings:', settingsError);
  } else {
    console.log('✅ QB Time OAuth configured:', !!settings?.access_token);
    console.log('   Access token expires:', settings?.token_expiry);
  }
}

checkData().catch(console.error);
