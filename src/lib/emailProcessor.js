import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Production-ready email sending function - RESEND ONLY
async function sendEmailWithProviders(mailOptions) {
    if (!process.env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY is not configured. Email service unavailable.');
    }

    try {
        console.log(`Sending email via Resend to: ${mailOptions.to}`);
        
        const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: 'noreply@vapes-shop.top',
                to: Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to],
                subject: mailOptions.subject,
                html: mailOptions.html
            })
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

// Process a single queued email
export async function processQueuedEmails() {
    try {

        // Get pending email notifications
        const { data: pendingEmails, error } = await supabase
            .from('email_logs')
            .select('*')
            .eq('status', 'failed') // 'failed' status is used as queue (emails waiting to be sent)
            .limit(5); // Process fewer at a time to avoid timeouts

        if (error) {
            console.error('Error fetching pending emails:', error);
            return { success: false, error: 'Error fetching emails' };
        }

        if (!pendingEmails || pendingEmails.length === 0) {
            console.log('No pending emails to process');
            return { success: true, processed: 0, message: 'No pending emails' };
        }

        let processed = 0;
        let errors = [];

        for (const emailLog of pendingEmails) {
            try {
                const result = await processEmail(emailLog);
                if (result && result.success !== false) {
                    processed++;
                    console.log(`Processed email ${emailLog.id} to ${emailLog.recipient_email}`);
                } else {
                    // Email was handled but not sent (e.g., invalid address)
                    console.log(`Skipped email ${emailLog.id}: ${result?.reason || 'Unknown reason'}`);
                }
            } catch (error) {
                console.error(`Error processing email ${emailLog.id}:`, error);
                errors.push({ id: emailLog.id, error: error.message });
                
                // Mark as failed with error
                await supabase
                    .from('email_logs')
                    .update({
                        status: 'error',
                        error_message: error.message,
                        sent_at: new Date().toISOString()
                    })
                    .eq('id', emailLog.id);
            }
        }

        return {
            success: true,
            processed,
            errors: errors.length > 0 ? errors : undefined,
            message: `Processed ${processed} emails`
        };

    } catch (error) {
        console.error('Unexpected error in email processing:', error);
        return { success: false, error: error.message };
    }
}

async function processEmail(emailLog) {
    const SENDER_EMAIL = process.env.SENDER_EMAIL || 'noreply@vapes-shop.top';
    
    // Skip system notifications with invalid email addresses
    if (emailLog.recipient_email.startsWith('SYSTEM_')) {
        console.log(`Skipping system notification: ${emailLog.recipient_email}`);
        // Mark as processed but skip actual sending
        await supabase
            .from('email_logs')
            .update({
                status: 'skipped',
                error_message: 'System notification skipped - no recipient',
                sent_at: new Date().toISOString()
            })
            .eq('id', emailLog.id);
        return { success: true, service: 'Skipped' };
    }

    // Validate email address format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailLog.recipient_email)) {
        console.log(`Invalid email address detected: ${emailLog.recipient_email} - marking as permanently failed`);
        await supabase
            .from('email_logs')
            .update({
                status: 'permanently_failed',
                error_message: `Invalid email address format: ${emailLog.recipient_email}`,
                sent_at: new Date().toISOString()
            })
            .eq('id', emailLog.id);
        
        // Return success to continue processing other emails, don't throw error
        return { success: false, reason: 'Invalid email address - marked as permanently failed' };
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

    const emailResult = await sendEmailWithProviders(mailOptions);
    console.log(`Email sent via ${emailResult.service} to ${emailLog.recipient_email}`);

    // Mark as sent
    await supabase
        .from('email_logs')
        .update({
            status: 'sent',
            sent_at: new Date().toISOString()
        })
        .eq('id', emailLog.id);

    return emailResult;
}

