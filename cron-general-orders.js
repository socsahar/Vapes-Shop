#!/usr/bin/env node

/**
 * Enhanced Automated General Order Cron Job for Railway
 * Handles all automated tasks for general orders with real activity logging:
 * - Auto-open future general orders
 * - Auto-close expired general orders 
 * - Send closure emails and admin summaries
 * - Send reminder emails (1 hour & 10 minutes before deadline)
 * - Logs all activities to database for system status monitoring
 * 
 * Designed for Railway's native cron system - runs once per execution
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

console.log(`🤖 [${new Date().toISOString()}] Starting General Order Automation Cron with Activity Logging...`);

// Helper functions for database logging
async function logActivity(type, description, status = 'completed', userId = null, generalOrderId = null, metadata = {}) {
  try {
    const { error } = await supabase
      .from('activity_log')
      .insert({
        type,
        description,
        status,
        user_id: userId,
        general_order_id: generalOrderId,
        metadata
      });

    if (error) {
      console.error('Warning: Failed to log activity:', error);
    }
  } catch (error) {
    console.error('Warning: Failed to log activity:', error);
  }
}

async function updateCronJobStatus(jobName, status, duration = null, errorMessage = null) {
  try {
    const { error } = await supabase.rpc('update_cron_job_status', {
      p_job_name: jobName,
      p_status: status,
      p_duration: duration,
      p_error_message: errorMessage
    });

    if (error) {
      console.error('Warning: Failed to update cron job status:', error);
    }
  } catch (error) {
    console.error('Warning: Failed to update cron job status:', error);
  }
}

async function runWithLogging(jobName, jobFunction) {
  const startTime = Date.now();
  
  try {
    console.log(`🔄 Starting ${jobName}...`);
    
    // Update cron job status to running
    await updateCronJobStatus(jobName, 'running', null, null);
    
    const result = await jobFunction();
    
    const duration = Date.now() - startTime;
    
    // Update cron job status to success
    await updateCronJobStatus(jobName, 'success', duration, null);
    
    console.log(`✅ ${jobName} completed successfully in ${duration}ms`);
    return result;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error(`❌ ${jobName} failed:`, error);
    
    // Update cron job status to failed
    await updateCronJobStatus(jobName, 'failed', duration, error.message);
    
    throw error;
  }
}

async function main() {
  const overallStartTime = Date.now();
  
  try {
    // Run all automation tasks with proper logging
    await Promise.all([
      runWithLogging('auto_open_orders', autoOpenFutureOrders),
      runWithLogging('auto_close_orders', autoCloseExpiredOrders),
      runWithLogging('send_reminder_emails', sendReminderEmails)
    ]);
    
    const totalDuration = Date.now() - overallStartTime;
    
    // Log overall completion
    await logActivity(
      'cron_complete',
      `General Order Automation completed successfully in ${totalDuration}ms`,
      'completed',
      null,
      null,
      { duration_ms: totalDuration, timestamp: new Date().toISOString() }
    );
    
    console.log(`✅ All automation tasks completed successfully in ${totalDuration}ms`);
  } catch (error) {
    const totalDuration = Date.now() - overallStartTime;
    
    console.error('❌ Error in cron job:', error);
    
    // Log the error
    await logActivity(
      'cron_error',
      `General Order Automation failed: ${error.message}`,
      'failed',
      null,
      null,
      { error: error.message, stack: error.stack, duration_ms: totalDuration }
    );
    
    process.exit(1);
  }
}

/**
 * Auto-open general orders that are scheduled to open now
 */
async function autoOpenFutureOrders() {
  console.log('🔍 Checking for orders to auto-open...');
  
  const now = new Date();
  
  // Find orders with scheduled status that should be opened now
  const { data: ordersToOpen, error } = await supabase
    .from('general_orders')
    .select('*')
    .eq('status', 'scheduled')
    .lte('opening_time', now.toISOString())
    .order('opening_time', { ascending: true });

  if (error) {
    throw new Error(`Error fetching orders to open: ${error.message}`);
  }

  if (ordersToOpen.length === 0) {
    console.log('📭 No orders ready to open');
    await logActivity(
      'cron_auto_open_orders',
      'No orders ready to open',
      'completed',
      null,
      null,
      { checked_at: now.toISOString(), orders_found: 0 }
    );
    return { opened: 0 };
  }

  let successCount = 0;

  for (const order of ordersToOpen) {
    try {
      console.log(`🚀 Opening order: ${order.title} (scheduled for ${new Date(order.opening_time).toLocaleString()})`);
      
      // Update order status to 'open'
      const { error: updateError } = await supabase
        .from('general_orders')
        .update({
          status: 'open',
          updated_at: now.toISOString()
        })
        .eq('id', order.id);

      if (updateError) {
        throw new Error(`Error opening order ${order.id}: ${updateError.message}`);
      }

      // Open the shop with this general order
      const { error: shopError } = await supabase
        .rpc('toggle_shop_status', {
          open_status: true,
          general_order_id: order.id,
          status_message: `הזמנה קבוצתית פעילה: ${order.title}`
        });

      if (shopError) {
        console.error('❌ Warning: Error opening shop for order (order still opened):', shopError);
      }

      // Send notification emails to all users
      await sendOrderOpenNotifications(order);

      successCount++;

      // Log successful opening
      await logActivity(
        'cron_auto_open_orders',
        `Opened general order: ${order.title}`,
        'completed',
        null,
        order.id,
        { 
          order_title: order.title,
          scheduled_for: order.opening_time,
          opened_at: now.toISOString()
        }
      );

      console.log(`✅ Successfully opened order: ${order.title}`);

    } catch (error) {
      console.error(`❌ Error opening order ${order.id}:`, error);
      
      // Log failed opening
      await logActivity(
        'cron_auto_open_orders',
        `Failed to open general order: ${order.title} - ${error.message}`,
        'failed',
        null,
        order.id,
        { 
          order_title: order.title,
          error: error.message,
          scheduled_for: order.opening_time
        }
      );
    }
  }

  return { opened: successCount, total: ordersToOpen.length };
}

