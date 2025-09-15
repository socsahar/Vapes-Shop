const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function triggerClosureEmails() {
  try {
    console.log('🔍 Finding closed general orders...');
    
    // Get closed general orders
    const { data: closedOrders, error: orderError } = await supabase
      .from('general_orders')
      .select('*')
      .eq('status', 'closed')
      .order('created_at', { ascending: false });

    if (orderError) {
      console.error('❌ Error fetching orders:', orderError);
      return;
    }

    if (!closedOrders || closedOrders.length === 0) {
      console.log('❌ No closed orders found');
      return;
    }

    console.log(`✅ Found ${closedOrders.length} closed order(s)`);
    
    // Process the most recent closed order
    const targetOrder = closedOrders[0];
    console.log(`🎯 Targeting order: ${targetOrder.name} (ID: ${targetOrder.id})`);
    console.log(`   Status: ${targetOrder.status}`);
    console.log(`   Total: ₪${targetOrder.total_amount}`);

    // Get all users who have items in this order
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('user_id, quantity, product_id, unit_price')
      .eq('order_id', targetOrder.id);

    if (itemsError) {
      console.error('❌ Error fetching order items:', itemsError);
      return;
    }

    if (!orderItems || orderItems.length === 0) {
      console.log('❌ No items found for this order');
      return;
    }

    // Get user details separately
    const userIds = [...new Set(orderItems.map(item => item.user_id))].filter(id => id);
    if (userIds.length === 0) {
      console.log('❌ No valid user IDs found in order items');
      return;
    }

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email')
      .in('id', userIds);

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }

    // Create user lookup
    const userLookup = {};
    (users || []).forEach(user => {
      userLookup[user.id] = user;
    });

    if (itemsError) {
      console.error('❌ Error fetching order items:', itemsError);
      return;
    }

    if (!orderItems || orderItems.length === 0) {
      console.log('❌ No items found for this order');
      return;
    }

    // Get product details separately
    const productIds = [...new Set(orderItems.map(item => item.product_id))];
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, price')
      .in('id', productIds);

    if (productsError) {
      console.error('❌ Error fetching products:', productsError);
      return;
    }

    // Create product lookup
    const productLookup = {};
    (products || []).forEach(product => {
      productLookup[product.id] = product;
    });

    if (itemsError) {
      console.error('❌ Error fetching order items:', itemsError);
      return;
    }

    if (!orderItems || orderItems.length === 0) {
      console.log('❌ No items found for this order');
      return;
    }

    // Get unique users
    const uniqueUsers = [...new Set(orderItems.map(item => item.user_id))].filter(id => id);
    console.log(`👥 Found ${uniqueUsers.length} unique users in this order:`);
    console.log(`📦 Found ${orderItems.length} total items:`);
    
    // Show user emails
    uniqueUsers.forEach(userId => {
      const user = userLookup[userId];
      console.log(`   - ${user ? user.email : userId} (ID: ${userId})`);
    });

    console.log('\n📧 Queueing closure emails...');

    // Queue closure emails for each user
    const emailPromises = uniqueUsers.map(async (userId) => {
      const user = userLookup[userId];
      if (!user || !user.email) {
        console.log(`⚠️ Skipping user ${userId} - no email found`);
        return { success: false, user: userId, error: 'No email' };
      }

      // Get user's items in this order
      const userItems = orderItems.filter(item => item.user_id === userId);
      
      const emailSubject = `הזמנה קבוצתית נסגרה - ${targetOrder.name}`;
      
      // Create user summary
      let userTotal = 0;
      const itemsSummary = userItems.map(item => {
        const product = productLookup[item.product_id] || { name: 'Unknown Product', price: item.unit_price || 0 };
        const itemTotal = item.quantity * (item.unit_price || product.price || 0);
        userTotal += itemTotal;
        return `${product.name} × ${item.quantity} = ₪${itemTotal}`;
      }).join('\n');

      const emailBody = `
שלום,

הזמנה קבוצתית "${targetOrder.name}" נסגרה.

הפריטים שלך בהזמנה:
${itemsSummary}

סה"כ לתשלום: ₪${userTotal}

תשלום יש להעביר במזומן באיסוף או בפייבוקס: 0546743526

תודה על ההשתתפות!
      `.trim();

      // Queue the email in email_queue (for cron processing)
      const { error: queueError } = await supabase
        .from('email_queue')
        .insert({
          recipient_email: user.email,
          subject: emailSubject,
          body: emailBody,
          status: 'pending',
          created_at: new Date().toISOString()
        });

      if (queueError) {
        console.error(`❌ Error queueing email for ${user.email}:`, queueError);
        return { success: false, user: user.email, error: queueError };
      } else {
        console.log(`✅ Queued closure email for ${user.email}`);
        return { success: true, user: user.email };
      }
    });

    // Queue system notification
    const systemEmailSubject = `סיכום הזמנה קבוצתית - ${targetOrder.name}`;
    const systemEmailBody = `
הזמנה קבוצתית "${targetOrder.name}" נסגרה.

סיכום ההזמנה:
- סטטוס: סגורה
- סה"כ הכנסות: ₪${targetOrder.total_amount}
- מספר משתתפים: ${uniqueUsers.length}
- מספר פריטים: ${orderItems.reduce((sum, item) => sum + item.quantity, 0)}

פירוט משתתפים:
${uniqueUsers.map(userId => {
  const user = userLookup[userId];
  return `- ${user ? user.email : userId}`;
}).join('\n')}

זמן סגירה: ${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}
    `.trim();

    // Queue system notification
    const { error: systemQueueError } = await supabase
      .from('email_queue')
      .insert({
        recipient_email: 'SYSTEM_ORDER_CLOSED',
        subject: systemEmailSubject,
        body: systemEmailBody,
        status: 'pending',
        created_at: new Date().toISOString()
      });

    if (systemQueueError) {
      console.error('❌ Error queueing system notification:', systemQueueError);
    } else {
      console.log('✅ Queued system notification');
    }

    // Wait for all user emails to be queued
    const results = await Promise.all(emailPromises);
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log('\n📊 QUEUING SUMMARY:');
    console.log(`✅ Successfully queued: ${successful} user emails`);
    console.log(`❌ Failed to queue: ${failed} user emails`);
    console.log(`📧 System notification: ${systemQueueError ? 'Failed' : 'Queued'}`);
    console.log(`🕒 Total emails queued: ${successful + (systemQueueError ? 0 : 1)}`);

    // Check final email queue status
    const { data: queueStatus } = await supabase
      .from('email_queue')
      .select('recipient_email, subject, status, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10);

    console.log('\n📋 CURRENT EMAIL QUEUE (pending):');
    if (queueStatus && queueStatus.length > 0) {
      queueStatus.forEach(email => {
        console.log(`   - ${email.recipient_email}`);
        console.log(`     ${email.subject}`);
        console.log(`     Status: ${email.status}`);
        console.log('');
      });
    } else {
      console.log('   No pending emails in queue');
    }

    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Run the cron job: npm run cron');
    console.log('2. The cron will call the email service API');
    console.log('3. The email service will process these pending emails');
    console.log('4. Check email_logs table for results');

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

// Run the script
console.log('🚀 Starting closure email trigger...');
console.log('📅 Date:', new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }));
console.log('');

triggerClosureEmails()
  .then(() => {
    console.log('\n✅ Script completed!');
  })
  .catch(console.error);