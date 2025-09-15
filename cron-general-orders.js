#!/usr/bin/env node

/**
 * Automated General Order Cron Job for Railway
 * Handles all automated tasks for general orders:
 * - Auto-open future general orders
 * - Auto-close expired general orders 
 * - Send closure emails and admin summaries
 * - Send reminder emails (1 hour & 10 minutes before deadline)
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

console.log(`🤖 [${new Date().toISOString()}] Starting General Order Automation Cron...`);

async function main() {
  try {
    // Run all automation tasks
    await Promise.all([
      autoOpenFutureOrders(),
      autoCloseExpiredOrders(),
      sendReminderEmails()
    ]);
    
    console.log('✅ All automation tasks completed successfully');
  } catch (error) {
    console.error('❌ Error in cron job:', error);
    process.exit(1);
  }
}

/**
 * Auto-open general orders that are scheduled to open now
 */
async function autoOpenFutureOrders() {
  console.log('🔍 Checking for orders to auto-open...');
  
  const now = new Date();
  
  // Find orders with future/scheduled status that should be opened now
  const { data: ordersToOpen, error } = await supabase
    .from('general_orders')
    .select('*')
    .in('status', ['future', 'scheduled'])
    .lte('opening_time', now.toISOString())
    .order('opening_time', { ascending: true });

  if (error) {
    console.error('❌ Error fetching orders to open:', error);
    return;
  }

  if (ordersToOpen.length === 0) {
    console.log('📭 No orders ready to open');
    return;
  }

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
        console.error(`❌ Error opening order ${order.id}:`, updateError);
        continue;
      }

      // Open the shop with this general order
      const { error: shopError } = await supabase
        .rpc('toggle_shop_status', {
          open_status: true,
          general_order_id: order.id,
          status_message: `הזמנה קבוצתית פעילה: ${order.title}`
        });

      if (shopError) {
        console.error('❌ Error opening shop for order:', shopError);
        continue;
      }

      // Queue opening notification email
      await queueEmail({
        recipient_email: 'SYSTEM_ORDER_OPENED',
        subject: `הזמנה קבוצתית נפתחה - ${order.title}`,
        body: `GENERAL_ORDER_OPENED:${order.id}`,
        status: 'failed' // Queue status
      });

      console.log(`✅ Successfully opened order: ${order.title}`);
      
    } catch (error) {
      console.error(`❌ Error processing order ${order.id}:`, error);
    }
  }

  console.log(`🚀 Processed ${ordersToOpen.length} orders for opening`);
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
    console.error('❌ Error fetching expired orders:', error);
    return;
  }

  if (expiredOrders.length === 0) {
    console.log('📭 No orders ready to close');
    return;
  }

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
        console.error(`❌ Error closing order ${order.id}:`, updateError);
        continue;
      }

      // Close the shop
      const { error: shopError } = await supabase
        .rpc('toggle_shop_status', {
          open_status: false,
          general_order_id: null,
          status_message: 'החנות סגורה כרגע. נפתח בהזמנה קבוצתית הבאה.'
        });

      if (shopError) {
        console.error('❌ Error closing shop:', shopError);
      }

      // Queue closure notification email
      await queueEmail({
        recipient_email: 'SYSTEM_ORDER_CLOSED',
        subject: `הזמנה קבוצתית נסגרה - ${order.title}`,
        body: `GENERAL_ORDER_CLOSED:${order.id}`,
        status: 'failed'
      });

      // Queue admin summary email
      await queueEmail({
        recipient_email: 'SYSTEM_GENERAL_ORDER_SUMMARY',
        subject: `סיכום הזמנה קבוצתית - ${order.title}`,
        body: `GENERAL_ORDER_SUMMARY:${order.id}:AUTO_CLOSED`,
        status: 'failed'
      });

      console.log(`✅ Successfully closed order: ${order.title}`);
      
    } catch (error) {
      console.error(`❌ Error processing expired order ${order.id}:`, error);
    }
  }

  // Process queued emails after closing orders
  if (expiredOrders.length > 0) {
    console.log('📧 Processing queued emails...');
    await processEmailQueue();
  }

  console.log(`🔒 Processed ${expiredOrders.length} expired orders`);
}

/**
 * Send reminder emails before deadlines (1 hour and 10 minutes)
 */
async function sendReminderEmails() {
  console.log('🔍 Checking for reminder emails to send...');
  
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000); // +1 hour
  const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000); // +10 minutes

  // Find orders needing 1-hour reminder
  const { data: oneHourReminders, error: oneHourError } = await supabase
    .from('general_orders')
    .select('*')
    .eq('status', 'open')
    .gte('deadline', now.toISOString())
    .lte('deadline', oneHourFromNow.toISOString())
    .is('reminder_1h_sent', false);

  if (oneHourError) {
    console.error('❌ Error fetching 1-hour reminders:', oneHourError);
  } else {
    await processReminders(oneHourReminders, '1_hour', 'שעה אחת');
  }

  // Find orders needing 10-minute reminder  
  const { data: tenMinuteReminders, error: tenMinuteError } = await supabase
    .from('general_orders')
    .select('*')
    .eq('status', 'open')
    .gte('deadline', now.toISOString())
    .lte('deadline', tenMinutesFromNow.toISOString())
    .is('reminder_10m_sent', false);

  if (tenMinuteError) {
    console.error('❌ Error fetching 10-minute reminders:', tenMinuteError);
  } else {
    await processReminders(tenMinuteReminders, '10_minute', '10 דקות');
  }
}

/**
 * Process reminder emails for given orders
 */
async function processReminders(orders, reminderType, timeDescription) {
  if (orders.length === 0) {
    console.log(`📭 No ${reminderType} reminders to send`);
    return;
  }

  console.log(`⏰ Processing ${orders.length} ${reminderType} reminders`);

  for (const order of orders) {
    try {
      // Queue reminder email
      await queueEmail({
        recipient_email: 'SYSTEM_ORDER_REMINDER',
        subject: `תזכורת: הזמנה קבוצתית נסגרת בעוד ${timeDescription} - ${order.title}`,
        body: `GENERAL_ORDER_REMINDER:${order.id}:${reminderType.toUpperCase()}`,
        status: 'failed'
      });

      // Mark reminder as sent
      const updateField = reminderType === '1_hour' ? 'reminder_1h_sent' : 'reminder_10m_sent';
      await supabase
        .from('general_orders')
        .update({ [updateField]: true })
        .eq('id', order.id);

      console.log(`⏰ Queued ${reminderType} reminder for: ${order.title}`);
      
    } catch (error) {
      console.error(`❌ Error processing ${reminderType} reminder for order ${order.id}:`, error);
    }
  }

  // Process the queued reminder emails
  if (orders.length > 0) {
    await processEmailQueue();
  }
}

/**
 * Queue an email in the database
 */
async function queueEmail(emailData) {
  const { error } = await supabase
    .from('email_logs')
    .insert([{
      ...emailData,
      created_at: new Date().toISOString()
    }]);

  if (error) {
    console.error('❌ Error queueing email:', error);
  }
}

/**
 * Process the email queue by calling the email service
 */
async function processEmailQueue() {
  try {
    console.log('📧 Triggering email service to process queue...');
    
    const response = await fetch(`${SITE_URL}/api/admin/email-service`, {
      method: 'GET',
      headers: {
        'User-Agent': 'General-Order-Cron/1.0'
      }
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Email service response:', result.message);
    } else {
      console.error('❌ Email service failed:', response.status, response.statusText);
    }
    
  } catch (error) {
    console.error('❌ Error triggering email service:', error);
  }
}

// Run the main function
main();