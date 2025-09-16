import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper function to queue opening emails to all users
async function queueOpeningEmails(generalOrder) {
  try {
    console.log(`📧 Queuing opening emails for order: ${generalOrder.title}`);
    
    // Get all active users
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('is_active', true);

    if (error || !users) {
      throw new Error(`Error fetching users: ${error?.message || 'No users found'}`);
    }

    // Check if email_queue table exists, if not use email_logs as fallback
    const emailsToQueue = users.map(user => ({
      recipient_email: user.email,
      recipient_name: user.full_name,
      subject: `🎉 הזמנה קבוצתית נפתחה - ${generalOrder.title}`,
      html_body: `
        <div dir="rtl" style="font-family: Arial, sans-serif;">
          <h2>שלום ${user.full_name},</h2>
          <p>הזמנה קבוצתית חדשה נפתחה!</p>
          <h3>${generalOrder.title}</h3>
          ${generalOrder.description ? `<p>${generalOrder.description}</p>` : ''}
          <p><strong>תאריך סגירה:</strong> ${new Date(generalOrder.deadline).toLocaleDateString('he-IL', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}</p>
          <p>היכנס לאתר כדי להצטרף להזמנה!</p>
        </div>
      `,
      email_type: 'general_order_open',
      user_id: user.id,
      general_order_id: generalOrder.id,
      priority: 3
    }));

    // Try to use email_queue table first
    const { error: queueError } = await supabase
      .from('email_queue')
      .insert(emailsToQueue);

    if (queueError) {
      console.log('Email queue table not available, using email_logs fallback');
      
      // Fallback to email_logs table
      const fallbackEmails = emailsToQueue.map(email => ({
        recipient_email: email.recipient_email,
        subject: email.subject,
        body: `GENERAL_ORDER_OPENED_USER:${email.general_order_id}:${email.user_id}`,
        status: 'failed' // Queue status
      }));

      const { error: fallbackError } = await supabase
        .from('email_logs')
        .insert(fallbackEmails);

      if (fallbackError) {
        throw new Error(`Error queuing emails: ${fallbackError.message}`);
      } else {
        console.log(`📧 Queued ${fallbackEmails.length} opening notification emails via email_logs`);
      }
    } else {
      console.log(`📧 Queued ${emailsToQueue.length} opening notification emails via email_queue`);
    }
  } catch (error) {
    console.error('❌ Error queuing opening emails:', error);
    throw error;
  }
}