/**
 * Auto-close general orders that have reached their deadline
 */
async function autoCloseExpiredOrders() {
  console.log('🔍 Checking for orders to auto-close...');
  
  const now = new Date();
  
  // Find open orders that have passed their deadline
  const { data: expiredOrders, error } = await supabase
    .from('general_orders')
    .select('*')
    .eq('status', 'open')
    .lte('deadline', now.toISOString())
    .order('deadline', { ascending: true });

  if (error) {
    throw new Error(`Error fetching expired orders: ${error.message}`);
  }

  if (expiredOrders.length === 0) {
    console.log('📭 No orders ready to close');
    await logActivity(
      'cron_auto_close_orders',
      'No expired orders to close',
      'completed',
      null,
      null,
      { checked_at: now.toISOString(), orders_found: 0 }
    );
    return { closed: 0 };
  }

  let successCount = 0;

  for (const order of expiredOrders) {
    try {
      console.log(`🔒 Closing expired order: ${order.title} (deadline: ${new Date(order.deadline).toLocaleString()})`);
      
      // Update order status to 'closed'
      const { error: updateError } = await supabase
        .from('general_orders')
        .update({
          status: 'closed',
          updated_at: now.toISOString()
        })
        .eq('id', order.id);

      if (updateError) {
        throw new Error(`Error closing order ${order.id}: ${updateError.message}`);
      }

      // Send closure notification emails
      await sendOrderCloseNotifications(order);

      successCount++;

      // Log successful closing
      await logActivity(
        'cron_auto_close_orders',
        `Closed expired general order: ${order.title}`,
        'completed',
        null,
        order.id,
        { 
          order_title: order.title,
          deadline: order.deadline,
          closed_at: now.toISOString(),
          hours_overdue: Math.round((now - new Date(order.deadline)) / (1000 * 60 * 60) * 100) / 100
        }
      );

      console.log(`✅ Successfully closed expired order: ${order.title}`);

    } catch (error) {
      console.error(`❌ Error closing order ${order.id}:`, error);
      
      // Log failed closing
      await logActivity(
        'cron_auto_close_orders',
        `Failed to close expired general order: ${order.title} - ${error.message}`,
        'failed',
        null,
        order.id,
        { 
          order_title: order.title,
          error: error.message,
          deadline: order.deadline
        }
      );
    }
  }

  return { closed: successCount, total: expiredOrders.length };
}

/**
 * Send reminder emails for orders closing soon
 */
async function sendReminderEmails() {
  console.log('🔍 Checking for orders needing reminders...');
  
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);

  // Find orders that need reminders (1 hour or 10 minutes before deadline)
  const { data: ordersNeedingReminders, error } = await supabase
    .from('general_orders')
    .select('*')
    .eq('status', 'open')
    .or(`deadline.lte.${oneHourFromNow.toISOString()},deadline.lte.${tenMinutesFromNow.toISOString()}`)
    .gt('deadline', now.toISOString())
    .order('deadline', { ascending: true });

  if (error) {
    throw new Error(`Error fetching orders for reminders: ${error.message}`);
  }

  if (ordersNeedingReminders.length === 0) {
    console.log('📭 No orders need reminder emails');
    await logActivity(
      'cron_send_reminder_emails',
      'No orders need reminder emails',
      'completed',
      null,
      null,
      { checked_at: now.toISOString(), orders_found: 0 }
    );
    return { reminders: 0 };
  }

  let remindersSent = 0;

  for (const order of ordersNeedingReminders) {
    try {
      const timeUntilDeadline = new Date(order.deadline) - now;
      const hoursUntilDeadline = Math.round(timeUntilDeadline / (1000 * 60 * 60) * 100) / 100;
      
      // Determine reminder type based on time remaining
      let reminderType;
      if (hoursUntilDeadline <= 0.2) { // 12 minutes or less
        reminderType = 'final';
      } else if (hoursUntilDeadline <= 1) {
        reminderType = 'one_hour';
      } else {
        continue; // Skip if more than 1 hour away
      }

      console.log(`📧 Sending ${reminderType} reminder for: ${order.title} (${hoursUntilDeadline} hours remaining)`);
      
      await sendReminderNotification(order, reminderType);
      remindersSent++;

      // Log successful reminder
      await logActivity(
        'cron_send_reminder_emails',
        `Sent ${reminderType} reminder for general order: ${order.title}`,
        'completed',
        null,
        order.id,
        { 
          order_title: order.title,
          reminder_type: reminderType,
          hours_until_deadline: hoursUntilDeadline,
          deadline: order.deadline
        }
      );

      console.log(`✅ Successfully sent ${reminderType} reminder for: ${order.title}`);

    } catch (error) {
      console.error(`❌ Error sending reminder for order ${order.id}:`, error);
      
      // Log failed reminder
      await logActivity(
        'cron_send_reminder_emails',
        `Failed to send reminder for general order: ${order.title} - ${error.message}`,
        'failed',
        null,
        order.id,
        { 
          order_title: order.title,
          error: error.message,
          deadline: order.deadline
        }
      );
    }
  }

  return { reminders: remindersSent, total: ordersNeedingReminders.length };
}

