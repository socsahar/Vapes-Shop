const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xsxgkqgqrpzgoxwqiefx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzeGdrcWdxcnB6Z294d3FpZWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY0MTgzMjksImV4cCI6MjA1MTk5NDMyOX0.p2LFmyLPKjLmO_YPnLV3qkCGIK_DYT7jOc1YGNcuAAA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupEmailQueue() {
  try {
    console.log('🧹 Cleaning up old failed email queue entries...');
    
    // Get all pending emails
    const { data: pendingEmails, error } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending');
    
    if (error) {
      throw error;
    }
    
    console.log(`Found ${pendingEmails.length} pending emails`);
    
    let cleanedCount = 0;
    
    for (const email of pendingEmails) {
      // Check if this is an order confirmation email
      if (email.body.startsWith('USER_ORDER_CONFIRMATION:')) {
        const participantId = email.body.split(':')[1];
        console.log(`Checking participant ID: ${participantId}`);
        
        // Try to find the participant in new format
        const { data: participant } = await supabase
          .from('general_order_participants')
          .select('id')
          .eq('id', participantId)
          .single();
        
        if (!participant) {
          // Try old format
          const { data: order } = await supabase
            .from('orders')
            .select('id')
            .eq('id', participantId)
            .single();
          
          if (!order) {
            // Neither found, mark as failed
            await supabase
              .from('email_queue')
              .update({ 
                status: 'failed',
                error_message: 'Order participant not found - cleaned up by script',
                processed_at: new Date().toISOString()
              })
              .eq('id', email.id);
            
            cleanedCount++;
            console.log(`❌ Cleaned up orphaned email: ${email.id}`);
          } else {
            console.log(`✅ Old format order found: ${participantId}`);
          }
        } else {
          console.log(`✅ New format participant found: ${participantId}`);
        }
      }
    }
    
    console.log(`\n🎉 Cleanup completed! Cleaned up ${cleanedCount} orphaned emails.`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

cleanupEmailQueue();