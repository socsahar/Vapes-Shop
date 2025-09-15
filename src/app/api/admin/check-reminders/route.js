import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET - Check for reminders and auto-close orders
export async function GET() {
  try {
    console.log('Running general order reminder check...');
    console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('Has service key:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    const results = {
      checked: 0,
      reminders_sent: 0,
      closed_orders: 0,
      opened_orders: 0,
      errors: []
    };

    // Get all general orders that need processing
    console.log('Querying for scheduled and open orders...');
    const { data: orders, error: fetchError } = await supabase
      .from('general_orders')
      .select('*')
      .in('status', ['scheduled', 'open']);

    console.log('Query result - Error:', fetchError);
    console.log('Query result - Orders found:', orders?.length || 0);
    
    if (orders && orders.length > 0) {
      orders.forEach((order, i) => {
        console.log(`Order ${i+1}: ${order.title} - ${order.status} - ${order.opening_time}`);
      });
    }

    if (fetchError) {
      console.error('Error fetching orders:', fetchError);
      return NextResponse.json({ error: 'שגיאה בטעינת הזמנות' }, { status: 500 });
    }

    results.checked = orders.length;

    for (const order of orders) {
      try {
        const deadline = new Date(order.deadline);
        const openingTime = order.opening_time ? new Date(order.opening_time) : null;
        
        // Check if scheduled order should be opened
        if (order.status === 'scheduled' && openingTime && now >= openingTime) {
          const { error: updateError } = await supabase
            .from('general_orders')
            .update({ status: 'open' })
            .eq('id', order.id);

          if (!updateError) {
            results.opened_orders++;
            
            // Queue opening notifications to all users
            try {
              console.log(`Queuing opening notifications for order: ${order.title}`);
              
              // Get all users for email notifications
              const { data: users, error: usersError } = await supabase
                .from('users')
                .select('id, email, full_name')
                .eq('email_notifications', true);

              if (usersError) {
                throw new Error(`Error fetching users: ${usersError.message}`);
              }

              if (users && users.length > 0) {
                // Try email_queue table first
                const emailsToQueue = users.map(user => ({
                  recipient_email: user.email,
                  recipient_name: user.full_name,
                  subject: `הזמנה קבוצתית נפתחה - ${order.title}`,
                  html_body: `
                    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                      <h2>הזמנה קבוצתית נפתחה! 🎉</h2>
                      <p>שלום ${user.full_name},</p>
                      <p>הזמנה קבוצתית חדשה נפתחה: <strong>${order.title}</strong></p>
                      <p>תוכלו להצטרף להזמנה באתר</p>
                      <p>תאריך סגירה: ${new Date(order.deadline).toLocaleDateString('he-IL')}</p>
                    </div>
                  `,
                  email_type: 'general_order_open',
                  user_id: user.id,
                  general_order_id: order.id,
                  priority: 3
                }));

                const { error: queueError } = await supabase
                  .from('email_queue')
                  .insert(emailsToQueue);

                if (queueError) {
                  console.error('Error queuing emails:', queueError);
                  throw new Error(`Error queuing emails: ${queueError.message}`);
                } else {
                  console.log(`📧 Queued ${emailsToQueue.length} opening emails via email_queue`);
                }

                // Update shop status to open
                const { error: shopError } = await supabase
                  .rpc('toggle_shop_status', { 
                    open_status: true, 
                    status_message: `ההזמנה הקבוצתית "${order.title}" נפתחה!`,
                    general_order_id: order.id 
                  });

                if (shopError) {
                  console.error('Error updating shop status:', shopError);
                } else {
                  console.log('✅ Shop status updated to open');
                }
              }
              
            } catch (emailError) {
              console.error('Failed to queue opening notifications:', emailError);
              results.errors.push(`Database function: ${emailError.message}`);
            }
          }
          continue;
        }

        // Skip if order is not open
        if (order.status !== 'open') continue;

        const timeUntilDeadline = deadline.getTime() - now.getTime();
        const hoursUntilDeadline = timeUntilDeadline / (1000 * 60 * 60);

        // Auto-close expired orders
        if (timeUntilDeadline <= 0) {
          const { error: closeError } = await supabase
            .from('general_orders')
            .update({ status: 'closed' })
            .eq('id', order.id);

          if (!closeError) {
            results.closed_orders++;
            
            // Send closure notification
            try {
              await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/admin/email-service`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'general_order_closed',
                  orderId: order.id,
                  orderTitle: order.title,
                  deadline: order.deadline
                })
              });
            } catch (emailError) {
              console.error('Failed to send closure notification:', emailError);
              results.errors.push(`Closure email for order ${order.id}: ${emailError.message}`);
            }
          }
          continue;
        }

        // Send 24-hour reminder (send between 23-24 hours before deadline)
        if (hoursUntilDeadline <= 24 && hoursUntilDeadline > 23) {
          try {
            await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/admin/email-service`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'reminder_24h',
                orderId: order.id,
                orderTitle: order.title,
                deadline: order.deadline
              })
            });
            results.reminders_sent++;
            console.log(`24h reminder sent for order ${order.id}`);
          } catch (emailError) {
            console.error('Failed to send 24h reminder:', emailError);
            results.errors.push(`24h reminder for order ${order.id}: ${emailError.message}`);
          }
        }

        // Send 1-hour reminder (send between 0.5-1 hours before deadline)
        if (hoursUntilDeadline <= 1 && hoursUntilDeadline > 0.5) {
          try {
            await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/admin/email-service`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'reminder_1h',
                orderId: order.id,
                orderTitle: order.title,
                deadline: order.deadline
              })
            });
            results.reminders_sent++;
            console.log(`1h reminder sent for order ${order.id}`);
          } catch (emailError) {
            console.error('Failed to send 1h reminder:', emailError);
            results.errors.push(`1h reminder for order ${order.id}: ${emailError.message}`);
          }
        }

      } catch (orderError) {
        console.error(`Error processing order ${order.id}:`, orderError);
        results.errors.push(`Order ${order.id}: ${orderError.message}`);
      }
    }

    // Call the database function for additional reminder logic
    try {
      const { error: reminderError } = await supabase
        .rpc('check_general_order_reminders');

      if (reminderError) {
        console.error('Error in database reminder function:', reminderError);
        results.errors.push(`Database function: ${reminderError.message}`);
      }
    } catch (dbError) {
      console.error('Database reminder function error:', dbError);
      results.errors.push(`Database function: ${dbError.message}`);
    }

    // Process any pending emails
    try {
      const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/admin/email-service`, {
        method: 'GET'
      });
      
      if (emailResponse.ok) {
        const emailResult = await emailResponse.json();
        console.log('Email processing result:', emailResult);
      }
    } catch (emailError) {
      console.error('Error processing emails:', emailError);
      results.errors.push(`Email processing: ${emailError.message}`);
    }

    console.log('Reminder check completed:', results);

    return NextResponse.json({
      message: 'בדיקת תזכורות הושלמה בהצלחה',
      timestamp: new Date().toISOString(),
      results
    });

  } catch (error) {
    console.error('Unexpected error in reminder check:', error);
    return NextResponse.json(
      { error: 'שגיאה בבדיקת תזכורות' },
      { status: 500 }
    );
  }
}

// POST - Manual trigger for reminder check (admin only)
export async function POST() {
  return GET(); // Same logic as GET
}