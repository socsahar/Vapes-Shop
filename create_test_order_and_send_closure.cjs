const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTestOrderAndSendClosureEmails() {
  try {
    console.log('🚀 Creating test order with items and sending closure emails...');
    console.log('📅 Date:', new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }));
    console.log('');

    const targetOrderId = 'dbdd4f99-c398-43e8-bd37-3bd1579deb5b';

    // Step 1: Get some real users
    console.log('👥 Getting users from database...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, full_name')
      .limit(3);

    if (usersError || !users || users.length === 0) {
      console.log('❌ No users found, creating test users...');
      
      // Create test users
      const testUsers = [
        { email: 'user1@example.com', full_name: 'משתמש ראשון' },
        { email: 'user2@example.com', full_name: 'משתמש שני' },
        { email: 'admin@vapeshop.com', full_name: 'מנהל החנות' }
      ];

      const { data: createdUsers, error: createError } = await supabase
        .from('users')
        .upsert(testUsers, { onConflict: 'email' })
        .select('id, email, full_name');

      if (createError) {
        console.error('❌ Error creating users:', createError);
        return;
      }

      console.log('✅ Created/found users:', createdUsers.length);
      users = createdUsers;
    } else {
      console.log('✅ Found existing users:', users.length);
    }

    users.forEach(user => {
      console.log(`   - ${user.email} (${user.full_name || 'No name'})`);
    });

    // Step 2: Get some products
    console.log('\n🛍️ Getting products...');
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, price')
      .limit(3);

    if (productsError || !products || products.length === 0) {
      console.log('❌ No products found - cannot create order items');
      return;
    }

    console.log('✅ Found products:', products.length);
    products.forEach(product => {
      console.log(`   - ${product.name} (₪${product.price})`);
    });

    // Step 3: Update the order with a name
    console.log('\n📝 Updating order details...');
    const { data: updatedOrder, error: updateError } = await supabase
      .from('general_orders')
      .update({
        name: 'הזמנה אחרונה לפני ראש השנה',
        status: 'closed',
        total_amount: 656 // Will be calculated from items
      })
      .eq('id', targetOrderId)
      .select('*')
      .single();

    if (updateError) {
      console.error('❌ Error updating order:', updateError);
      return;
    }

    console.log('✅ Updated order:', updatedOrder.name);

    // Step 4: Create order items for users
    console.log('\n📦 Creating order items...');
    const orderItems = [];
    
    // User 1 gets 2 items
    orderItems.push({
      order_id: targetOrderId,
      user_id: users[0].id,
      product_id: products[0].id,
      quantity: 2,
      unit_price: products[0].price,
      total_price: products[0].price * 2,
      order_type: 'general'
    });

    // User 2 gets 3 items  
    orderItems.push({
      order_id: targetOrderId,
      user_id: users[1].id,
      product_id: products[1].id,
      quantity: 3,
      unit_price: products[1].price,
      total_price: products[1].price * 3,
      order_type: 'general'
    });

    // User 3 gets 1 item
    if (users[2] && products[2]) {
      orderItems.push({
        order_id: targetOrderId,
        user_id: users[2].id,
        product_id: products[2].id,
        quantity: 1,
        unit_price: products[2].price,
        total_price: products[2].price * 1,
        order_type: 'general'
      });
    }

    const { error: itemsError } = await supabase
      .from('order_items')
      .upsert(orderItems, { onConflict: 'id' });

    if (itemsError) {
      console.error('❌ Error creating order items:', itemsError);
      return;
    }

    console.log('✅ Created order items:', orderItems.length);
    
    // Calculate total
    const totalAmount = orderItems.reduce((sum, item) => sum + item.total_price, 0);

    // Step 5: Get email template
    console.log('\n📄 Getting email template...');
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('template_name', 'general_order_closed')
      .single();

    if (templateError && templateError.code !== 'PGRST116') {
      console.error('❌ Error fetching template:', templateError);
      return;
    }

    if (!template) {
      console.log('⚠️ No closure template found, using default format');
    } else {
      console.log('✅ Found email template:', template.template_name);
    }

    // Step 6: Queue closure emails
    console.log('\n📧 Queueing closure emails...');
    const orderName = updatedOrder.name;
    
    const emailPromises = users.map(async (user) => {
      // Get this user's items
      const userItems = orderItems.filter(item => item.user_id === user.id);
      
      if (userItems.length === 0) {
        console.log(`⚠️ Skipping ${user.email} - no items`);
        return { success: false, email: user.email, reason: 'No items' };
      }

      const userTotal = userItems.reduce((sum, item) => sum + item.total_price, 0);
      const emailSubject = template ? 
        template.subject_template.replace('{order_name}', orderName) :
        `הזמנה קבוצתית נסגרה - ${orderName}`;

      // Queue closure email
      const { error: queueError } = await supabase
        .from('email_queue')
        .insert({
          recipient_email: user.email,
          subject: emailSubject,
          email_type: 'general_order_close',
          template_id: template?.id || null,
          status: 'pending',
          order_id: targetOrderId,
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

    // Queue system notification
    const systemSubject = template ?
      template.subject_template.replace('{order_name}', orderName) :
      `סיכום הזמנה קבוצתית - ${orderName}`;

    const { error: systemError } = await supabase
      .from('email_queue')
      .insert({
        recipient_email: 'SYSTEM_ORDER_CLOSED',
        subject: systemSubject,
        email_type: 'general_order_close',
        template_id: template?.id || null,
        status: 'pending',
        order_id: targetOrderId,
        created_at: new Date().toISOString()
      });

    if (systemError) {
      console.error('❌ Error queueing system notification:', systemError);
    } else {
      console.log('✅ Queued system notification');
    }

    // Wait for results
    const results = await Promise.all(emailPromises);
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log('\n📊 CLOSURE EMAIL SUMMARY:');
    console.log(`✅ Successfully queued: ${successful.length} user emails`);
    console.log(`❌ Failed to queue: ${failed.length} user emails`);
    console.log(`📧 System notification: ${systemError ? 'Failed' : 'Queued'}`);
    console.log(`💰 Total order value: ₪${totalAmount}`);

    console.log('\n💌 Emails will be sent to:');
    successful.forEach(result => {
      console.log(`   - ${result.email} (personal summary with ₪${result.total})`);
    });

    // Show queue
    const { data: queueStatus } = await supabase
      .from('email_queue')
      .select('recipient_email, subject, status')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5);

    console.log('\n📋 CURRENT EMAIL QUEUE:');
    if (queueStatus && queueStatus.length > 0) {
      queueStatus.forEach(email => {
        const isSystem = email.recipient_email.startsWith('SYSTEM_');
        console.log(`   ${isSystem ? '🤖' : '👤'} ${email.recipient_email}`);
        console.log(`     ${email.subject}`);
      });
    }

    console.log('\n🎯 WHAT HAPPENS WHEN PROCESSED:');
    console.log('1. Each user gets their PERSONAL closure email');
    console.log('2. Email contains THEIR specific items and quantities');
    console.log('3. Email shows THEIR total amount to pay');
    console.log('4. Email includes payment instructions');
    console.log('5. System gets summary of all participants');

    console.log('\n🚀 NEXT: Run npm run cron to process these emails!');

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

// Run the script
createTestOrderAndSendClosureEmails()
  .then(() => {
    console.log('\n✅ Test order created and closure emails queued!');
  })
  .catch(console.error);