async function processOrderConfirmation(emailLog) {
    // Parse format: USER_ORDER_CONFIRMATION:participantId:generalOrderId OR USER_ORDER_CONFIRMATION:orderId:generalOrderId
    const bodyParts = emailLog.body.split(':');
    
    if (bodyParts.length !== 3 || bodyParts[0] !== 'USER_ORDER_CONFIRMATION') {
        console.error('Invalid order confirmation format:', emailLog.body);
        throw new Error('Invalid order confirmation data format');
    }
    
    const participantOrOrderId = bodyParts[1];
    const generalOrderId = bodyParts[2];
    
    let orderData;
    let orderItems = [];
    
    try {
        // Fetch the email template from database
        const { data: emailTemplate, error: templateError } = await supabase
            .from('email_templates')
            .select('subject_template, body_template')
            .eq('template_type', 'USER_ORDER_CONFIRMATION')
            .single();
            
        if (templateError || !emailTemplate) {
            console.error('Email template not found:', templateError);
            throw new Error('Email template not found for USER_ORDER_CONFIRMATION');
        }
        
        // Get order data directly (current system uses orders table)
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select(`
                id, total_amount, status, created_at, general_order_id,
                users(full_name, email),
                general_orders(title, description, deadline, status)
            `)
            .eq('id', participantOrOrderId)
            .single();
            
        if (!orderError && order) {
            // Get order items
            const { data: items, error: itemsError } = await supabase
                .from('order_items')
                .select(`
                    quantity, unit_price,
                    products(name)
                `)
                .eq('order_id', order.id);
                
            orderItems = items || [];
            
            orderData = {
                orderNumber: order.id,
                customerName: order.users?.full_name || 'לקוח יקר',
                totalAmount: order.total_amount,
                status: order.status || 'pending',
                generalOrderTitle: order.general_orders?.title || 'הזמנה קבוצתית',
                orderTitle: order.general_orders?.title || 'הזמנה קבוצתית',
                orderDescription: order.general_orders?.description || order.general_orders?.title || 'הזמנה קבוצתית',
                deadline: order.general_orders?.deadline
            };
        } else {
            throw new Error('Order not found');
        }

        // Build order items HTML for template
        const itemsHtml = orderItems.length > 0 ? orderItems.map(item => `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.products?.name || 'מוצר'}</td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">₪${item.unit_price}</td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: bold;">₪${(item.quantity * item.unit_price).toFixed(0)}</td>
            </tr>
        `).join('') : '<tr><td colspan="4" style="padding: 16px; text-align: center; color: #6b7280;">אין פריטים להצגה</td></tr>';

        // Replace template variables
        let subject = emailTemplate.subject_template || 'אישור הזמנה';
        let htmlContent = emailTemplate.body_template || '';
        
        const templateVars = {
            // Basic order info
            '{{order_title}}': orderData.orderTitle || orderData.generalOrderTitle || 'הזמנה קבוצתית',
            '{{order_description}}': orderData.orderDescription || orderData.generalOrderTitle || 'הזמנה קבוצתית',
            '{{customer_name}}': orderData.customerName || 'לקוח יקר',
            '{{order_number}}': (orderData.orderNumber || '').substring(0, 8),
            '{{order_id}}': orderData.orderNumber || 'לא זמין',
            
            // Financial info  
            '{{total_amount}}': orderData.totalAmount || '0',
            '{{total_items}}': orderItems.reduce((sum, item) => sum + (item.quantity || 0), 0).toString(),
            
            // Status and timing
            '{{order_status}}': orderData.status === 'pending' ? 'ממתין לסגירת ההזמנה' : orderData.status,
            '{{order_deadline}}': orderData.deadline ? new Date(orderData.deadline).toLocaleString('he-IL') : 'לא הוגדר',
            '{{order_date}}': new Date().toLocaleDateString('he-IL'),
            
            // Content
            '{{order_items}}': itemsHtml,
            
            // URLs and dates
            '{{shop_url}}': `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/shop`,
            '{{current_year}}': new Date().getFullYear().toString()
        };
        
        // Replace all template variables in subject and body
        Object.keys(templateVars).forEach(key => {
            subject = subject.replace(new RegExp(key, 'g'), templateVars[key]);
            htmlContent = htmlContent.replace(new RegExp(key, 'g'), templateVars[key]);
        });
        
        // If template body is empty or doesn't exist, use a fallback
        if (!htmlContent || htmlContent.trim() === '') {
            htmlContent = `
                <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2>שלום ${orderData.customerName}!</h2>
                    <p>תודה על הזמנתך להזמנה הקבוצתית: ${orderData.orderTitle}</p>
                    <p><strong>מספר הזמנה:</strong> ${orderData.orderNumber.substring(0, 8)}</p>
                    <p><strong>סכום:</strong> ₪${orderData.totalAmount}</p>
                    <p><strong>תאריך:</strong> ${new Date().toLocaleDateString('he-IL')}</p>
                    <p>תודה שבחרת בנו!</p>
                </div>
            `;
        }

        const mailOptions = {
            from: process.env.SENDER_EMAIL || 'noreply@vapes-shop.top',
            to: emailLog.recipient_email,
            subject: subject,
            html: htmlContent
        };

        const emailResult = await sendEmailWithProviders(mailOptions);
        console.log(`Order confirmation email sent via ${emailResult.service} to ${emailLog.recipient_email} using database template`);

        // Mark as sent
        await supabase
            .from('email_logs')
            .update({
                status: 'sent',
                sent_at: new Date().toISOString()
            })
            .eq('id', emailLog.id);

        return emailResult;
        
    } catch (dbError) {
        console.error('Error processing order confirmation:', dbError);
        throw new Error('Could not process order confirmation - ' + dbError.message);
    }
}