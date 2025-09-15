#!/usr/bin/env node

/**
 * Enhanced Automated General Order Cron Job with Real Activity Logging
 * Handles all automated tasks for general orders with proper database logging:
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

async function main() {
  try {
    // Run all automation tasks with proper logging
    const startTime = Date.now();
    
    await Promise.all([
      runWithLogging('auto_open_orders', autoOpenFutureOrders),
      runWithLogging('auto_close_orders', autoCloseExpiredOrders),
      runWithLogging('send_reminder_emails', sendReminderEmails),
      runWithLogging('process_email_queue', processEmailQueue)
    ]);
    
    const duration = Date.now() - startTime;
    
    // Log overall completion
    await logActivity(
      'cron_complete',
      `General Order Automation completed successfully in ${duration}ms`,
      'completed',
      null,
      null,
      { duration_ms: duration, timestamp: new Date().toISOString() }
    );
    
    console.log(`✅ All automation tasks completed successfully in ${duration}ms`);
  } catch (error) {
    console.error('❌ Error in cron job:', error);
    
    // Log the error
    await logActivity(
      'cron_error',
      `General Order Automation failed: ${error.message}`,
      'failed',
      null,
      null,
      { error: error.message, stack: error.stack }
    );
    
    process.exit(1);
  }
}

/**
 * Run a cron job function with proper logging
 */
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

/**
 * Auto-open general orders that are scheduled to open now
 */
async function autoOpenFutureOrders() {
  const now = new Date();
  
  // Find orders with future/scheduled status that should be opened now
  const { data: ordersToOpen, error } = await supabase
    .from('general_orders')
    .select('*')
    .in('status', ['future', 'scheduled'])
    .lte('opening_time', now.toISOString())
    .order('opening_time', { ascending: true });

  if (error) {
    throw new Error(`Error fetching orders to open: ${error.message}`);
  }

  if (ordersToOpen.length === 0) {
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

  const results = [];

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

      results.push({ id: order.id, title: order.title, status: 'success' });

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

      results.push({ id: order.id, title: order.title, status: 'failed', error: error.message });
    }
  }

  return { opened: results.filter(r => r.status === 'success').length, results };
}

/**
 * Auto-close general orders that have passed their deadline
 */
async function autoCloseExpiredOrders() {
  const now = new Date();
  
  // Find orders that are open and past their deadline
  const { data: ordersToClose, error } = await supabase
    .from('general_orders')
    .select('*')
    .eq('status', 'open')
    .lt('deadline', now.toISOString())
    .order('deadline', { ascending: true });

  if (error) {
    throw new Error(`Error fetching orders to close: ${error.message}`);
  }

  if (ordersToClose.length === 0) {
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

  const results = [];

  for (const order of ordersToClose) {
    try {
      console.log(`🔒 Closing expired order: ${order.title} (deadline was ${new Date(order.deadline).toLocaleString()})`);
      
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

      // Send closure notifications
      await sendOrderCloseNotifications(order);

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

      results.push({ id: order.id, title: order.title, status: 'success' });

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

      results.push({ id: order.id, title: order.title, status: 'failed', error: error.message });
    }
  }

  return { closed: results.filter(r => r.status === 'success').length, results };
}

/**
 * Send reminder emails for orders closing soon
 */
async function sendReminderEmails() {
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
  const results = [];

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
      
      await sendReminderEmail(order, reminderType);
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

      results.push({ id: order.id, title: order.title, reminderType, status: 'success' });

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

      results.push({ id: order.id, title: order.title, status: 'failed', error: error.message });
    }
  }

  return { reminders: remindersSent, results };
}

/**
 * Process pending emails in the queue
 */
async function processEmailQueue() {
  // Get pending emails from queue
  const { data: pendingEmails, error } = await supabase
    .from('email_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .lt('attempts', supabase.raw('max_attempts'))
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(10); // Process 10 emails at a time

  if (error) {
    throw new Error(`Error fetching email queue: ${error.message}`);
  }

  if (pendingEmails.length === 0) {
    await logActivity(
      'cron_process_email_queue',
      'No pending emails to process',
      'completed',
      null,
      null,
      { checked_at: new Date().toISOString(), emails_found: 0 }
    );
    return { processed: 0 };
  }

  let processed = 0;
  const results = [];

  for (const email of pendingEmails) {
    try {
      console.log(`📬 Processing email: ${email.subject} to ${email.recipient_email}`);
      
      // Update status to sending
      await supabase
        .from('email_queue')
        .update({
          status: 'sending',
          last_attempt_at: new Date().toISOString(),
          attempts: email.attempts + 1
        })
        .eq('id', email.id);

      // Send the email (implement your email sending logic here)
      await sendQueuedEmail(email);
      
      // Update status to sent
      await supabase
        .from('email_queue')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', email.id);

      processed++;
      results.push({ id: email.id, subject: email.subject, status: 'success' });

      // Log successful email
      await logActivity(
        'cron_process_email_queue',
        `Sent email: ${email.subject} to ${email.recipient_email}`,
        'completed',
        email.user_id,
        email.general_order_id,
        { 
          email_type: email.email_type,
          recipient: email.recipient_email,
          attempts: email.attempts + 1
        }
      );

    } catch (error) {
      console.error(`❌ Error processing email ${email.id}:`, error);
      
      // Update email status to failed if max attempts reached
      const newStatus = (email.attempts + 1) >= email.max_attempts ? 'failed' : 'pending';
      
      await supabase
        .from('email_queue')
        .update({
          status: newStatus,
          error_message: error.message,
          failed_at: newStatus === 'failed' ? new Date().toISOString() : null
        })
        .eq('id', email.id);

      results.push({ id: email.id, subject: email.subject, status: 'failed', error: error.message });

      // Log failed email
      await logActivity(
        'cron_process_email_queue',
        `Failed to send email: ${email.subject} to ${email.recipient_email} - ${error.message}`,
        'failed',
        email.user_id,
        email.general_order_id,
        { 
          email_type: email.email_type,
          recipient: email.recipient_email,
          error: error.message,
          attempts: email.attempts + 1,
          max_attempts: email.max_attempts
        }
      );
    }
  }

  return { processed, results };
}

/**
 * Log activity to database
 */
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

/**
 * Update cron job status in database
 */
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

// Placeholder functions - implement these based on your email system
async function sendOrderOpenNotifications(order) {
  // Implementation for sending order open notifications
}

async function sendOrderCloseNotifications(order) {
  // Implementation for sending order close notifications  
}

async function sendReminderEmail(order, reminderType) {
  // Implementation for sending reminder emails
}

async function sendQueuedEmail(email) {
  // Implementation for sending queued emails
}

// Run the main function
main().catch(console.error);