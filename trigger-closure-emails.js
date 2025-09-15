#!/usr/bin/env node

/**
 * Trigger Closure Emails Script
 * Manually triggers closure emails for a specific order to test the email system
 */

const { createClient } = require('@supabase/supabase-js');
const { config } = require('dotenv');

// Load environment variables
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function triggerClosureEmails() {
  console.log('🚀 Triggering closure emails for existing closed order...\n');
  
  try {
    // Get the closed order
    const { data: order, error: orderError } = await supabase
      .from('general_orders')
      .select('*')
      .eq('title', 'הזמנה אחרונה לפני ראש השנה')
      .eq('status', 'closed')
      .single();
      
    if (orderError || !order) {
      console.error('❌ Error finding closed order:', orderError);
      return;
    }
    
    console.log('📦 Found closed order:');
    console.log(`   ID: ${order.id}`);
    console.log(`   Title: ${order.title}`);
    console.log(`   Status: ${order.status}`);
    console.log(`   Closed: ${order.updated_at}`);
    console.log('');
    
    // Step 1: Queue closure notification email for all users
    console.log('📧 Queueing closure notification email for all users...');
    
    const { error: closureEmailError } = await supabase
      .from('email_logs')
      .insert([{
        recipient_email: 'SYSTEM_ORDER_CLOSED',
        subject: `הזמנה קבוצתית נסגרה - ${order.title}`,
        body: `GENERAL_ORDER_CLOSED:${order.id}`,
        status: 'failed', // Use 'failed' as queue status
        created_at: new Date().toISOString()
      }]);

    if (closureEmailError) {
      console.error('❌ Error queueing closure email:', closureEmailError);
      return;
    }
    console.log('✅ Closure notification email queued successfully');
    
    // Step 2: Queue admin summary email
    console.log('📊 Queueing admin summary email with PDF reports...');
    
    const { error: summaryEmailError } = await supabase
      .from('email_logs')
      .insert([{
        recipient_email: 'SYSTEM_GENERAL_ORDER_SUMMARY',
        subject: `סיכום הזמנה קבוצתית - ${order.title}`,
        body: `GENERAL_ORDER_SUMMARY:${order.id}:MANUAL_TRIGGER`,
        status: 'failed', // Use 'failed' as queue status
        created_at: new Date().toISOString()
      }]);

    if (summaryEmailError) {
      console.error('❌ Error queueing summary email:', summaryEmailError);
      return;
    }
    console.log('✅ Admin summary email queued successfully');
    
    // Step 3: Get participants count for info
    const { data: participants, error: participantsError } = await supabase
      .from('orders')
      .select('id, user_id, total_amount, user:users!orders_user_id_fkey(full_name, email)')
      .eq('general_order_id', order.id);
      
    if (!participantsError && participants) {
      console.log(`\n👥 Order has ${participants.length} participants:`);
      participants.forEach((p, index) => {
        console.log(`   ${index + 1}. ${p.user.full_name} (${p.user.email}) - ₪${p.total_amount}`);
      });
    }
    
    console.log('\n🎯 Emails queued successfully! Now run email processor to send them:');
    console.log('   npm run cron    (processes emails as part of cron job)');
    console.log('   OR call email service API directly');
    console.log('\n💡 Check email_logs table to see processing status');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Get order ID from command line argument or use default
const orderTitle = process.argv[2] || 'הזמנה אחרונה לפני ראש השנה';
console.log(`🔍 Looking for closed order: "${orderTitle}"`);

triggerClosureEmails().catch(console.error);