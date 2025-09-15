import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Production-ready email sending function - RESEND ONLY (with better rate limiting)
async function sendEmailWithProviders(mailOptions) {
    if (!process.env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY is not configured. Email service unavailable.');
    }

    try {
        console.log(`📧 Sending email via Resend to: ${mailOptions.to}`);
        
        // Prepare email data for Resend API
        const emailData = {
            from: 'noreply@vapes-shop.top',
            to: Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to],
            subject: mailOptions.subject,
            html: mailOptions.html
        };
        
        // Add attachments if provided
        if (mailOptions.attachments && mailOptions.attachments.length > 0) {
            emailData.attachments = mailOptions.attachments.map(att => ({
                filename: att.filename,
                content: att.content.toString('base64'), // Convert buffer to base64
                contentType: att.contentType || 'application/pdf'
            }));
            console.log(`📎 Including ${emailData.attachments.length} attachments`);
        }
        
        const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(emailData)
        });

        if (resendResponse.ok) {
            const resendData = await resendResponse.json();
            console.log('✅ Email sent successfully via Resend API');
            return { success: true, messageId: resendData.id, service: 'Resend API' };
        } else {
            const resendError = await resendResponse.json();
            console.error('❌ Resend API failed:', resendError);
            throw new Error(`Resend API failed: ${resendError.message || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Email sending failed:', error);
        throw error;
    }
}

// Custom sender email - production ready
const SENDER_EMAIL = 'noreply@vapes-shop.top';

// GET - Process pending emails
export async function GET() {
  try {
    console.log('Processing pending emails...');

    // Clean up orphaned email notifications first
    await cleanupOrphanedEmails();

    // Get pending emails from both email_queue (status='pending') and email_logs (status='failed')
    let allPendingEmails = [];
    
    // Check email_queue table for pending emails
    const { data: queueEmails, error: queueError } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('attempts', 3) // Only retry up to 3 times
      .limit(5);

    if (!queueError && queueEmails) {
      allPendingEmails.push(...queueEmails.map(email => ({ ...email, source: 'email_queue' })));
    }

    // Check email_logs table for failed emails (used as queue)
    const { data: logEmails, error: logError } = await supabase
      .from('email_logs')
      .select('*')
      .eq('status', 'failed') // 'failed' status is used as queue (emails waiting to be sent)
      .limit(5);

    if (!logError && logEmails) {
      allPendingEmails.push(...logEmails.map(email => ({ ...email, source: 'email_logs' })));
    }

    if (queueError && logError) {
      console.error('Error fetching pending emails from both tables:', { queueError, logError });
      return NextResponse.json({ error: 'שגיאה בטעינת אימיילים' }, { status: 500 });
    }

    if (allPendingEmails.length === 0) {
      return NextResponse.json({ message: 'אין אימיילים ממתינים', processed: 0 });
    }

    console.log(`Found ${allPendingEmails.length} pending emails to process`);
    const pendingEmails = allPendingEmails;

    // Rate limiting for Resend free tier: max 2 emails per second
    const RATE_LIMIT_DELAY = 600; // 600ms delay between emails (safer than 1000ms for 2/sec limit)
    const MAX_EMAILS_PER_BATCH = 3; // Process max 3 emails per API call to avoid rate limiting

    // Process only a limited batch to avoid rate limiting
    const emailsToProcess = pendingEmails.slice(0, MAX_EMAILS_PER_BATCH);
    console.log(`Processing ${emailsToProcess.length} emails (rate limited batch)`);

    let processed = 0;
    let errors = [];
    let serviceStats = { 'Resend API': 0 };

    for (const emailLog of emailsToProcess) {
      try {
        // Add delay between emails to respect rate limits
        if (processed > 0) {
          console.log(`⏱️ Waiting ${RATE_LIMIT_DELAY}ms for rate limiting...`);
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
        }

        const result = await processEmail(emailLog);
        if (result && result.service) {
          serviceStats[result.service] = (serviceStats[result.service] || 0) + 1;
        }
        processed++;
      } catch (error) {
        console.error(`Error processing email ${emailLog.id}:`, error);
        errors.push({ id: emailLog.id, error: error.message });
        
        // Check if it's a rate limiting error and handle differently
        if (error.message && error.message.includes('rate_limit_exceeded')) {
          console.log(`🚫 Rate limiting detected - waiting longer before next batch`);
          // Don't mark as permanently failed for rate limit errors, just skip this batch
          break;
        }
        
        // Mark as failed in the correct table for non-rate-limit errors
        const tableName = emailLog.source || 'email_logs';
        const updateData = {
          error_message: error.message,
          sent_at: new Date().toISOString()
        };

        if (tableName === 'email_queue') {
          updateData.status = 'failed';
          updateData.attempts = (emailLog.attempts || 0) + 1;
          updateData.failed_at = new Date().toISOString();
        } else {
          updateData.status = 'failed';
        }

        await supabase
          .from(tableName)
          .update(updateData)
          .eq('id', emailLog.id);
      }
    }

    return NextResponse.json({
      message: `עובדו ${processed} אימיילים מתוך ${allPendingEmails.length} ממתינים`,
      processed,
      pending: allPendingEmails.length - processed,
      rate_limited: true,
      service_stats: serviceStats,
      services_used: Object.entries(serviceStats)
        .filter(([_, count]) => count > 0)
        .map(([service, count]) => `${service}: ${count}`)
        .join(', ') || 'None',
      next_batch_info: allPendingEmails.length > MAX_EMAILS_PER_BATCH ? 'יש עוד אימיילים ממתינים - הפעל שוב לעיבוד נוסף' : null,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Unexpected error in email processing:', error);
    return NextResponse.json({ error: 'שגיאה בעיבוד אימיילים' }, { status: 500 });
  }
}

async function processEmail(emailLog) {
  console.log(`🔍 Processing email: ${emailLog.body || emailLog.html_body} -> ${emailLog.recipient_email}`);
  
  // Helper function to update email status in correct table
  const updateEmailStatus = async (status, errorMessage = null) => {
    const tableName = emailLog.source || 'email_logs';
    const updateData = {
      status,
      sent_at: new Date().toISOString()
    };

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    if (tableName === 'email_queue') {
      if (status === 'failed') {
        updateData.attempts = (emailLog.attempts || 0) + 1;
        updateData.failed_at = new Date().toISOString();
      }
    }

    await supabase
      .from(tableName)
      .update(updateData)
      .eq('id', emailLog.id);
  };
  
  // Validate email address format for real recipients
  if (!emailLog.recipient_email.startsWith('SYSTEM_')) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailLog.recipient_email)) {
      console.log(`Invalid email address: ${emailLog.recipient_email}`);
      await updateEmailStatus('error', 'Invalid email address format');
      throw new Error(`Invalid email address: ${emailLog.recipient_email}`);
    }
  }

  // Get email body from either field (different tables have different field names)
  const emailBody = emailLog.body || emailLog.html_body || '';

  // Handle system notifications (SYSTEM_* recipients)
  if (emailLog.recipient_email.startsWith('SYSTEM_')) {
    console.log('🎯 Routing to processSystemNotification');
    const result = await processSystemNotification(emailLog);
    if (result.success) {
      await updateEmailStatus('sent');
    }
    return result;
  }

  // Handle order confirmations
  if (emailBody.startsWith('USER_ORDER_CONFIRMATION:')) {
    console.log('🎯 Routing to processOrderConfirmation');
    const result = await processOrderConfirmation(emailLog);
    if (result.success) {
      await updateEmailStatus('sent');
    }
    return result;
  }
  
  // Handle general order opened notifications
  if (emailBody.startsWith('GENERAL_ORDER_OPENED:')) {
    const result = await processTemplatedEmail(emailLog, 'GENERAL_ORDER_OPENED');
    if (result.success) {
      await updateEmailStatus('sent');
    }
    return result;
  }
  
  // Handle general order summary notifications
  if (emailBody.startsWith('GENERAL_ORDER_SUMMARY:')) {
    const result = await processTemplatedEmail(emailLog, 'GENERAL_ORDER_SUMMARY');
    if (result.success) {
      await updateEmailStatus('sent');
    }
    return result;
  }
  
  // Handle general order reminders
  if (emailBody.includes('GENERAL_ORDER_REMINDER_1H:')) {
    const result = await processTemplatedEmail(emailLog, 'GENERAL_ORDER_REMINDER_1H');
    if (result.success) {
      await updateEmailStatus('sent');
    }
    return result;
  }
  
  if (emailBody.includes('GENERAL_ORDER_REMINDER_10M:')) {
    const result = await processTemplatedEmail(emailLog, 'GENERAL_ORDER_REMINDER_10M');
    if (result.success) {
      await updateEmailStatus('sent');
    }
    return result;
  }
  
  // Handle general order closed notifications
  if (emailBody.startsWith('GENERAL_ORDER_CLOSED:')) {
    const result = await processTemplatedEmail(emailLog, 'GENERAL_ORDER_CLOSED');
    if (result.success) {
      await updateEmailStatus('sent');
    }
    return result;
  }

  // Handle regular email (for email_queue table with html_body)
  const mailOptions = {
    from: SENDER_EMAIL,
    to: emailLog.recipient_email,
    subject: emailLog.subject,
    html: emailLog.html_body || emailLog.body
  };

  const emailResult = await sendEmailWithProviders(mailOptions);
  console.log(`Email sent via ${emailResult.service} to ${emailLog.recipient_email}`);

  // Mark as sent
  await updateEmailStatus('sent');

  console.log(`Email sent to ${emailLog.recipient_email}`);
  return { success: true, service: emailResult.service };
}

// Generic function to process templated emails
async function processTemplatedEmail(emailLog, templateType) {
  try {
    // Fetch the email template from database
    const { data: emailTemplate, error: templateError } = await supabase
      .from('email_templates')
      .select('subject_template, body_template')
      .eq('template_type', templateType)
      .single();
      
    if (templateError || !emailTemplate) {
      console.error(`Email template not found for ${templateType}:`, templateError);
      throw new Error(`Email template not found for ${templateType}`);
    }
    
    // Parse the email body to extract data
    let orderData = {};
    let recipientEmail = emailLog.recipient_email;
    let isAdminRecipient = false;
    
    // Handle SYSTEM_ recipients by converting to admin email
    if (recipientEmail.startsWith('SYSTEM_')) {
      recipientEmail = process.env.ADMIN_EMAIL;
      if (!recipientEmail) {
        throw new Error('ADMIN_EMAIL environment variable is required for system notifications');
      }
      isAdminRecipient = true; // SYSTEM_ emails are always admin emails
    } else {
      // Check if recipient is an admin user
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('email', recipientEmail)
        .single();
        
      if (!userError && userData && userData.role === 'admin') {
        isAdminRecipient = true;
      }
    }
    
    // Parse different template types
    if (templateType === 'GENERAL_ORDER_OPENED') {
      orderData = await parseGeneralOrderData(emailLog.body, 'GENERAL_ORDER_OPENED');
    } else if (templateType === 'GENERAL_ORDER_SUMMARY') {
      orderData = await parseGeneralOrderSummaryData(emailLog.body, isAdminRecipient);
    } else if (templateType === 'GENERAL_ORDER_REMINDER_1H' || templateType === 'GENERAL_ORDER_REMINDER_10M') {
      orderData = await parseGeneralOrderReminderData(emailLog.body, templateType);
    } else if (templateType === 'GENERAL_ORDER_CLOSED') {
      orderData = await parseGeneralOrderData(emailLog.body, 'GENERAL_ORDER_CLOSED');
    }
    
    // Replace template variables
    let subject = emailTemplate.subject_template || `התראה - ${templateType}`;
    let htmlContent = emailTemplate.body_template || '';
    
    // Common template variables - matching database template names
    const templateVars = {
      // Order basic info - both formats for compatibility
      '{{order_title}}': orderData.orderTitle || '',
      '{{title}}': orderData.orderTitle || '', // Database uses this format
      '{{order_description}}': orderData.orderDescription || orderData.orderTitle || '',
      '{{description}}': orderData.orderDescription || orderData.orderTitle || '', // Database uses this format
      '{{order_id}}': orderData.orderId || '',
      '{{order_number}}': (orderData.orderId || '').substring(0, 8),
      
      // Financial info
      '{{total_amount}}': orderData.totalAmount || '0',
      '{{participant_count}}': orderData.participantCount || '0',
      '{{total_participants}}': orderData.participantCount || '0', // Database uses this format
      '{{total_items}}': orderData.totalItems || orderData.participantCount || '0',
      '{{total_orders}}': orderData.participantCount || '0', // Database uses this format
      '{{unique_products}}': orderData.uniqueProducts || '0', // Database uses this format
      
      // Status and timing
      '{{order_status}}': orderData.status || '',
      '{{closing_time}}': orderData.closingTime || '',
      '{{order_deadline}}': orderData.closingTime || '',
      '{{deadline}}': orderData.closingTime || '', // Database uses this format
      '{{order_created}}': orderData.createdAt || '', // Database uses this format
      '{{order_closed}}': orderData.closedAt || '', // Database uses this format
      
      // Creator info
      '{{creator_name}}': orderData.creatorName || '', // Database uses this format
      
      // URLs
      '{{admin_url}}': `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/admin`,
      '{{admin_panel_url}}': `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/admin`, // Database uses this format
      '{{shop_url}}': `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/shop`,
      '{{unsubscribe_url}}': `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/unsubscribe`, // Database uses this format
      
      // Dates
      '{{current_date}}': new Date().toLocaleDateString('he-IL'),
      '{{current_year}}': new Date().getFullYear().toString(),
      
      // Special data
      '{{trigger_type}}': orderData.triggerType || '',
      '{{participants_list}}': orderData.participantsList || '',
      '{{order_summary}}': orderData.orderSummary || ''
    };
    
    // Replace all template variables in subject and body
    Object.keys(templateVars).forEach(key => {
      subject = subject.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), templateVars[key]);
      htmlContent = htmlContent.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), templateVars[key]);
    });
    
    // If template body is empty, use a basic fallback
    if (!htmlContent || htmlContent.trim() === '') {
      htmlContent = `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>התראה מ-Vapes Shop</h2>
          <p>הודעה בנוגע להזמנה: ${orderData.orderTitle || 'הזמנה קבוצתית'}</p>
          <p>מספר הזמנה: ${(orderData.orderId || '').substring(0, 8)}</p>
          <p>תאריך: ${new Date().toLocaleDateString('he-IL')}</p>
        </div>
      `;
    }
    
    const mailOptions = {
      from: SENDER_EMAIL,
      to: recipientEmail,
      subject: subject,
      html: htmlContent
    };
    
    // Add attachments if available (for GENERAL_ORDER_SUMMARY)
    if (orderData.attachments && orderData.attachments.length > 0) {
      mailOptions.attachments = orderData.attachments;
      console.log(`📎 Adding ${orderData.attachments.length} PDF attachments to email`);
    }

    const emailResult = await sendEmailWithProviders(mailOptions);
    console.log(`${templateType} email sent via ${emailResult.service} to ${recipientEmail} using database template`);

    // Mark as sent
    await supabase
      .from('email_logs')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('id', emailLog.id);

    return emailResult;
    
  } catch (error) {
    console.error(`Error processing ${templateType} email:`, error);
    throw error;
  }
}

// Parse general order data for OPENED/CLOSED templates
async function parseGeneralOrderData(emailBody, templateType) {
  const orderIdMatch = emailBody.match(new RegExp(`${templateType}:(.+)`));
  if (!orderIdMatch) {
    throw new Error(`Invalid ${templateType} format`);
  }
  
  const orderId = orderIdMatch[1];
  
  const { data: orderData, error: orderError } = await supabase
    .from('general_orders')
    .select(`
      id, title, description, status, created_at, closes_at, created_by,
      creator:created_by(full_name)
    `)
    .eq('id', orderId)
    .single();
    
  if (orderError || !orderData) {
    throw new Error('General order not found');
  }
  
  // Get participants from orders table
  const { data: participants, error: participantsError } = await supabase
    .from('orders')
    .select(`
      id, user_id, total_amount,
      users!orders_user_id_fkey(full_name),
      order_items:order_items(product_id)
    `)
    .eq('general_order_id', orderId);
  
  const participantCount = participants?.length || 0;
  const totalAmount = participants?.reduce((sum, p) => sum + (p.total_amount || 0), 0) || 0;
  
  // Get unique products count
  const allOrderItems = participants?.flatMap(p => p.order_items || []) || [];
  const uniqueProductIds = [...new Set(allOrderItems.map(item => item.product_id))];
  const uniqueProducts = uniqueProductIds.length;
  
  return {
    orderId: orderData.id,
    orderTitle: orderData.title,
    orderDescription: orderData.description || orderData.title,
    status: orderData.status,
    participantCount,
    totalAmount,
    uniqueProducts,
    createdAt: orderData.created_at ? new Date(orderData.created_at).toLocaleString('he-IL') : '',
    closingTime: orderData.closes_at ? new Date(orderData.closes_at).toLocaleString('he-IL') : '',
    closedAt: orderData.status === 'closed' ? new Date().toLocaleString('he-IL') : '',
    creatorName: orderData.creator?.full_name || 'מנהל המערכת'
  };
}

// Parse general order summary data
async function parseGeneralOrderSummaryData(emailBody, isAdminRecipient = false) {
  // Parse format: GENERAL_ORDER_SUMMARY:orderId:triggerType
  const parts = emailBody.split(':');
  if (parts.length !== 3 || parts[0] !== 'GENERAL_ORDER_SUMMARY') {
    throw new Error('Invalid general order summary format');
  }
  
  const orderId = parts[1];
  const triggerType = parts[2];
  
  const orderData = await parseGeneralOrderData(`GENERAL_ORDER_SUMMARY:${orderId}`, 'GENERAL_ORDER_SUMMARY');
  
  // Get participants list for summary (using orders table)
  const { data: participants, error: participantsError } = await supabase
    .from('orders')
    .select(`
      id,
      user_id,
      total_amount,
      created_at,
      users!orders_user_id_fkey(full_name, email),
      order_items:order_items(
        id,
        product_id,
        quantity,
        unit_price,
        total_price,
        products:products!order_items_product_id_fkey(name, price)
      )
    `)
    .eq('general_order_id', orderId);
    
  if (!participantsError && participants) {
    const participantsList = participants.map(p => `
      <div style="margin: 10px 0; padding: 10px; border: 1px solid #ddd;">
        <strong>${p.users?.full_name || 'משתמש'}</strong> - ₪${p.total_amount}
        ${p.order_items?.map(item => `
          <div style="margin-left: 20px;">• ${item.products?.name} x${item.quantity} (₪${item.unit_price})</div>
        `).join('') || ''}
      </div>
    `).join('');
    
    orderData.participantsList = participantsList;
    orderData.orderSummary = `סה"כ ${participants.length} משתתפים, בסכום כולל של ₪${orderData.totalAmount}`;
  }
  
  orderData.triggerType = triggerType;
  
  // Generate PDF attachments ONLY for admin users
  if (isAdminRecipient) {
    try {
      console.log('🔐 Admin recipient detected - generating PDF reports for general order summary...');
      
      // Generate admin PDF report
      const adminPdfResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/admin/generate-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderId, reportType: 'admin' })
      });
      
      // Generate supplier PDF report
      const supplierPdfResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/admin/generate-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderId, reportType: 'supplier' })
      });
      
      if (adminPdfResponse.ok && supplierPdfResponse.ok) {
        const adminPdfBuffer = await adminPdfResponse.arrayBuffer();
        const supplierPdfBuffer = await supplierPdfResponse.arrayBuffer();
        
        const dateStr = new Date().toISOString().split('T')[0];
        
        orderData.attachments = [
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
        ];
        
        console.log('✅ PDF reports generated successfully for admin user');
      } else {
        console.log('❌ Failed to generate PDF reports, sending summary without attachments');
        orderData.attachments = [];
      }
    } catch (pdfError) {
      console.error('Error generating PDF reports:', pdfError);
      orderData.attachments = [];
    }
  } else {
    console.log('👤 Regular user recipient - no PDF attachments will be included');
    orderData.attachments = [];
  }
  
  return orderData;
}

