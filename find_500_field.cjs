const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findField500() {
  try {
    // Test some additional fields that might exist
    const longString500 = 'X'.repeat(500);
    const longString501 = 'X'.repeat(501);
    
    console.log('Testing for 500-character limit fields...');
    
    // Common fields that might have 500 char limits
    const testFields = ['notes', 'details', 'specifications', 'features', 'ingredients', 'tags'];
    
    for (const fieldName of testFields) {
      try {
        console.log(`\nTesting field: ${fieldName}`);
        
        const testData = {
          name: 'Test Product',
          price: 10,
          [fieldName]: longString501  // 501 characters to trigger error
        };
        
        const { data, error } = await supabase
          .from('products')
          .insert(testData)
          .select()
          .single();
        
        if (error) {
          if (error.message.includes('character varying(500)')) {
            console.log(`🎯 FOUND IT! Field '${fieldName}' has 500 character limit`);
            console.log(`Error: ${error.message}`);
          } else if (error.message.includes('does not exist')) {
            console.log(`ℹ️  Field '${fieldName}' does not exist`);
          } else {
            console.log(`❌ Field '${fieldName}' - OTHER ERROR: ${error.message}`);
          }
        } else {
          console.log(`✅ Field '${fieldName}' accepts 501+ characters`);
          // Clean up
          await supabase.from('products').delete().eq('id', data.id);
        }
        
      } catch (err) {
        console.log(`❌ Field '${fieldName}' - EXCEPTION: ${err.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ General error:', error.message);
  }
}

findField500();