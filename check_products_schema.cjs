const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkProductsSchema() {
  try {
    // Try to get schema information
    const { data, error } = await supabase.rpc('exec', {
      sql: `
        SELECT column_name, data_type, character_maximum_length 
        FROM information_schema.columns 
        WHERE table_name = 'products' 
        ORDER BY ordinal_position;
      `
    });

    if (error) {
      console.log('❌ Could not get schema info:', error.message);
      
      // Try alternative method - describe table
      const { data: sampleProduct, error: sampleError } = await supabase
        .from('products')
        .select('*')
        .limit(1)
        .single();
      
      if (sampleError) {
        console.log('❌ Could not get sample product:', sampleError.message);
      } else {
        console.log('✅ Sample product structure:');
        console.log('Fields:', Object.keys(sampleProduct));
      }
    } else {
      console.log('✅ Products table schema:');
      console.table(data);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkProductsSchema();