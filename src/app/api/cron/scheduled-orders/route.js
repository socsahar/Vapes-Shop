import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
    try {
        // Basic security: check for a secret key in query params or headers
        const secretKey = request.nextUrl.searchParams.get('key') || request.headers.get('x-cron-key');
        const expectedKey = process.env.CRON_SECRET_KEY || 'your-secret-cron-key';
        
        if (!secretKey || secretKey !== expectedKey) {
            console.log('❌ Unauthorized cron attempt:', {
                provided: secretKey ? 'PROVIDED' : 'MISSING',
                ip: request.headers.get('x-forwarded-for') || 'unknown',
                userAgent: request.headers.get('user-agent') || 'unknown'
            });
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('🤖 [CRON] Starting General Order Automation Cron with Activity Logging...');
        const overallStartTime = Date.now();
        
        // Check if we should run daily cleanup (only once per day at 2 AM)
        const now = new Date();
        const hour = now.getHours();
        const shouldRunCleanup = hour === 2; // Run at 2 AM
        
        // Build tasks list
        const tasks = [
            runWithLogging('auto_open_orders', autoOpenFutureOrders),
            runWithLogging('auto_close_orders', autoCloseExpiredOrders),
            runWithLogging('send_reminder_emails', sendReminderEmails),
            runWithLogging('process_email_queue', processEmailQueue)
        ];
        
        // Add cleanup task if it's 2 AM
        if (shouldRunCleanup) {
            console.log('🧹 Running daily inactive users cleanup...');
            tasks.push(runWithLogging('cleanup_inactive_users', cleanupInactiveUsers));
        }
        
        // Run all automation tasks in parallel
        const results = await Promise.allSettled(tasks);
        
        const totalDuration = Date.now() - overallStartTime;
        
        // Check results
        const failed = results.filter(r => r.status === 'rejected');
        const succeeded = results.filter(r => r.status === 'fulfilled');
        
        console.log(`✅ Cron completed: ${succeeded.length} succeeded, ${failed.length} failed in ${totalDuration}ms`);
        
        return NextResponse.json({ 
            success: failed.length === 0,
            message: `General Order Automation completed: ${succeeded.length}/${results.length} tasks succeeded`,
            duration_ms: totalDuration,
            tasks_completed: succeeded.length,
            tasks_failed: failed.length,
            failures: failed.map(f => f.reason?.message || f.reason),
            timestamp: new Date().toISOString(),
            service: 'scheduled-orders-cron'
        });
        
    } catch (error) {
        console.error('❌ [CRON] General cron job failed:', error);
        
        return NextResponse.json({ 
            success: false, 
            error: error.message,
            timestamp: new Date().toISOString(),
            service: 'scheduled-orders-cron'
        }, { status: 500 });
    }
}

// Helper function for logging
async function runWithLogging(jobName, jobFunction) {
  const startTime = Date.now();
  console.log(`� Starting ${jobName}...`);
  
  try {
    const result = await jobFunction();
    const duration = Date.now() - startTime;
    console.log(`✅ ${jobName} completed successfully in ${duration}ms`);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ ${jobName} failed:`, error);
    throw error;
  }
}

/**
 * Auto-open general orders that are scheduled to open now
 */
async function autoOpenFutureOrders() {
  console.log('🔍 Checking for orders to auto-open...');
  
  const now = new Date().toISOString();
  
  // Find scheduled orders that should be opened now
  const { data: ordersToOpen, error: fetchError } = await supabase
    .from('general_orders')
    .select('*')
    .eq('status', 'scheduled')
    .lte('opening_time', now);

  if (fetchError) {
    throw new Error(`Error fetching orders to open: ${fetchError.message}`);
  }

  if (!ordersToOpen || ordersToOpen.length === 0) {
    console.log('📭 No orders ready to open');
    return { opened: 0 };
  }

  console.log(`🎯 Found ${ordersToOpen.length} orders ready to open`);
  
  let opened = 0;
  for (const order of ordersToOpen) {
    try {
      console.log(`📦 Opening order: ${order.title} (ID: ${order.id})`);
      
      // Update order status to 'open'
      const { error: updateError } = await supabase
        .from('general_orders')
        .update({ 
          status: 'open',
          updated_at: now
        })
        .eq('id', order.id);

      if (updateError) {
        throw new Error(`Failed to update order ${order.id}: ${updateError.message}`);
      }

      // Update shop status
      await updateShopStatus(true, order.id, `החנות פתוחה להזמנות! הזמנה קבוצתית: ${order.title}`);
      
      // Queue opening emails
      await queueOpeningEmails(order);
      
      opened++;
      console.log(`✅ Successfully opened order: ${order.title}`);
      
    } catch (error) {
      console.error(`❌ Error opening order ${order.id}:`, error);
    }
  }
  
  return { opened };
}

/**
 * Auto-close general orders that have expired
 */
async function autoCloseExpiredOrders() {
  console.log('🔍 Checking for orders to auto-close...');
  
  const now = new Date().toISOString();
  
  // Find open orders that have expired
  const { data: ordersToClose, error: fetchError } = await supabase
    .from('general_orders')
    .select('*')
    .eq('status', 'open')
    .lt('deadline', now);

  if (fetchError) {
    throw new Error(`Error fetching expired orders: ${fetchError.message}`);
  }

  if (!ordersToClose || ordersToClose.length === 0) {
    console.log('📭 No orders to close');
    return { closed: 0 };
  }

  console.log(`🎯 Found ${ordersToClose.length} expired orders to close`);
  
  let closed = 0;
  for (const order of ordersToClose) {
    try {
      console.log(`📦 Closing expired order: ${order.title} (ID: ${order.id})`);
      
      // Update order status to 'closed'
      const { error: updateError } = await supabase
        .from('general_orders')
        .update({ 
          status: 'closed',
          updated_at: now
        })
        .eq('id', order.id);

      if (updateError) {
        throw new Error(`Failed to close order ${order.id}: ${updateError.message}`);
      }

      // Close shop
      await updateShopStatus(false, null, 'החנות סגורה כרגע');
      
      // Queue closure emails if not already sent
      if (!order.closure_email_sent) {
        await queueClosureEmails(order);
        
        // Mark closure email as sent
        await supabase
          .from('general_orders')
          .update({ closure_email_sent: true })
          .eq('id', order.id);
      }
      
      closed++;
      console.log(`✅ Successfully closed order: ${order.title}`);
      
    } catch (error) {
      console.error(`❌ Error closing order ${order.id}:`, error);
    }
  }
  
  return { closed };
}

/**
 * Send reminder emails for orders approaching deadline
 */
async function sendReminderEmails() {
  console.log('🔍 Checking for orders needing reminders...');
  
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  
  // Find orders needing 1-hour reminders
  const { data: oneHourReminders } = await supabase
    .from('general_orders')
    .select('*')
    .eq('status', 'open')
    .eq('reminder_1h_sent', false)
    .lte('deadline', oneHourFromNow);

  // Find orders needing 10-minute reminders  
  const { data: tenMinuteReminders } = await supabase
    .from('general_orders')
    .select('*')
    .eq('status', 'open')
    .eq('reminder_10m_sent', false)
    .lte('deadline', tenMinutesFromNow);

  let reminders = 0;
  
  // Process 1-hour reminders
  if (oneHourReminders) {
    for (const order of oneHourReminders) {
      await queueReminderEmails(order, '1h');
      await supabase
        .from('general_orders')
        .update({ reminder_1h_sent: true })
        .eq('id', order.id);
      reminders++;
      console.log(`📧 Queued 1-hour reminder for: ${order.title}`);
    }
  }
  
  // Process 10-minute reminders
  if (tenMinuteReminders) {
    for (const order of tenMinuteReminders) {
      await queueReminderEmails(order, '10m');
      await supabase
        .from('general_orders')
        .update({ reminder_10m_sent: true })
        .eq('id', order.id);
      reminders++;
      console.log(`📧 Queued 10-minute reminder for: ${order.title}`);
    }
  }
  
  if (reminders === 0) {
    console.log('📭 No reminder emails needed');
  }
  
  return { reminders };
}

/**
 * Process pending emails in the queue
 */
async function processEmailQueue() {
  console.log('📧 Processing email queue...');
  
  // Check both email_queue (status='pending') and email_logs (status='failed') tables
  let totalPending = 0;
  
  // Check email_queue table
  const { data: queueEmails, error: queueError } = await supabase
    .from('email_queue')
    .select('*')
    .eq('status', 'pending')
    .lt('attempts', 3)
    .limit(5);

  if (!queueError && queueEmails) {
    totalPending += queueEmails.length;
  }

  // Check email_logs table  
  const { data: logEmails, error: logError } = await supabase
    .from('email_logs')
    .select('*')
    .eq('status', 'failed')
    .limit(5);

  if (!logError && logEmails) {
    totalPending += logEmails.length;
  }

  if (totalPending === 0) {
    console.log('📭 No pending emails in queue');
    return { processed: 0 };
  }

  console.log(`📧 Found ${totalPending} pending emails to process`);
  
  // Trigger email processing via API
  try {
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? (process.env.NEXT_PUBLIC_SITE_URL || `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`)
      : 'http://127.0.0.1:3000';
    
    if (baseUrl) {
      const response = await fetch(`${baseUrl}/api/admin/email-service`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('📧 Email processing result:', result.message);
        return { processed: result.processed || 0 };
      } else {
        console.error('❌ Email service error:', response.status, response.statusText);
      }
    }
  } catch (error) {
    console.error('⚠️ Email processing failed:', error.message);
  }
  
  return { processed: 0 };
}

// Helper functions
async function updateShopStatus(isOpen, orderId, message) {
  try {
    // Fetch latest shop_status record to get the correct UUID
    const { data: shopStatus, error: fetchError } = await supabase
      .from('shop_status')
      .select('id')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (fetchError || !shopStatus || shopStatus.length === 0) {
      console.error('⚠️ Shop status fetch failed:', fetchError);
      return;
    }

    const shopStatusId = shopStatus[0].id;
    const { error } = await supabase
      .from('shop_status')
      .update({
        is_open: isOpen,
        message: message,
        current_general_order_id: orderId,
        updated_at: new Date().toISOString()
      })
      .eq('id', shopStatusId);
      
    if (error) {
      console.error('⚠️ Shop status update failed:', error.message);
    } else {
      console.log(`🏪 Shop status updated: ${isOpen ? 'OPEN' : 'CLOSED'}`);
    }
  } catch (error) {
    console.error('⚠️ Shop status update error:', error);
  }
}

async function queueOpeningEmails(order) {
  try {
    const { data: users } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('is_active', true);

    if (users && users.length > 0) {
      const emails = users.map(user => ({
        recipient_email: user.email,
        recipient_name: user.full_name,
        subject: `🎉 הזמנה קבוצתית נפתחה - ${order.title}`,
        html_body: `<p>שלום ${user.full_name},</p><p>הזמנה קבוצתית חדשה נפתחה: <strong>${order.title}</strong></p>`,
        email_type: 'general_order_open',
        user_id: user.id,
        general_order_id: order.id,
        priority: 3,
        status: 'pending' // Correct status for email service to find
      }));

      await supabase.from('email_queue').insert(emails);
      console.log(`📧 Queued ${emails.length} opening emails`);
    }
  } catch (error) {
    console.error('⚠️ Failed to queue opening emails:', error);
  }
}

async function queueClosureEmails(order) {
  try {
    // Queue closure notification
    await supabase
      .from('email_queue')
      .insert([{
        recipient_email: 'SYSTEM_ORDER_CLOSED',
        subject: `הזמנה קבוצתית נסגרה - ${order.title}`,
        html_body: `GENERAL_ORDER_CLOSED:${order.id}`,
        email_type: 'general_order_close',
        general_order_id: order.id,
        status: 'pending'
      }]);
      
    // Queue summary email
    await supabase
      .from('email_queue')
      .insert([{
        recipient_email: 'SYSTEM_GENERAL_ORDER_SUMMARY',
        subject: `סיכום הזמנה קבוצתית - ${order.title}`,
        html_body: `GENERAL_ORDER_SUMMARY:${order.id}:AUTO_CLOSE`,
        email_type: 'general_order_summary',
        general_order_id: order.id,
        status: 'pending'
      }]);
      
    console.log(`📧 Queued closure emails for order: ${order.title}`);
  } catch (error) {
    console.error('⚠️ Failed to queue closure emails:', error);
  }
}

async function queueReminderEmails(order, reminderType) {
  try {
    const { data: users } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('is_active', true);

    if (users && users.length > 0) {
      const emails = users.map(user => ({
        recipient_email: user.email,
        recipient_name: user.full_name,
        subject: `⏰ תזכורת: הזמנה קבוצתית נסגרת בקרוב - ${order.title}`,
        html_body: `GENERAL_ORDER_REMINDER_${reminderType.toUpperCase()}:${order.id}`, // Use template system
        email_type: 'general_order_reminder',
        user_id: user.id,
        general_order_id: order.id,
        priority: 2,
        status: 'pending' // Use correct status for email service
      }));

      await supabase.from('email_queue').insert(emails); // Use email_queue instead of email_logs
      console.log(`📧 Queued ${emails.length} reminder emails (${reminderType})`);
    }
  } catch (error) {
    console.error(`⚠️ Failed to queue ${reminderType} reminder emails:`, error);
  }
}

/**
 * Clean up inactive users (90+ days without login)
 * Runs once per day at 2 AM
 */
async function cleanupInactiveUsers() {
  console.log('🧹 Checking for inactive users to clean up...');
  
  const INACTIVE_DAYS = 90; // 3 months
  const now = new Date();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - INACTIVE_DAYS);
  const cutoffISO = cutoffDate.toISOString();
  
  // Find inactive users (exclude admins)
  const { data: inactiveUsers, error: fetchError } = await supabase
    .from('users')
    .select('id, username, full_name, email, last_login, role, created_at')
    .neq('role', 'admin')
    .or(`last_login.is.null,last_login.lt.${cutoffISO}`);

  if (fetchError) {
    throw new Error(`Error fetching inactive users: ${fetchError.message}`);
  }

  if (!inactiveUsers || inactiveUsers.length === 0) {
    console.log('✅ No inactive users found');
    return { deleted: 0 };
  }

  console.log(`🗑️ Found ${inactiveUsers.length} inactive user(s) to delete`);

  let successCount = 0;

  for (const user of inactiveUsers) {
    try {
      const lastLoginDate = user.last_login 
        ? new Date(user.last_login).toLocaleDateString('he-IL')
        : 'Never';
      
      console.log(`   Deleting: ${user.full_name} (${user.email}) - Last login: ${lastLoginDate}`);

      // Delete related records
      await supabase.from('activity_logs').delete().eq('user_id', user.id);
      await supabase.from('admin_activity_logs').delete().eq('user_id', user.id);
      await supabase.from('general_order_participants').delete().eq('user_id', user.id);
      await supabase.from('push_notifications').delete().eq('created_by', user.id);
      await supabase.from('general_orders').update({ created_by: null }).eq('created_by', user.id);
      await supabase.from('whatsapp_conversations').update({ user_id: null }).eq('user_id', user.id);
      await supabase.from('whatsapp_messages').update({ user_id: null }).eq('user_id', user.id);
      await supabase.from('orders').update({ user_id: null }).eq('user_id', user.id);
      await supabase.from('cart_items').delete().eq('user_id', user.id);
      await supabase.from('password_reset_tokens').delete().eq('user_id', user.id);
      await supabase.from('user_logs').delete().eq('user_id', user.id);
      await supabase.from('visitor_tracking').update({ user_id: null }).eq('user_id', user.id);

      // Delete the user
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', user.id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      successCount++;
      console.log(`   ✅ Deleted successfully`);

    } catch (error) {
      console.error(`   ❌ Failed to delete ${user.email}:`, error.message);
    }
  }

  console.log(`✅ Cleanup summary: ${successCount}/${inactiveUsers.length} users deleted`);

  return { deleted: successCount, total: inactiveUsers.length };
}

// Also support POST method for compatibility
export const POST = GET;