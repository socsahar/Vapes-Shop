const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function sendClosureEmailsForOrder(orderId) {
  try {
    console.log('📧 Processing closure emails for order:', orderId);
    
    // Get the order details
    const { data: order, error: orderError } = await supabase
      .from('general_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('❌ Order not found:', orderId);
      return false;
    }

    console.log(`✅ Order: ${order.name || 'Unnamed'} (Status: ${order.status})`);

    // Get all items for this order
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)
      .not('user_id', 'is', null);

    if (itemsError || !orderItems || orderItems.length === 0) {
      console.log('⚠️ No items with users found for this order');
      return false;
    }

    // Get unique users
    const userIds = [...new Set(orderItems.map(item => item.user_id))];
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, full_name')
      .in('id', userIds);

    if (usersError || !users || users.length === 0) {
      console.log('⚠️ No users found for this order');
      return false;
    }

    console.log(`👥 Found ${users.length} participants`);

    // Get products for email content
    const productIds = [...new Set(orderItems.map(item => item.product_id))];
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, price')
      .in('id', productIds);

    const productLookup = {};
    (products || []).forEach(product => {
      productLookup[product.id] = product;
    });

    // Get email template
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('template_name', 'general_order_closed')
      .single();

    // Queue emails for each user
    const emailPromises = users.map(async (user) => {
      const userItems = orderItems.filter(item => item.user_id === user.id);
      
      if (userItems.length === 0) return { success: false, user: user.email, reason: 'No items' };

      const userTotal = userItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      const orderName = order.name || 'הזמנה קבוצתית';
      
      const emailSubject = template ? 
        template.subject_template.replace('{order_name}', orderName) :
        `הזמנה קבוצתית נסגרה - ${orderName}`;

      const { error: queueError } = await supabase
        .from('email_queue')
        .insert({
          recipient_email: user.email,
          subject: emailSubject,
          email_type: 'general_order_close',
          template_id: template?.id || null,
          status: 'pending',
          order_id: orderId,
          created_at: new Date().toISOString()
        });

      if (queueError) {
        console.error(`❌ Error queueing email for ${user.email}:`, queueError);
        return { success: false, user: user.email, error: queueError };
      } else {
        console.log(`✅ Queued closure email for ${user.email} (₪${userTotal})`);
        return { success: true, user: user.email, total: userTotal };
      }
    });

    // Queue system notification
    const orderName = order.name || 'הזמנה קבוצתית';
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
        order_id: orderId,
        created_at: new Date().toISOString()
      });

    // Wait for results
    const results = await Promise.all(emailPromises);
    const successful = results.filter(r => r.success);

    console.log(`📧 Queued ${successful.length} closure emails + 1 system notification`);
    
    return successful.length > 0;

  } catch (error) {
    console.error('❌ Error in sendClosureEmailsForOrder:', error);
    return false;
  }
}

// Function to be called when an order is closed
async function processOrderClosure(orderId) {
  console.log('🎯 Order closure detected for:', orderId);
  const success = await sendClosureEmailsForOrder(orderId);
  
  if (success) {
    console.log('✅ Closure emails queued successfully');
  } else {
    console.log('❌ Failed to queue closure emails');
  }
  
  return success;
}

// Export for use in other parts of the system
module.exports = {
  sendClosureEmailsForOrder,
  processOrderClosure
};

// If run directly (for testing with specific order ID)
if (require.main === module) {
  const testOrderId = process.argv[2] || 'dbdd4f99-c398-43e8-bd37-3bd1579deb5b';
  
  console.log('🧪 Testing closure emails for order:', testOrderId);
  processOrderClosure(testOrderId)
    .then(() => console.log('✅ Test completed'))
    .catch(console.error);
}