import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
      console.log(`Found ${expiredOrders.length} expired orders, closing them automatically...`);
      
      // Close expired orders
      const { error: closeError } = await supabase
        .from('general_orders')
        .update({ 
          status: 'closed',
          updated_at: new Date().toISOString()
        })
        .in('id', expiredOrders.map(order => order.id));

      if (closeError) {
        console.error('Error auto-closing expired orders:', closeError);
      } else {
        console.log(`Successfully auto-closed ${expiredOrders.length} expired orders`);
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

    const { data: newOrder, error: createError } = await supabase
      .from('general_orders')
      .insert([{
        title,
        description,
        deadline: jerusalemDeadline,
        opening_time: jerusalemOpeningTime,
        created_by,
        // Set status explicitly since triggers might not work if opening_time column doesn't exist
        status: jerusalemOpeningTime && new Date(jerusalemOpeningTime) > new Date() ? 'scheduled' : 'open',
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

    // Try to open the shop (skip if RPC function doesn't exist)
    try {
      const { error: shopError } = await supabase
        .rpc('toggle_shop_status', {
          open_status: true,
          general_order_id: newOrder.id,
          status_message: `החנות פתוחה להזמנות! הזמנה קבוצתית: ${title}`
        });

      if (shopError) {
        console.error('Error opening shop (RPC might not exist):', shopError);
      }
    } catch (shopRpcError) {
      console.error('Shop RPC function not available:', shopRpcError);
    }

    // Queue opening email notification
    try {
      const { error: emailError } = await supabase
        .from('email_logs')
        .insert([{
          recipient_email: 'SYSTEM_ORDER_OPENED',
          subject: `הזמנה קבוצתית חדשה נפתחה - ${title}`,
          body: `GENERAL_ORDER_OPENED:${newOrder.id}`,
          status: 'failed' // Use 'failed' as queue status, will be changed to 'sent' when processed
        }]);

      if (emailError) {
        console.error('Error queueing email notification:', emailError);
      } else {
        console.log('Email notification queued successfully');
        
        // Automatically trigger email processing
        try {
          console.log('Triggering automatic email processing...');
          const emailServiceResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/admin/email-service`, {
            method: 'GET'
          });
          
          if (emailServiceResponse.ok) {
            const emailResult = await emailServiceResponse.json();
            console.log('Automatic email processing result:', emailResult);
          } else {
            console.error('Email service request failed:', emailServiceResponse.status);
          }
        } catch (autoEmailError) {
          console.error('Error in automatic email processing:', autoEmailError);
          // Don't fail the order creation if email processing fails
        }
      }
    } catch (emailTableError) {
      console.error('Email logs table structure issue:', emailTableError);
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