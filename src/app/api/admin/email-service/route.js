import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Create email transporter with updated Gmail credentials
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Custom sender name and email
const SENDER_EMAIL = `"Vapes-Shop" <${process.env.GMAIL_USER}>`;

// GET - Process pending emails
export async function GET() {
  try {
    console.log('Processing pending emails...');

    // Clean up orphaned email notifications first
    await cleanupOrphanedEmails();

    // Get pending email notifications
    const { data: pendingEmails, error } = await supabase
      .from('email_logs')
      .select('*')
      .eq('status', 'failed') // 'failed' status is used as queue (emails waiting to be sent)
      .limit(10);

    if (error) {
      console.error('Error fetching pending emails:', error);
      return NextResponse.json({ error: 'שגיאה בטעינת אימיילים' }, { status: 500 });
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      return NextResponse.json({ message: 'אין אימיילים ממתינים', processed: 0 });
    }

    let processed = 0;
    let errors = [];

    for (const emailLog of pendingEmails) {
      try {
        await processEmail(emailLog);
        processed++;
      } catch (error) {
        console.error(`Error processing email ${emailLog.id}:`, error);
        errors.push({ id: emailLog.id, error: error.message });
        
        // Mark as failed
        await supabase
          .from('email_logs')
          .update({
            status: 'failed',
            error_message: error.message,
            sent_at: new Date().toISOString()
          })
          .eq('id', emailLog.id);
      }
    }

    return NextResponse.json({
      message: `עובדו ${processed} אימיילים`,
      processed,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Unexpected error in email processing:', error);
    return NextResponse.json({ error: 'שגיאה בעיבוד אימיילים' }, { status: 500 });
  }
}

async function processEmail(emailLog) {
  // Handle system notifications
  if (emailLog.recipient_email.startsWith('SYSTEM_')) {
    return await processSystemNotification(emailLog);
  }

  // Handle order confirmations
  if (emailLog.body.startsWith('USER_ORDER_CONFIRMATION:')) {
    return await processOrderConfirmation(emailLog);
  }

  // Handle regular email
  const mailOptions = {
    from: SENDER_EMAIL,
    to: emailLog.recipient_email,
    subject: emailLog.subject,
    html: emailLog.body
  };

  await transporter.sendMail(mailOptions);

  // Mark as sent
  await supabase
    .from('email_logs')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString()
    })
    .eq('id', emailLog.id);

  console.log(`Email sent to ${emailLog.recipient_email}`);
}

async function processSystemNotification(emailLog) {
  const { recipient_email, body } = emailLog;

  if (recipient_email === 'SYSTEM_ORDER_OPENED') {
    return await sendOrderOpenedNotifications(body);
  }
  
  if (recipient_email === 'SYSTEM_REMINDER_1H') {
    return await sendReminderNotifications(body, '1h');
  }
  
  if (recipient_email === 'SYSTEM_REMINDER_10M') {
    return await sendReminderNotifications(body, '10m');
  }
  
  if (recipient_email === 'SYSTEM_ORDER_CLOSED') {
    return await sendOrderClosedNotifications(body);
  }

  if (recipient_email === 'SYSTEM_GENERAL_ORDER_SUMMARY') {
    return await sendGeneralOrderSummary(body);
  }

  throw new Error(`Unknown system notification type: ${recipient_email}`);
}

