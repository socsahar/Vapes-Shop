import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// POST - Manually trigger closure of expired general orders
export async function POST(request) {
  try {
    console.log('Checking for expired general orders...');

    // Get all open general orders that have passed their deadline
    const { data: expiredOrders, error: fetchError } = await supabase
      .from('general_orders')
      .select('id, title, deadline, status')
      .eq('status', 'open')
      .lt('deadline', new Date().toISOString());

    if (fetchError) {
      console.error('Error fetching expired orders:', fetchError);
      return NextResponse.json(
        { error: 'שגיאה בטעינת הזמנות פגות תוקף' },
        { status: 500 }
      );
    }

    if (!expiredOrders || expiredOrders.length === 0) {
      console.log('No expired orders found');
      return NextResponse.json({
        message: 'לא נמצאו הזמנות פגות תוקף',
        closedOrders: []
      });
    }

    console.log(`Found ${expiredOrders.length} expired orders:`, expiredOrders);

    // Close expired orders
    const { data: updatedOrders, error: updateError } = await supabase
      .from('general_orders')
      .update({ 
        status: 'closed',
        updated_at: new Date().toISOString()
      })
      .in('id', expiredOrders.map(order => order.id))
      .select();

    if (updateError) {
      console.error('Error closing expired orders:', updateError);
      return NextResponse.json(
        { error: 'שגיאה בסגירת הזמנות פגות תוקף' },
        { status: 500 }
      );
    }

    console.log(`Successfully closed ${updatedOrders?.length || 0} orders`);

    // For each closed order, close the shop if it was the current order
    for (const order of expiredOrders) {
      try {
        // Check if this was the current shop order
        const { data: shopStatus, error: shopError } = await supabase
          .from('shop_status')
          .select('current_general_order_id')
          .single();

        if (!shopError && shopStatus?.current_general_order_id === order.id) {
          // Close the shop
          const { error: closeShopError } = await supabase
            .from('shop_status')
            .update({
              is_open: false,
              current_general_order_id: null,
              message: 'החנות סגורה - ההזמנה הקבוצתית הסתיימה',
              updated_at: new Date().toISOString()
            })
            .eq('id', shopStatus.id);

          if (closeShopError) {
            console.error('Error closing shop for expired order:', closeShopError);
          } else {
            console.log(`Closed shop for expired order: ${order.title}`);
          }
        }

        // Queue closure notification email
        const { error: emailError } = await supabase
          .from('email_logs')
          .insert([{
            recipient_email: 'SYSTEM_ORDER_CLOSED',
            subject: `הזמנה קבוצתית נסגרה אוטומטית - ${order.title}`,
            body: `GENERAL_ORDER_CLOSED:${order.id}:EXPIRED`,
            status: 'failed', // Use 'failed' as queue status
            created_at: new Date().toISOString()
          }]);

        if (emailError) {
          console.error('Error queueing closure email:', emailError);
        }

        // Queue general order summary email for admins
        const { error: summaryEmailError } = await supabase
          .from('email_logs')
          .insert([{
            recipient_email: 'SYSTEM_GENERAL_ORDER_SUMMARY',
            subject: `סיכום הזמנה קבוצתית - ${order.title}`,
            body: `GENERAL_ORDER_SUMMARY:${order.id}:AUTO_CLOSED`,
            status: 'failed', // Use 'failed' as queue status
            created_at: new Date().toISOString()
          }]);

        if (summaryEmailError) {
          console.error('Error queueing summary email:', summaryEmailError);
        } else {
          console.log(`Queued general order summary email for order: ${order.title}`);
        }

        // Automatically trigger email processing for closure notifications
        try {
          console.log('Triggering automatic email processing for closure notification...');
          const emailServiceResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/admin/email-service`, {
            method: 'GET'
          });
          
          if (emailServiceResponse.ok) {
            const emailResult = await emailServiceResponse.json();
            console.log('Auto-close email processing result:', emailResult);
          }
        } catch (autoEmailError) {
          console.error('Error in automatic closure email processing:', autoEmailError);
        }

      } catch (shopCloseError) {
        console.error('Error in shop closure process:', shopCloseError);
      }
    }

    return NextResponse.json({
      message: `${expiredOrders.length} הזמנות קבוצתיות נסגרו אוטומטית`,
      closedOrders: expiredOrders.map(order => ({
        id: order.id,
        title: order.title,
        deadline: order.deadline
      }))
    });

  } catch (error) {
    console.error('Unexpected error in auto-close:', error);
    return NextResponse.json(
      { error: 'שגיאה בשרת' },
      { status: 500 }
    );
  }
}

// GET - Check which orders would be closed (dry run)
export async function GET() {
  try {
    const { data: expiredOrders, error } = await supabase
      .from('general_orders')
      .select('id, title, deadline, status, created_at')
      .eq('status', 'open')
      .lt('deadline', new Date().toISOString());

    if (error) {
      console.error('Error fetching expired orders:', error);
      return NextResponse.json(
        { error: 'שגיאה בטעינת הזמנות פגות תוקף' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      expiredOrdersCount: expiredOrders?.length || 0,
      expiredOrders: expiredOrders || [],
      currentTime: new Date().toISOString(),
      message: expiredOrders?.length > 0 
        ? `${expiredOrders.length} הזמנות ממתינות לסגירה אוטומטית`
        : 'אין הזמנות פגות תוקף'
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'שגיאה בשרת' },
      { status: 500 }
    );
  }
}