const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testFieldLimits() {
  try {
    // Create a very long string (600 characters)
    const longString = 'A'.repeat(600);
    const mediumString = 'B'.repeat(300);
    
    console.log('Testing field limits...');
    
    // Test each field that might have limits
    const testFields = {
      name: longString,
      description: longString,
      category: longString,
      sku: longString,
      status: longString
    };
    
    for (const [fieldName, value] of Object.entries(testFields)) {
      try {
        console.log(`\nTesting field: ${fieldName} (${value.length} chars)`);
        
        const testData = {
          name: 'Test Product',
          price: 10,
          description: 'Test',
          category: 'Test',
          [fieldName]: value
        };
        
        const { data, error } = await supabase
          .from('products')
          .insert(testData)
          .select()
          .single();
        
        if (error) {
          if (error.message.includes('value too long')) {
            console.log(`❌ Field '${fieldName}' has character limit - ERROR: ${error.message}`);
          } else {
            console.log(`❌ Field '${fieldName}' - OTHER ERROR: ${error.message}`);
          }
        } else {
          console.log(`✅ Field '${fieldName}' accepts long values`);
          // Clean up - delete the test product
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

testFieldLimits();