// Email notification functions (implement these based on your email system)
async function sendOrderOpenNotifications(order) {
  // Add to email queue for opening notifications
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('is_active', true);

    if (error || !users) {
      throw new Error(`Error fetching users: ${error?.message || 'No users found'}`);
    }

    // Add emails to queue for each user
    const emailsToQueue = users.map(user => ({
      recipient_email: user.email,
      recipient_name: user.full_name,
      subject: `🎉 הזמנה קבוצתית חדשה נפתחה - ${order.title}`,
      html_body: `<p>שלום ${user.full_name},</p><p>הזמנה קבוצתית חדשה נפתחה: <strong>${order.title}</strong></p>`,
      email_type: 'general_order_open',
      user_id: user.id,
      general_order_id: order.id,
      priority: 3
    }));

    const { error: queueError } = await supabase
      .from('email_queue')
      .insert(emailsToQueue);

    if (queueError) {
      throw new Error(`Error queuing emails: ${queueError.message}`);
    }

    console.log(`📧 Queued ${emailsToQueue.length} opening notification emails`);
  } catch (error) {
    console.error('❌ Error queuing opening notifications:', error);
  }
}

async function sendOrderCloseNotifications(order) {
  // Add to email queue for closing notifications  
  try {
    const { data: admins, error } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('role', 'admin')
      .eq('is_active', true);

    if (error || !admins) {
      throw new Error(`Error fetching admins: ${error?.message || 'No admins found'}`);
    }

    // Add emails to queue for each admin
    const emailsToQueue = admins.map(admin => ({
      recipient_email: admin.email,
      recipient_name: admin.full_name,
      subject: `🔒 הזמנה קבוצתית נסגרה אוטומטית - ${order.title}`,
      html_body: `<p>שלום ${admin.full_name},</p><p>הזמנה קבוצתית נסגרה אוטומטית: <strong>${order.title}</strong></p>`,
      email_type: 'general_order_close',
      user_id: admin.id,
      general_order_id: order.id,
      priority: 2
    }));

    const { error: queueError } = await supabase
      .from('email_queue')
      .insert(emailsToQueue);

    if (queueError) {
      throw new Error(`Error queuing emails: ${queueError.message}`);
    }

    console.log(`📧 Queued ${emailsToQueue.length} closing notification emails`);
  } catch (error) {
    console.error('❌ Error queuing closing notifications:', error);
  }
}

async function sendReminderNotification(order, reminderType) {
  // Add to email queue for reminder notifications
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('is_active', true);

    if (error || !users) {
      throw new Error(`Error fetching users: ${error?.message || 'No users found'}`);
    }

    const reminderText = reminderType === 'final' ? 'נותרו פחות מ-12 דקות!' : 'נותרה פחות משעה!';
    const priority = reminderType === 'final' ? 1 : 4;

    // Add emails to queue for each user
    const emailsToQueue = users.map(user => ({
      recipient_email: user.email,
      recipient_name: user.full_name,
      subject: `⏰ תזכורת: ${order.title} - ${reminderText}`,
      html_body: `<p>שלום ${user.full_name},</p><p>תזכורת: הזמנה קבוצתית <strong>${order.title}</strong> ${reminderText}</p>`,
      email_type: 'reminder',
      user_id: user.id,
      general_order_id: order.id,
      priority,
      metadata: { reminder_type: reminderType }
    }));

    const { error: queueError } = await supabase
      .from('email_queue')
      .insert(emailsToQueue);

    if (queueError) {
      throw new Error(`Error queuing emails: ${queueError.message}`);
    }

    console.log(`📧 Queued ${emailsToQueue.length} ${reminderType} reminder emails`);
  } catch (error) {
    console.error('❌ Error queuing reminder notifications:', error);
  }
}

// Run the main function
main().catch(console.error);