// Parse reminder data
async function parseGeneralOrderReminderData(emailBody, templateType) {
  const reminderMatch = emailBody.match(new RegExp(`${templateType}:(.+)`));
  if (!reminderMatch) {
    throw new Error(`Invalid ${templateType} format`);
  }
  
  const orderId = reminderMatch[1];
  return await parseGeneralOrderData(`${templateType}:${orderId}`, templateType);
}

async function processGeneralOrderOpenedNotification(emailLog) {
  // Parse format: GENERAL_ORDER_OPENED:orderId
  const orderIdMatch = emailLog.body.match(/GENERAL_ORDER_OPENED:(.+)/);
  if (!orderIdMatch) {
    throw new Error('Invalid general order opened notification format');
  }
  
  const orderId = orderIdMatch[1];
  
  try {
    // Get order details
    const { data: orderData, error: orderError } = await supabase
      .from('general_orders')
      .select('*')
      .eq('id', orderId)
      .single();
      
    if (orderError || !orderData) {
      throw new Error('General order not found');
    }
    
    // Create admin notification email
    const subject = `🔔 הזמנה קבוצתית חדשה נפתחה - ${orderData.title}`;
    const htmlContent = `
      <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">🌬️ Vapes Shop - התראת מנהל</h1>
          <p style="margin: 10px 0 0 0;">הזמנה קבוצתית חדשה נפתחה</p>
        </div>
        
        <div style="padding: 20px;">
          <h2>הזמנה קבוצתית חדשה נפתחה! 🎉</h2>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; border-right: 4px solid #f97316;">
            <h3 style="color: #f97316; margin-top: 0;">פרטי ההזמנה:</h3>
            <p><strong>כותרת:</strong> ${orderData.title}</p>
            <p><strong>מספר הזמנה:</strong> ${orderData.id.substring(0, 8)}</p>
            <p><strong>תאריך פתיחה:</strong> ${new Date().toLocaleDateString('he-IL')}</p>
            <p><strong>סטטוס:</strong> ${orderData.status === 'open' ? '🟢 פתוחה' : orderData.status}</p>
            ${orderData.description ? `<p><strong>תיאור:</strong> ${orderData.description}</p>` : ''}
          </div>
          
          <div style="margin: 20px 0; text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/admin" 
               style="display: inline-block; background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              צפה בפאנל המנהל
            </a>
          </div>
        </div>
        
        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px; margin: 0;">
            התראה אוטומטית ממערכת Vapes Shop
          </p>
        </div>
      </div>
    `;
    
    const mailOptions = {
      from: SENDER_EMAIL,
      to: emailLog.recipient_email,
      subject: subject,
      html: htmlContent
    };
    
    const emailResult = await sendEmailWithProviders(mailOptions);
    console.log(`General order opened notification sent via ${emailResult.service} to ${emailLog.recipient_email}`);
    
    // Mark as sent
    await supabase
      .from('email_logs')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('id', emailLog.id);
    
    return emailResult;
    
  } catch (error) {
    console.error('Error processing general order opened notification:', error);
    throw error;
  }
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

  if (recipient_email === 'SYSTEM_SUPPLIER_REPORT') {
    return await sendSupplierReport(body);
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
  
  // First try to get order details (using orders table)
  let { data: order, error: orderError } = await supabase
    .from('orders')
    .select(`
      id, user_id, total_amount, status, created_at, general_order_id,
      users!orders_user_id_fkey(full_name, email),
      general_orders!orders_general_order_id_fkey(title, description, deadline, status)
    `)
    .eq('id', participantId)
    .single();

  if (!orderError && order) {
    // Get order items with products
    const { data: orderItemsData, error: itemsError } = await supabase
      .from('order_items')
      .select(`
        id, product_id, quantity, unit_price, total_price,
        products:products!order_items_product_id_fkey(name, description, price)
      `)
      .eq('order_id', order.id);

    // Convert to expected format
    const participant = {
      id: order.id,
      user_id: order.user_id,
      general_order_id: order.general_order_id,
      total_amount: order.total_amount,
      users: order.users,
      general_orders: order.general_orders,
      order_items: orderItemsData || []
    };
  } else {
    console.log('Order not found with ID:', participantId);
    throw new Error('Order/Participant not found');
  }

  // Process the order confirmation email using emailProcessor
  try {
    const result = await processUserOrderConfirmation(participant.id, participant.general_order_id);
    return { success: true, result };
  } catch (emailError) {
    console.error('Error processing order confirmation:', emailError);
    throw emailError;
  }
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

    await sendEmailWithProviders(mailOptions);
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
      FROM orders 
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

    await sendEmailWithProviders(mailOptions);
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

    await sendEmailWithProviders(mailOptions);
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

          await sendEmailWithProviders(adminMailOptions);
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

  // Get participants and their orders (using orders table)
  const { data: participants, error: participantsError } = await supabase
    .from('orders')
    .select(`
      id,
      user_id,
      total_amount,
      created_at,
      user:users!orders_user_id_fkey(full_name, email),
      order_items:order_items(
        id,
        product_id,
        quantity,
        unit_price,
        total_price,
        products:products!order_items_product_id_fkey(name, price, description)
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
      await sendEmailWithProviders(mailOptions);
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

async function sendSupplierReport(body) {
  const orderId = body.split(':')[1] || body; // Support both formats
  
  // Get order details
  const { data: order, error: orderError } = await supabase
    .from('general_orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    console.error('Error fetching order for supplier report:', orderError);
    return { success: false, error: 'הזמנה לא נמצאה' };
  }

  // Get all order items grouped by product
  const { data: orderItems, error: itemsError } = await supabase
    .from('order_items')
    .select(`
      *,
      products(name, supplier_name, supplier_contact)
    `)
    .eq('order_id', orderId);

  if (itemsError) {
    console.error('Error fetching order items for supplier report:', itemsError);
    return { success: false, error: 'שגיאה בטעינת פריטים' };
  }

  // Group items by supplier
  const supplierGroups = {};
  (orderItems || []).forEach(item => {
    const supplierName = item.products?.supplier_name || 'ספק לא ידוע';
    
    if (!supplierGroups[supplierName]) {
      supplierGroups[supplierName] = {
        supplier_contact: item.products?.supplier_contact || '',
        items: [],
        total_quantity: 0,
        total_amount: 0
      };
    }
    
    supplierGroups[supplierName].items.push(item);
    supplierGroups[supplierName].total_quantity += item.quantity;
    supplierGroups[supplierName].total_amount += item.total_price;
  });

  // Get admin users
  const { data: adminUsers, error: adminError } = await supabase
    .from('users')
    .select('email, full_name')
    .eq('role', 'admin')
    .eq('is_active', true);

  if (adminError || !adminUsers || adminUsers.length === 0) {
    console.error('Error fetching admin users:', adminError);
    return { success: false, error: 'לא נמצאו מנהלים' };
  }

  // Create supplier report HTML
  const supplierReportHtml = `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px;">
      <h1 style="color: #2c3e50; text-align: center; margin-bottom: 30px;">
        📊 דוח ספקים - ${order.title || order.name}
      </h1>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 30px;">
        <h2 style="color: #495057; margin-top: 0;">פרטי ההזמנה</h2>
        <p><strong>שם ההזמנה:</strong> ${order.title || order.name}</p>
        <p><strong>תאריך סגירה:</strong> ${new Date().toLocaleString('he-IL')}</p>
        <p><strong>סכום כולל:</strong> ₪${order.total_amount || 0}</p>
        <p><strong>מספר ספקים:</strong> ${Object.keys(supplierGroups).length}</p>
      </div>

      ${Object.entries(supplierGroups).map(([supplierName, supplierData]) => `
        <div style="border: 1px solid #dee2e6; border-radius: 6px; padding: 20px; margin-bottom: 20px;">
          <h3 style="color: #28a745; margin-top: 0; border-bottom: 2px solid #28a745; padding-bottom: 10px;">
            🏢 ${supplierName}
          </h3>
          ${supplierData.supplier_contact ? `<p><strong>איש קשר:</strong> ${supplierData.supplier_contact}</p>` : ''}
          
          <div style="background: #e9ecef; padding: 15px; border-radius: 4px; margin: 15px 0;">
            <p style="margin: 5px 0;"><strong>סה"כ פריטים:</strong> ${supplierData.total_quantity}</p>
            <p style="margin: 5px 0;"><strong>סה"כ סכום:</strong> ₪${supplierData.total_amount}</p>
          </div>

          <h4 style="color: #6c757d; margin: 15px 0 10px 0;">פירוט מוצרים:</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr style="background: #f8f9fa;">
                <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">מוצר</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">כמות</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">מחיר יחידה</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">סכום</th>
              </tr>
            </thead>
            <tbody>
              ${supplierData.items.map(item => `
                <tr>
                  <td style="border: 1px solid #ddd; padding: 8px;">${item.products?.name || 'מוצר לא ידוע'}</td>
                  <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.quantity}</td>
                  <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">₪${item.unit_price}</td>
                  <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">₪${item.total_price}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `).join('')}

      <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 6px; margin-top: 30px;">
        <p style="margin: 0; color: #155724;">
          <strong>📋 סיכום:</strong> דוח זה נוצר אוטומטית בעת סגירת ההזמנה הקבוצתית
        </p>
      </div>
    </div>
  `;

  // Send supplier report to all admin users
  for (const admin of adminUsers) {
    const mailOptions = {
      from: SENDER_EMAIL,
      to: admin.email,
      subject: `📊 דוח ספקים - ${order.title || order.name}`,
      html: supplierReportHtml
    };

    await sendEmailWithProviders(mailOptions);
  }

  // Mark the system notification as sent
  await supabase
    .from('email_logs')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString()
    })
    .eq('body', body);

  console.log(`Supplier report sent to ${adminUsers.length} admin(s) for order: ${order.title || order.name}`);
  return { success: true };
}