async function processOrderConfirmation(emailLog) {
  const { recipient_email, body } = emailLog;
  
  // Parse body: USER_ORDER_CONFIRMATION:participantId:generalOrderId
  const parts = body.split(':');
  if (parts.length !== 3 || parts[0] !== 'USER_ORDER_CONFIRMATION') {
    throw new Error('Invalid order confirmation format');
  }
  
  const participantId = parts[1];
  const generalOrderId = parts[2];
  
  // First try to get participant details (new format)
  let { data: participant, error: participantError } = await supabase
    .from('general_order_participants')
    .select(`
      id,
      user_id,
      total_amount,
      created_at,
      user:user_id(full_name, email),
      general_order:general_order_id(id, title, description, deadline),
      order_items:general_order_items(
        id,
        product_id,
        quantity,
        unit_price,
        total_price,
        product:product_id(name, description, price)
      )
    `)
    .eq('id', participantId)
    .single();

  // If participant not found, try old format (order ID)
  if (participantError || !participant) {
    console.log('Participant not found, trying old format with order ID...');
    
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        user_id,
        total_amount,
        created_at,
        general_order_id
      `)
      .eq('id', participantId)
      .single();

    if (orderError || !order) {
      console.error('Order not found in old format:', { participantError, orderError });
      
      // Mark this email as failed and skip it instead of throwing error
      await supabase
        .from('email_queue')
        .update({ 
          status: 'failed',
          error_message: 'Order participant not found - likely old/invalid queue entry',
          processed_at: new Date().toISOString()
        })
        .eq('id', emailLog.id);
      
      console.log(`Marked email ${emailLog.id} as failed due to missing participant/order`);
      return;
    }

    // Get user data separately
    const { data: userData } = await supabase
      .from('users')
      .select('full_name, email')
      .eq('id', order.user_id)
      .single();

    // Get general order data separately  
    const { data: generalOrderData } = await supabase
      .from('general_orders')
      .select('id, title, description, deadline')
      .eq('id', order.general_order_id)
      .single();

    // Get order items with products separately
    const { data: orderItemsData } = await supabase
      .from('order_items')
      .select(`
        id,
        product_id,
        quantity,
        unit_price,
        total_price
      `)
      .eq('order_id', order.id);

    // Get product details for each item
    const itemsWithProducts = [];
    for (const item of orderItemsData || []) {
      const { data: productData } = await supabase
        .from('products')
        .select('name, description, price')
        .eq('id', item.product_id)
        .single();
      
      itemsWithProducts.push({
        ...item,
        products: productData
      });
    }

    // Convert old format to new format for consistency
    participant = {
      id: order.id,
      user_id: order.user_id,
      total_amount: order.total_amount,
      created_at: order.created_at,
      user: userData,
      general_order: generalOrderData,
      order_items: itemsWithProducts.map(item => ({
        ...item,
        product: item.products
      }))
    };
  }

  // Get email template
  const { data: template, error: templateError } = await supabase
    .from('email_templates')
    .select('*')
    .eq('template_type', 'USER_ORDER_CONFIRMATION')
    .single();

  if (templateError || !template) {
    throw new Error('Order confirmation email template not found');
  }

  // Generate order items HTML
  let orderItemsHtml = '';
  let totalItems = 0;
  
  for (const item of participant.order_items) {
    totalItems += item.quantity;
    orderItemsHtml += `
      <div class="item">
        <div>
          <strong>${item.product.name}</strong><br>
          <small style="color: #666;">${item.product.description || ''}</small>
        </div>
        <div style="text-align: left;">
          <div>כמות: ${item.quantity}</div>
          <div>מחיר יחידה: ₪${item.unit_price}</div>
          <div><strong>סה"כ: ₪${item.total_price}</strong></div>
        </div>
      </div>
    `;
  }

  // Replace template placeholders
  const subject = template.subject_template
    .replace('{{order_title}}', participant.general_order.title);

  const htmlBody = template.body_template
    .replace(/{{customer_name}}/g, participant.user.full_name)
    .replace(/{{order_title}}/g, participant.general_order.title)
    .replace(/{{order_description}}/g, participant.general_order.description || 'ללא תיאור')
    .replace(/{{order_deadline}}/g, new Date(participant.general_order.deadline).toLocaleString('he-IL'))
    .replace(/{{order_id}}/g, participant.id)
    .replace(/{{order_items}}/g, orderItemsHtml)
    .replace(/{{total_amount}}/g, participant.total_amount)
    .replace(/{{total_items}}/g, totalItems)
    .replace(/{{shop_url}}/g, `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/shop`);

  const mailOptions = {
    from: SENDER_EMAIL,
    to: recipient_email,
    subject,
    html: htmlBody
  };

  await transporter.sendMail(mailOptions);
  console.log(`Order confirmation email sent to ${recipient_email} for order ${participant.id}`);
}

async function sendOrderOpenedNotifications(body) {
  // Extract order ID from body
  const orderId = body.split(':')[1];
  
  // Get order details
  const { data: order, error: orderError } = await supabase
    .from('general_orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    throw new Error('Order not found');
  }

  // Get email template
  const { data: template, error: templateError } = await supabase
    .from('email_templates')
    .select('*')
    .eq('template_type', 'GENERAL_ORDER_OPENED')
    .single();

  if (templateError || !template) {
    throw new Error('Email template not found');
  }

  // Get all active users
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('email, full_name')
    .eq('is_active', true);

  if (usersError) {
    throw new Error('Failed to fetch users');
  }

  // Send emails to all users
  for (const user of users) {
    const subject = template.subject_template
      .replace('{{title}}', order.title);

    const htmlBody = template.body_template
      .replace(/{{title}}/g, order.title)
      .replace(/{{description}}/g, order.description || '')
      .replace(/{{deadline}}/g, new Date(order.deadline).toLocaleString('he-IL'))
      .replace(/{{shop_url}}/g, `${process.env.NEXT_PUBLIC_SITE_URL}/shop`)
      .replace(/{{unsubscribe_url}}/g, `${process.env.NEXT_PUBLIC_SITE_URL}/unsubscribe`);

    const mailOptions = {
      from: SENDER_EMAIL,
      to: user.email,
      subject,
      html: htmlBody
    };

    await transporter.sendMail(mailOptions);
  }

  // Mark the system notification as sent
  await supabase
    .from('email_logs')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString()
    })
    .eq('body', `GENERAL_ORDER_OPENED:${orderId}`);

  // Mark order as having opening email sent
  await supabase
    .from('general_orders')
    .update({ opening_email_sent: true })
    .eq('id', orderId);

  console.log(`Order opened notifications sent for order: ${order.title}`);
}

async function sendReminderNotifications(body, reminderType) {
  const orderId = body.split(':')[1];
  
  // Get order details
  const { data: order, error: orderError } = await supabase
    .from('general_orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    throw new Error('Order not found');
  }

  // Get email template
  const templateType = reminderType === '1h' ? 'GENERAL_ORDER_REMINDER_1H' : 'GENERAL_ORDER_REMINDER_10M';
  const { data: template, error: templateError } = await supabase
    .from('email_templates')
    .select('*')
    .eq('template_type', templateType)
    .single();

  if (templateError || !template) {
    throw new Error('Email template not found');
  }

  // Get users who haven't placed orders yet
  const { data: usersWithoutOrders, error: usersError } = await supabase
    .from('users')
    .select('email, full_name, id')
    .eq('is_active', true)
    .not('id', 'in', `(
      SELECT DISTINCT user_id 
      FROM general_order_participants 
      WHERE general_order_id = '${orderId}'
    )`);

  if (usersError) {
    throw new Error('Failed to fetch users without orders');
  }

  // Send reminder emails
  for (const user of usersWithoutOrders) {
    const subject = template.subject_template
      .replace('{{title}}', order.title);

    const htmlBody = template.body_template
      .replace(/{{title}}/g, order.title)
      .replace(/{{shop_url}}/g, `${process.env.NEXT_PUBLIC_SITE_URL}/shop`);

    const mailOptions = {
      from: SENDER_EMAIL,
      to: user.email,
      subject,
      html: htmlBody
    };

    await transporter.sendMail(mailOptions);
  }

  // Mark the system notification as sent
  await supabase
    .from('email_logs')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString()
    })
    .eq('body', body);

  console.log(`${reminderType} reminder notifications sent for order: ${order.title}`);
}

async function sendOrderClosedNotifications(body) {
  const orderId = body.split(':')[1];
  
  // Get order details with participants
  const { data: order, error: orderError } = await supabase
    .from('general_orders')
    .select(`*`)
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    console.error('Error fetching general order:', orderError);
    return { success: false, error: 'הזמנה קבוצתית לא נמצאה' };
  }

  // Get participants (orders) for this general order
  const { data: participants, error: participantsError } = await supabase
    .from('orders')
    .select(`
      id,
      user_id,
      total_amount,
      created_at,
      user:users!orders_user_id_fkey(full_name, email)
    `)
    .eq('general_order_id', orderId);

  if (participantsError) {
    console.error('Error fetching participants:', participantsError);
    return { success: false, error: 'שגיאה בטעינת משתתפים' };
  }

  // Add participants to order object
  order.participants = participants || [];

  // Create closure email content directly (no template dependency)
  const subject = `הזמנה קבוצתית נסגרה - ${order.title}`;
  const participantCount = participants?.length || 0;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right;">
      <h2 style="color: #e74c3c;">🔒 הזמנה קבוצתית נסגרה</h2>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #2c3e50;">${order.title}</h3>
        <p><strong>תיאור:</strong> ${order.description || 'ללא תיאור'}</p>
        <p><strong>תאריך סגירה:</strong> ${new Date().toLocaleString('he-IL')}</p>
      </div>

      <div style="background-color: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h4 style="color: #27ae60; margin-top: 0;">📊 סיכום ההזמנה:</h4>
        <p><strong>מספר משתתפים:</strong> ${participantCount}</p>
      </div>

      <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0;"><strong>💡 מה הלאה?</strong></p>
        <p>החנות כרגע סגורה. נודיע לכם כשתיפתח הזמנה קבוצתית חדשה!</p>
        <p><strong>📱 יש להתעדכן בקבוצת הוואטסאפ בנוגע להגעת ההזמנה:</strong></p>
        <p><a href="https://chat.whatsapp.com/I8mx0Fy7bjq7xsG2EfqMDY" style="color: #25D366; text-decoration: none; font-weight: bold;">🔗 הצטרפו לקבוצת הוואטסאפ</a></p>
      </div>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      
      <p style="color: #666; font-size: 14px;">
        <strong>Vapes-Shop</strong><br>
        החנות המובילה לאביזרי וייפ בישראל
      </p>
    </div>
  `;

  // Get all active users
  const { data: allUsers, error: usersError } = await supabase
    .from('users')
    .select('email, full_name, role')
    .eq('is_active', true);

  if (usersError) {
    throw new Error('Failed to fetch users');
  }

  // Send closure notifications to all users
  for (const user of allUsers) {
    const mailOptions = {
      from: SENDER_EMAIL,
      to: user.email,
      subject,
      html: htmlBody
    };

    await transporter.sendMail(mailOptions);
  }

  // Generate and send PDF reports to admin users only
  const adminUsers = allUsers.filter(user => user.role === 'admin');
  
  if (adminUsers.length > 0) {
    try {
      console.log(`Generating PDF reports for ${adminUsers.length} admin users...`);
      
      // Generate both PDF reports
      const adminPdfResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/admin/generate-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, reportType: 'admin' })
      });

      const supplierPdfResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/admin/generate-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, reportType: 'supplier' })
      });

      if (adminPdfResponse.ok && supplierPdfResponse.ok) {
        const adminPdfBuffer = await adminPdfResponse.arrayBuffer();
        const supplierPdfBuffer = await supplierPdfResponse.arrayBuffer();
        
        const closedDate = new Date();
        const dateStr = closedDate.toISOString().slice(0, 19).replace(/[:]/g, '-');

        // Send PDF reports to admin users
        for (const admin of adminUsers) {
          const adminMailOptions = {
            from: SENDER_EMAIL,
            to: admin.email,
            subject: `דוחות PDF - הזמנה קבוצתית נסגרה: ${order.title}`,
            html: `
              <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right;">
                <h2 style="color: #2c3e50;">📊 דוחות PDF - הזמנה קבוצתית נסגרה</h2>
                <p>שלום ${admin.full_name},</p>
                <p>ההזמנה הקבוצתית "<strong>${order.title}</strong>" נסגרה.</p>
                <p>מצורפים הדוחות הבאים:</p>
                <ul>
                  <li><strong>דוח מנהל</strong> - סיכום משתתפים ותשלומים</li>
                  <li><strong>דוח ספק</strong> - סיכום מוצרים וכמויות</li>
                </ul>
                <hr style="margin: 20px 0;">
                <p style="color: #666; font-size: 14px;">
                  <strong>Vapes-Shop</strong><br>
                  מערכת ניהול הזמנות קבוצתיות
                </p>
              </div>
            `,
            attachments: [
              {
                filename: `admin_report_${dateStr}.pdf`,
                content: Buffer.from(adminPdfBuffer),
                contentType: 'application/pdf'
              },
              {
                filename: `supplier_report_${dateStr}.pdf`,
                content: Buffer.from(supplierPdfBuffer),
                contentType: 'application/pdf'
              }
            ]
          };

          await transporter.sendMail(adminMailOptions);
          console.log(`PDF reports sent to admin: ${admin.email}`);
        }
      } else {
        console.error('Failed to generate PDF reports');
      }
    } catch (pdfError) {
      console.error('Error generating/sending PDF reports:', pdfError);
    }
  }

  // Mark the system notification as sent
  await supabase
    .from('email_logs')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString()
    })
    .eq('body', body);

  console.log(`Order closed notifications sent for order: ${order.title}`);
  return { success: true };
}

