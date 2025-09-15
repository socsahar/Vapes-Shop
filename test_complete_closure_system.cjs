const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fxrfxwpzivemwfvlvyxt.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4cmZ4d3B6aXZlbXdmdmx2eXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ5NjQzNTEsImV4cCI6MjA1MDU0MDM1MX0.TKh8PdpKK0mJaLYLQKz4dllJvfOy1RXoMFfHTfNIm20';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCompleteClosure() {
  console.log('🧪 Testing Complete Closure Email System\n');
  
  try {
    // Test 1: Check if order exists with participants
    console.log('1️⃣ Checking for test order with participants...');
    const { data: orders, error: ordersError } = await supabase
      .from('general_orders')
      .select(`
        *,
        order_items!inner(
          id,
          user_id,
          quantity,
          total_price,
          users(email, full_name)
        )
      `)
      .eq('status', 'open')
      .limit(1);
    
    if (ordersError) {
      console.error('❌ Error fetching orders:', ordersError);
      return;
    }
    
    if (!orders || orders.length === 0) {
      console.log('⚠️ No open orders found with participants');
      return;
    }
    
    const testOrder = orders[0];
    console.log(`✅ Found order: "${testOrder.title}" with ${testOrder.order_items.length} participants\n`);
    
    // Test 2: Check templates exist
    console.log('2️⃣ Checking email templates...');
    const { data: templates, error: templateError } = await supabase
      .from('email_templates')
      .select('*')
      .in('name', [
        'order_closure_participant_notification',
        'order_closure_general_notification'
      ]);
    
    if (templateError) {
      console.error('❌ Error fetching templates:', templateError);
      return;
    }
    
    console.log(`✅ Found ${templates.length}/2 required templates\n`);
    
    // Test 3: Get unique participants
    console.log('3️⃣ Analyzing participants...');
    const participantEmails = new Set();
    const participantData = [];
    
    testOrder.order_items.forEach(item => {
      const email = item.users?.email;
      if (email && !participantEmails.has(email)) {
        participantEmails.add(email);
        participantData.push({
          email: item.users.email,
          name: item.users.full_name || 'משתמש',
          totalSpent: 0,
          itemCount: 0
        });
      }
    });
    
    // Calculate totals per participant
    testOrder.order_items.forEach(item => {
      const participant = participantData.find(p => p.email === item.users?.email);
      if (participant) {
        participant.totalSpent += item.total_price;
        participant.itemCount += item.quantity;
      }
    });
    
    console.log(`✅ Found ${participantEmails.size} unique participants:`);
    participantData.forEach(p => {
      console.log(`   📧 ${p.email} - ${p.name} (₪${p.totalSpent}, ${p.itemCount} items)`);
    });
    console.log('');
    
    // Test 4: Check all active users for general notifications
    console.log('4️⃣ Checking all active users for general notifications...');
    const { data: allUsers, error: usersError } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('is_active', true);
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }
    
    console.log(`✅ Found ${allUsers.length} active users who will receive general notifications\n`);
    
    // Test 5: Check admin users for reports
    console.log('5️⃣ Checking admin users for reports...');
    const { data: adminUsers, error: adminError } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('role', 'admin')
      .eq('is_active', true);
    
    if (adminError) {
      console.error('❌ Error fetching admin users:', adminError);
      return;
    }
    
    console.log(`✅ Found ${adminUsers.length} admin users who will receive both reports:`);
    adminUsers.forEach(admin => {
      console.log(`   👑 ${admin.email} - ${admin.full_name || 'Admin'}`);
    });
    console.log('');
    
    // Test 6: Check suppliers for supplier report
    console.log('6️⃣ Analyzing suppliers for supplier report...');
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select(`
        *,
        products(name, supplier_name, supplier_contact)
      `)
      .eq('order_id', testOrder.id);
    
    if (itemsError) {
      console.error('❌ Error fetching order items:', itemsError);
      return;
    }
    
    const supplierGroups = {};
    orderItems.forEach(item => {
      const supplierName = item.products?.supplier_name || 'ספק לא ידוע';
      
      if (!supplierGroups[supplierName]) {
        supplierGroups[supplierName] = {
          contact: item.products?.supplier_contact || '',
          items: 0,
          totalAmount: 0
        };
      }
      
      supplierGroups[supplierName].items += item.quantity;
      supplierGroups[supplierName].totalAmount += item.total_price;
    });
    
    console.log(`✅ Found ${Object.keys(supplierGroups).length} suppliers:`);
    Object.entries(supplierGroups).forEach(([name, data]) => {
      console.log(`   🏢 ${name} - ${data.items} items, ₪${data.totalAmount} ${data.contact ? `(${data.contact})` : ''}`);
    });
    console.log('');
    
    // Summary
    console.log('📊 COMPLETE CLOSURE EMAIL SYSTEM ANALYSIS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📧 ${participantData.length} personalized participant emails`);
    console.log(`📢 ${allUsers.length} general closure notifications to ALL users`);
    console.log(`👑 ${adminUsers.length} admin reports (SYSTEM_ORDER_CLOSED)`);
    console.log(`📊 ${adminUsers.length} supplier reports (SYSTEM_SUPPLIER_REPORT)`);
    console.log(`🏢 ${Object.keys(supplierGroups).length} suppliers in supplier report`);
    console.log(`📨 Total emails: ${participantData.length + allUsers.length + (adminUsers.length * 2)}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ System ready for comprehensive automatic closure emails!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testCompleteClosure();