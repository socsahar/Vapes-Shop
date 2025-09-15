const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function sendRealClosureEmails() {
  try {
    console.log('🚀 Triggering REAL closure emails for actual closed order...');
    console.log('📅 Date:', new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }));
    console.log('');

    // Step 1: Use the specific closed general order ID provided
    console.log('🔍 Using specific closed general order...');
    const targetOrderId = 'dbdd4f99-c398-43e8-bd37-3bd1579deb5b';
    
    const { data: closedOrder, error: orderError } = await supabase
      .from('general_orders')
      .select('*')
      .eq('id', targetOrderId)
      .single();

    if (orderError) {
      console.error('❌ Error fetching order:', orderError);
      return;
    }

    if (!closedOrder) {
      console.log('❌ Order not found with ID:', targetOrderId);
      return;
    }

    const order = closedOrder;
    console.log(`✅ Found order: ID ${order.id}`);
    console.log(`   Name: ${order.name || 'Unnamed Order'}`);
    console.log(`   Status: ${order.status}`);
    console.log(`   Total: ₪${order.total_amount || 0}`);
    console.log(`   Created: ${order.created_at}`);

    // Step 2: Find all order items for this order
    console.log('\n🔍 Finding order items...');
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);

    if (itemsError) {
      console.error('❌ Error fetching order items:', itemsError);
      return;
    }

    if (!orderItems || orderItems.length === 0) {
      console.log('❌ No items found for this order');
      return;
    }

    console.log(`✅ Found ${orderItems.length} order items`);

    // Step 3: Get all unique user IDs from order items
    const userIds = [...new Set(orderItems.map(item => item.user_id))].filter(id => id);
    
    if (userIds.length === 0) {
      console.log('❌ No valid user IDs found in order items');
      return;
    }

    console.log(`👥 Found ${userIds.length} unique users in order`);

    // Step 4: Get user details
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, full_name')
      .in('id', userIds);

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }

    if (!users || users.length === 0) {
      console.log('❌ No users found with valid emails');
      return;
    }

    console.log('📧 Users who will receive closure emails:');
    users.forEach(user => {
      console.log(`   - ${user.email} (${user.full_name || 'No name'})`);
    });

    // Step 5: Get the closure email template from database
    console.log('\n📄 Getting closure email template...');
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('template_name', 'general_order_closed')
      .single();

    if (templateError || !template) {
      console.error('❌ Error fetching email template:', templateError);
      console.log('❌ Cannot proceed without email template');
      return;
    }

    console.log(`✅ Found email template: ${template.template_name}`);
    console.log(`   Subject: ${template.subject_template}`);
    console.log(`   Template ID: ${template.id}`);

    // Step 6: Get product details for email content
    const productIds = [...new Set(orderItems.map(item => item.product_id))].filter(id => id);
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

    // Step 7: Queue closure emails for each real user using the database template
    console.log('\n📧 Queueing closure emails using database template...');
    const orderName = order.name || 'הזמנה קבוצתית';
    
    const emailPromises = users.map(async (user) => {
      // Get this user's items in the order
      const userItems = orderItems.filter(item => item.user_id === user.id);
      
      if (userItems.length === 0) {
        console.log(`⚠️ Skipping ${user.email} - no items found`);
        return { success: false, email: user.email, reason: 'No items' };
      }

      // Calculate user's total and create item summary
      let userTotal = 0;
      const itemsSummary = userItems.map(item => {
        const product = productLookup[item.product_id] || { name: 'מוצר לא ידוע', price: 0 };
        const itemPrice = item.unit_price || product.price || 0;
        const itemTotal = item.quantity * itemPrice;
        userTotal += itemTotal;
        return `${product.name} × ${item.quantity} = ₪${itemTotal}`;
      }).join('\n');

      // Use the database template for subject
      const emailSubject = template.subject_template.replace('{order_name}', orderName);

      // Queue the real closure email with template ID
      const { error: queueError } = await supabase
        .from('email_queue')
        .insert({
          recipient_email: user.email,
          subject: emailSubject,
          email_type: 'general_order_close',
          template_id: template.id,
          status: 'pending',
          order_id: order.id,
          created_at: new Date().toISOString()
        });

      if (queueError) {
        console.error(`❌ Error queueing email for ${user.email}:`, queueError);
        return { success: false, email: user.email, error: queueError };
      } else {
        console.log(`✅ Queued closure email for ${user.email} (₪${userTotal})`);
        return { success: true, email: user.email, total: userTotal };
      }
    });

    // Step 8: Queue system notification using template
    const systemSubject = template.subject_template.replace('{order_name}', orderName);
    const totalRevenue = users.reduce((sum, user) => {
      const userItems = orderItems.filter(item => item.user_id === user.id);
      return sum + userItems.reduce((userSum, item) => {
        const itemPrice = item.unit_price || productLookup[item.product_id]?.price || 0;
        return userSum + (item.quantity * itemPrice);
      }, 0);
    }, 0);

    const { error: systemError } = await supabase
      .from('email_queue')
      .insert({
        recipient_email: 'SYSTEM_ORDER_CLOSED',
        subject: systemSubject,
        email_type: 'general_order_close',
        template_id: template.id,
        status: 'pending',
        order_id: order.id,
        created_at: new Date().toISOString()
      });

    if (systemError) {
      console.error('❌ Error queueing system notification:', systemError);
    } else {
      console.log('✅ Queued system notification');
    }

    // Step 9: Wait for results and show summary
    const results = await Promise.all(emailPromises);
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log('\n📊 REAL CLOSURE EMAIL SUMMARY (using database template):');
    console.log(`📄 Template: ${template.template_name}`);
    console.log(`✅ Successfully queued: ${successful.length} user emails`);
    console.log(`❌ Failed to queue: ${failed.length} user emails`);
    console.log(`📧 System notification: ${systemError ? 'Failed' : 'Queued'}`);
    console.log(`💰 Total order value: ₪${totalRevenue}`);

    if (successful.length > 0) {
      console.log('\n💌 Emails queued for:');
      successful.forEach(result => {
        console.log(`   - ${result.email} (₪${result.total})`);
      });
    }

    if (failed.length > 0) {
      console.log('\n❌ Failed emails:');
      failed.forEach(result => {
        console.log(`   - ${result.email}: ${result.reason || 'Error'}`);
      });
    }

    // Step 10: Show current queue status
    console.log('\n📋 CURRENT EMAIL QUEUE:');
    const { data: queueStatus } = await supabase
      .from('email_queue')
      .select('recipient_email, subject, status, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10);

    if (queueStatus && queueStatus.length > 0) {
      console.log(`Found ${queueStatus.length} pending emails:`);
      queueStatus.forEach(email => {
        const isSystem = email.recipient_email.startsWith('SYSTEM_');
        console.log(`   ${isSystem ? '🤖' : '👤'} ${email.recipient_email}`);
        console.log(`     ${email.subject}`);
        console.log('');
      });
    } else {
      console.log('   No pending emails in queue');
    }

    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Run: npm run cron');
    console.log('2. The cron will process these REAL closure emails using the database template');
    console.log('3. Our SYSTEM_ routing fix will handle system notifications');
    console.log('4. All actual users will receive properly formatted closure emails');
    console.log('5. Check email_logs table for delivery results');

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

// Run the script
sendRealClosureEmails()
  .then(() => {
    console.log('\n✅ Real closure emails triggered successfully!');
  })
  .catch(console.error);