// GET - Fetch all general orders (admin only)
export async function GET() {
  try {
    const { data: generalOrders, error } = await supabase
      .from('general_orders')
      .select(`
        *,
        creator:created_by(full_name, email)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching general orders:', error);
      return NextResponse.json(
        { error: 'שגיאה בטעינת ההזמנות הקבוצתיות' },
        { status: 500 }
      );
    }

    // Fetch participants for each general order separately
    const ordersWithParticipants = await Promise.all(
      generalOrders.map(async (generalOrder) => {
        // Fetch orders for this general order
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select(`
            id,
            user_id,
            total_amount,
            status,
            created_at,
            user:users!orders_user_id_fkey(full_name, email)
          `)
          .eq('general_order_id', generalOrder.id);

        if (ordersError) {
          console.error('Error fetching orders for general order:', ordersError);
          return {
            ...generalOrder,
            participants: [],
            total_orders: 0,
            total_amount: 0
          };
        }

        // Fetch order items separately for each order
        const ordersWithItems = [];
        for (const order of orders || []) {
          const { data: items, error: itemsError } = await supabase
            .from('order_items')
            .select(`
              id,
              product_id,
              quantity,
              unit_price,
              total_price,
              products(name, price, description, image_url)
            `)
            .eq('order_id', order.id);

          if (itemsError) {
            console.error('Error fetching order items:', itemsError);
          }

          ordersWithItems.push({
            ...order,
            order_items: items || []
          });
        }

        return {
          ...generalOrder,
          participants: ordersWithItems,
          total_orders: ordersWithItems?.length || 0,
          total_amount: ordersWithItems?.reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0) || 0,
          // Add real-time status based on deadline
          real_time_status: new Date() > new Date(generalOrder.deadline) ? 'closed' : generalOrder.status,
          is_expired: new Date() > new Date(generalOrder.deadline)
        };
      })
    );

    return NextResponse.json({
      orders: ordersWithParticipants
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'שגיאה בשרת' },
      { status: 500 }
    );
  }
}

// POST - Create a new general order (admin only)
export async function POST(request) {
  try {
    const body = await request.json();
    const { title, description, deadline, opening_time, created_by } = body;

    if (!title || !deadline || !created_by) {
      return NextResponse.json(
        { error: 'נתונים חסרים: כותרת, תאריך סגירה ויוצר נדרשים' },
        { status: 400 }
      );
    }

    // Validate opening_time if provided
    if (opening_time) {
      const openingDate = new Date(opening_time);
      const deadlineDate = new Date(deadline);
      const now = new Date();

      if (openingDate <= now) {
        return NextResponse.json(
          { error: 'תאריך הפתיחה חייב להיות בעתיד' },
          { status: 400 }
        );
      }

      if (openingDate >= deadlineDate) {
        return NextResponse.json(
          { error: 'תאריך הפתיחה חייב להיות לפני תאריך הסגירה' },
          { status: 400 }
        );
      }
    }

    // First, automatically close any expired orders before checking for conflicts
    console.log('Checking for expired orders before creating new one...');
    const { data: expiredOrders, error: expiredError } = await supabase
      .from('general_orders')
      .select('id, title, deadline, status')
      .eq('status', 'open')
      .lt('deadline', new Date().toISOString());

    if (expiredOrders && expiredOrders.length > 0) {
      console.log(`Found ${expiredOrders.length} expired orders, closing them silently (no summary emails)...`);
      
      // Close expired orders silently without triggering summary emails
      const { error: closeError } = await supabase
        .from('general_orders')
        .update({ 
          status: 'closed',
          updated_at: new Date().toISOString(),
          closure_email_sent: true // Mark as sent to prevent summary emails
        })
        .in('id', expiredOrders.map(order => order.id));

      if (closeError) {
        console.error('Error auto-closing expired orders:', closeError);
      } else {
        console.log(`Successfully auto-closed ${expiredOrders.length} expired orders (without summary emails)`);
      }
    }

    // Check if there's already an open or scheduled general order (after auto-closing expired ones)
    const { data: existingOrder, error: checkError } = await supabase
      .from('general_orders')
      .select('id, title, status')
      .in('status', ['open', 'scheduled'])
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error checking existing orders:', checkError);
      return NextResponse.json(
        { error: 'שגיאה בבדיקת הזמנות קיימות' },
        { status: 500 }
      );
    }

    if (existingOrder) {
      const statusText = existingOrder.status === 'open' ? 'פתוחה' : 'מתוזמנת';
      return NextResponse.json(
        { error: `כבר קיימת הזמנה קבוצתית ${statusText}: ${existingOrder.title}` },
        { status: 400 }
      );
    }

    // Convert deadline to Jerusalem timezone
    const jerusalemDeadline = new Date(deadline).toISOString();
    
    // Convert opening_time to Jerusalem timezone if provided
    const jerusalemOpeningTime = opening_time ? new Date(opening_time).toISOString() : null;

    // Create the general order
    console.log('Creating general order with data:', {
      title,
      description,
      deadline: jerusalemDeadline,
      opening_time: jerusalemOpeningTime,
      created_by
    });

    // Determine the correct status based on opening_time
    let orderStatus;
    if (jerusalemOpeningTime && new Date(jerusalemOpeningTime) > new Date()) {
      orderStatus = 'scheduled';
      console.log(`Order will be scheduled to open at: ${jerusalemOpeningTime}`);
    } else {
      orderStatus = 'open';
      console.log('Order will open immediately');
    }

    const { data: newOrder, error: createError } = await supabase
      .from('general_orders')
      .insert([{
        title,
        description,
        deadline: jerusalemDeadline,
        opening_time: jerusalemOpeningTime,
        created_by,
        status: orderStatus,
        opening_email_sent: false,
        reminder_1h_sent: false,
        reminder_10m_sent: false,
        closure_email_sent: false
      }])
      .select()
      .single();

    if (createError) {
      console.error('Error creating general order:', createError);
      return NextResponse.json(
        { error: 'שגיאה ביצירת הזמנה קבוצתית: ' + (createError.message || 'לא ידוע') },
        { status: 500 }
      );
    }

    console.log('General order created successfully:', newOrder);

    // Handle shop status based on order status
    if (newOrder.status === 'open') {
      // Open the shop immediately for active orders
      try {
        console.log('Opening shop for immediate general order...');
        const { error: shopError } = await supabase
          .from('shop_status')
          .update({
            is_open: true,
            current_general_order_id: newOrder.id,
            message: `החנות פתוחה להזמנות! הזמנה קבוצתית: ${title}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', 1);

        if (shopError) {
          console.error('Error opening shop:', shopError);
        } else {
          console.log('✅ Shop opened successfully for immediate general order');
        }
      } catch (shopUpdateError) {
        console.error('Shop status update error:', shopUpdateError);
      }
    } else if (newOrder.status === 'scheduled') {
      // Keep shop closed for scheduled orders without revealing info
      try {
        console.log('Setting shop status for scheduled general order...');
        
        const { error: shopError } = await supabase
          .from('shop_status')
          .update({
            is_open: false,
            current_general_order_id: null,
            message: 'החנות סגורה כרגע',
            updated_at: new Date().toISOString()
          })
          .eq('id', 1);

        if (shopError) {
          console.error('Error setting shop status for scheduled order:', shopError);
        } else {
          console.log('✅ Shop status updated for scheduled general order');
        }
      } catch (shopRpcError) {
        console.error('Shop RPC function not available:', shopRpcError);
      }
    }

    // Queue email notifications based on order type
    try {
      // Get admin email from environment
      const adminEmail = process.env.ADMIN_EMAIL;
      
      if (newOrder.status === 'open') {
        // For immediate orders: Send admin notification AND queue opening emails
        if (adminEmail) {
          const { error: adminEmailError } = await supabase
            .from('email_logs')
            .insert([{
              recipient_email: adminEmail,
              subject: `הזמנה קבוצתית נפתחה מיד - ${title}`,
              body: `GENERAL_ORDER_OPENED:${newOrder.id}`,
              status: 'failed' // Use 'failed' as queue status
            }]);

          if (adminEmailError) {
            console.error('Error queueing admin email:', adminEmailError);
          } else {
            console.log('Admin notification queued for immediate order');
          }
        }
        
        // Queue opening emails to all users for immediate orders
        await queueOpeningEmails(newOrder);
        
      } else if (newOrder.status === 'scheduled') {
        // For scheduled orders: Only send admin notification (opening emails will be sent by cron job)
        if (adminEmail) {
          const openingTime = new Date(newOrder.opening_time);
          const openingTimeStr = openingTime.toLocaleString('he-IL', {
            timeZone: 'Asia/Jerusalem',
            weekday: 'long',
            year: 'numeric',
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          
          const { error: adminEmailError } = await supabase
            .from('email_logs')
            .insert([{
              recipient_email: adminEmail,
              subject: `הזמנה קבוצתית תוזמנה - ${title}`,
              body: `GENERAL_ORDER_SCHEDULED:${newOrder.id}:${openingTimeStr}`,
              status: 'failed' // Use 'failed' as queue status
            }]);

          if (adminEmailError) {
            console.error('Error queueing admin email:', adminEmailError);
          } else {
            console.log('Admin notification queued for scheduled order');
          }
        }
        
        console.log('📧 Opening emails will be sent automatically when order opens via cron job');
      }

    } catch (emailSystemError) {
      console.error('Email system error:', emailSystemError);
    }

    return NextResponse.json({
      message: 'הזמנה קבוצתית נוצרה בהצלחה',
      order: newOrder
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'שגיאה בשרת' },
      { status: 500 }
    );
  }
}