// Clean up orphaned email notifications (for orders that no longer exist)
async function cleanupOrphanedEmails() {
  try {
    // Get all system email notifications that reference orders
    const { data: systemEmails, error: emailError } = await supabase
      .from('email_logs')
      .select('id, body')
      .like('recipient_email', 'SYSTEM_%')
      .eq('status', 'failed');

    if (emailError || !systemEmails) return;

    // Extract order IDs from system emails and check if orders still exist
    const orphanedEmails = [];
    
    for (const email of systemEmails) {
      if (email.body && email.body.includes(':')) {
        const orderId = email.body.split(':')[1];
        
        // Check if order still exists
        const { data: order, error: orderError } = await supabase
          .from('general_orders')
          .select('id')
          .eq('id', orderId)
          .single();

        // If order doesn't exist, mark email as orphaned
        if (orderError || !order) {
          orphanedEmails.push(email.id);
        }
      }
    }

    // Remove orphaned emails
    if (orphanedEmails.length > 0) {
      await supabase
        .from('email_logs')
        .delete()
        .in('id', orphanedEmails);
      
      console.log(`Cleaned up ${orphanedEmails.length} orphaned email notifications`);
    }
  } catch (error) {
    console.log('Error during cleanup (non-critical):', error.message);
  }
}

// Send general order summary to admin users
async function sendGeneralOrderSummary(body) {
  // Parse body: GENERAL_ORDER_SUMMARY:orderId:triggerType
  const parts = body.split(':');
  if (parts.length !== 3 || parts[0] !== 'GENERAL_ORDER_SUMMARY') {
    throw new Error('Invalid general order summary format');
  }
  
  const orderId = parts[1];
  const triggerType = parts[2]; // AUTO_CLOSED, MANUAL_CLOSED, etc.
  
  console.log(`Processing general order summary for order ${orderId} (${triggerType})`);

  // Get general order details
  const { data: order, error: orderError } = await supabase
    .from('general_orders')
    .select(`
      *,
      creator:created_by(full_name, email)
    `)
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    throw new Error('General order not found');
  }

  // Get participants and their orders
  const { data: participants, error: participantsError } = await supabase
    .from('general_order_participants')
    .select(`
      *,
      user:user_id(full_name, email),
      order_items:general_order_items(
        quantity,
        product:product_id(name, price)
      )
    `)
    .eq('general_order_id', orderId);

  if (participantsError) {
    console.error('Error fetching participants:', participantsError);
    throw participantsError;
  }

  // Get email template
  const { data: template, error: templateError } = await supabase
    .from('email_templates')
    .select('*')
    .eq('template_type', 'GENERAL_ORDER_SUMMARY')
    .single();

  if (templateError || !template) {
    throw new Error('General order summary email template not found');
  }

  // Calculate statistics
  const totalParticipants = participants?.length || 0;
  const totalOrders = participants?.reduce((sum, p) => sum + (p.order_items?.length || 0), 0) || 0;
  const totalAmount = participants?.reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0) || 0;
  
  // Get unique products
  const uniqueProducts = new Set();
  participants?.forEach(p => {
    p.order_items?.forEach(item => {
      if (item.product?.name) {
        uniqueProducts.add(item.product.name);
      }
    });
  });

  // Generate participants list HTML
  let participantsList = '';
  if (participants && participants.length > 0) {
    participantsList = participants.map(p => {
      const userName = p.user?.full_name || p.user?.email || 'משתמש לא ידוע';
      const amount = parseFloat(p.total_amount || 0).toFixed(2);
      return `
        <div class="participant-item">
          <span class="participant-name">${userName}</span>
          <span class="participant-amount">₪${amount}</span>
        </div>
      `;
    }).join('');
  } else {
    participantsList = '<div class="participant-item"><span class="participant-name">אין משתתפים</span></div>';
  }

  // Get admin users to send summary to
  const { data: adminUsers, error: adminError } = await supabase
    .from('users')
    .select('email, full_name')
    .eq('role', 'admin');

  if (adminError) {
    console.error('Error fetching admin users:', adminError);
    throw adminError;
  }

  if (!adminUsers || adminUsers.length === 0) {
    console.log('No admin users found for general order summary');
    // Mark as sent even if no recipients
    await supabase
      .from('email_logs')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('body', body);
    return { success: true, message: 'No admin users found' };
  }

  // Generate PDF reports for attachments
  let attachments = [];
  try {
    console.log('Generating PDF reports for general order summary...');
    
    const adminPdfResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/admin/generate-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, reportType: 'admin' })
    });

    const supplierPdfResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/admin/generate-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, reportType: 'supplier' })
    });

    if (adminPdfResponse.ok) {
      const adminPdfBuffer = await adminPdfResponse.arrayBuffer();
      attachments.push({
        filename: `admin_report_${orderId}_${new Date().toISOString().split('T')[0]}.pdf`,
        content: Buffer.from(adminPdfBuffer),
        contentType: 'application/pdf'
      });
      console.log('Admin PDF report generated successfully');
    }

    if (supplierPdfResponse.ok) {
      const supplierPdfBuffer = await supplierPdfResponse.arrayBuffer();
      attachments.push({
        filename: `supplier_report_${orderId}_${new Date().toISOString().split('T')[0]}.pdf`,
        content: Buffer.from(supplierPdfBuffer),
        contentType: 'application/pdf'
      });
      console.log('Supplier PDF report generated successfully');
    }
  } catch (pdfError) {
    console.error('Error generating PDF reports for summary email:', pdfError);
    // Continue without attachments if PDF generation fails
  }

  // Send email to each admin
  for (const admin of adminUsers) {
    const personalizedSubject = template.subject_template
      .replace(/{{order_title}}/g, order.title || 'הזמנה קבוצתית')
      .replace(/{{admin_name}}/g, admin.full_name || admin.email);

    const personalizedBody = template.body_template
      .replace(/{{order_title}}/g, order.title || 'הזמנה קבוצתית')
      .replace(/{{order_description}}/g, order.description || 'אין תיאור')
      .replace(/{{order_created}}/g, new Date(order.created_at).toLocaleDateString('he-IL'))
      .replace(/{{order_closed}}/g, new Date().toLocaleDateString('he-IL'))
      .replace(/{{creator_name}}/g, order.creator?.full_name || order.creator?.email || 'לא ידוע')
      .replace(/{{order_status}}/g, order.status === 'closed' ? 'סגורה' : 'פעילה')
      .replace(/{{total_participants}}/g, totalParticipants)
      .replace(/{{total_orders}}/g, totalOrders)
      .replace(/{{total_amount}}/g, totalAmount.toFixed(2))
      .replace(/{{unique_products}}/g, uniqueProducts.size)
      .replace(/{{participants_list}}/g, participantsList)
      .replace(/{{admin_panel_url}}/g, `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/admin`)
      .replace(/{{shop_url}}/g, `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/shop`)
      .replace(/{{current_year}}/g, new Date().getFullYear());

    const mailOptions = {
      from: SENDER_EMAIL,
      to: admin.email,
      subject: personalizedSubject,
      html: personalizedBody,
      attachments: attachments
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`General order summary sent to admin: ${admin.email}`);
    } catch (sendError) {
      console.error(`Failed to send general order summary to ${admin.email}:`, sendError);
    }
  }

  // Mark the system notification as sent
  await supabase
    .from('email_logs')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString()
    })
    .eq('body', body);

  console.log(`General order summary sent to ${adminUsers.length} admin(s) with ${attachments.length} attachments`);
  return { success: true };
}