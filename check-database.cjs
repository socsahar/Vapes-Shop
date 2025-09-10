const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Create Supabase client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDatabase() {
  console.log('🔍 Checking database tables...');

  const tablesToCheck = ['users', 'products', 'general_orders', 'shop_status', 'email_templates'];
  const results = [];

  for (const table of tablesToCheck) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        results.push({ table, exists: false, error: error.message });
      } else {
        results.push({ table, exists: true, count: data?.length || 0 });
      }
    } catch (err) {
      results.push({ table, exists: false, error: err.message });
    }
  }

  console.log('\n📊 Database Status:');
  console.log('==================');
  
  let missingTables = [];
  
  results.forEach(result => {
    if (result.exists) {
      console.log(`✅ ${result.table.padEnd(20)} - EXISTS`);
    } else {
      console.log(`❌ ${result.table.padEnd(20)} - MISSING`);
      missingTables.push(result.table);
    }
  });

  if (missingTables.length > 0) {
    console.log('\n🔧 REQUIRED ACTION:');
    console.log('==================');
    console.log('Missing tables need to be created in Supabase Dashboard:');
    console.log(`📍 https://supabase.com/dashboard/project/wdgodtzlnbchykmyzehi/sql\n`);
    
    if (missingTables.includes('users') || missingTables.includes('products')) {
      console.log('📋 STEP 1: Run main schema (database/schema.sql)');
      console.log('   - Creates: users, products, orders, basic tables\n');
    }
    
    if (missingTables.includes('general_orders') || missingTables.includes('shop_status')) {
      console.log('📋 STEP 2: Run general order system (database/general_order_system.sql)');
      console.log('   - Creates: general_orders, shop_status, email_templates');
      console.log('   - Adds: reminder functions, email system\n');
    }
    
    console.log('💡 After running SQL files, restart your Next.js server.');
  } else {
    console.log('\n🎉 All tables exist! Database is ready.');
  }
}

checkDatabase().catch(console.error);