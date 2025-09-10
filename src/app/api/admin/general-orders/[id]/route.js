import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET - Get specific general order details
export async function GET(request, context) {
  try {
    const params = await context.params;
    const { id } = params;

    const { data: generalOrder, error } = await supabase
      .from('general_orders')
      .select(`
        *,
        creator:created_by(full_name, email)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching general order:', error);
      return NextResponse.json(
        { error: 'הזמנה קבוצתית לא נמצאה' },
        { status: 404 }
      );
    }

    // Fetch participants (orders) for this general order
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        user_id,
        total_amount,
        status,
        created_at,
        user:users!orders_user_id_fkey(full_name, email),
        order_items:order_items(
          id,
          product_id,
          quantity,
          price,
          product:product_id(name, price, description)
        )
      `)
      .eq('general_order_id', id);

    if (ordersError) {
      console.error('Error fetching orders for general order:', ordersError);
    }

    const orderWithParticipants = {
      ...generalOrder,
      participants: orders || [],
      total_orders: orders?.length || 0,
      total_amount: orders?.reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0) || 0
    };

    return NextResponse.json(orderWithParticipants);

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'שגיאה בשרת' },
      { status: 500 }
    );
  }
}

// PUT - Update general order (admin only) 
export async function PUT(request, context) {
  try {
    const params = await context.params;
    const { id } = params;
    const body = await request.json();
    const { title, description, deadline, status } = body;

    // Prepare update data
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (deadline !== undefined) updateData.deadline = new Date(deadline).toISOString();
    if (status !== undefined) updateData.status = status;

    const { data: updatedOrder, error } = await supabase
      .from('general_orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating general order:', error);
      return NextResponse.json(
        { error: 'שגיאה בעדכון הזמנה קבוצתית' },
        { status: 500 }
      );
    }

    // If status changed to closed, close the shop
    if (status === 'closed') {
      const { error: shopError } = await supabase
        .rpc('toggle_shop_status', {
          open_status: false,
          general_order_id: null,
          status_message: 'החנות סגורה כרגע. נפתח בהזמנה קבוצתית הבאה.'
        });

      if (shopError) {
        console.error('Error closing shop:', shopError);
      }

      // Queue closure email if not already sent
      if (!updatedOrder.closure_email_sent) {
        const { error: emailError } = await supabase
          .from('email_logs')
          .insert([{
            recipient_email: 'SYSTEM_ORDER_CLOSED',
            subject: `הזמנה קבוצתית נסגרה - ${updatedOrder.title}`,
            body: `GENERAL_ORDER_CLOSED:${updatedOrder.id}`,
            status: 'failed' // Use 'failed' as queue status
          }]);

        if (emailError) {
          console.error('Error queueing closure email:', emailError);
        }

        // Queue general order summary email for admins
        const { error: summaryEmailError } = await supabase
          .from('email_logs')
          .insert([{
            recipient_email: 'SYSTEM_GENERAL_ORDER_SUMMARY',
            subject: `סיכום הזמנה קבוצתית - ${updatedOrder.title}`,
            body: `GENERAL_ORDER_SUMMARY:${updatedOrder.id}:MANUAL_CLOSED`,
            status: 'failed' // Use 'failed' as queue status
          }]);

        if (summaryEmailError) {
          console.error('Error queueing summary email:', summaryEmailError);
        } else {
          console.log('General order summary email queued successfully');
        }

        // Mark closure email as sent
        await supabase
          .from('general_orders')
          .update({ closure_email_sent: true })
          .eq('id', id);

        console.log('Closure email queued successfully');

        // Trigger automatic email processing
        try {
          console.log('Triggering automatic email processing...');
          const emailProcessResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/admin/email-service`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          const emailResult = await emailProcessResponse.json();
          console.log('Automatic email processing result:', emailResult);
        } catch (emailProcessError) {
          console.error('Error triggering automatic email processing:', emailProcessError);
        }
      }
    }

    return NextResponse.json({
      message: 'הזמנה קבוצתית עודכנה בהצלחה',
      order: updatedOrder
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'שגיאה בשרת' },
      { status: 500 }
    );
  }
}

// DELETE - Delete general order (admin only)
export async function DELETE(request, context) {
  try {
    const params = await context.params;
    const { id } = params;

    console.log(`🗑️ Deleting general order ${id} and all related orders...`);

    // First, get all orders related to this general order
    const { data: relatedOrders, error: fetchError } = await supabase
      .from('orders')
      .select('id')
      .eq('general_order_id', id);

    if (fetchError) {
      console.error('Error fetching related orders:', fetchError);
      return NextResponse.json(
        { error: 'שגיאה בטעינת הזמנות קשורות' },
        { status: 500 }
      );
    }

    console.log(`📋 Found ${relatedOrders?.length || 0} orders to delete`);

    // Delete order items for all related orders
    if (relatedOrders && relatedOrders.length > 0) {
      const orderIds = relatedOrders.map(order => order.id);
      
      // Delete order items first (due to foreign key constraints)
      const { error: orderItemsError } = await supabase
        .from('order_items')
        .delete()
        .in('order_id', orderIds);

      if (orderItemsError) {
        console.error('Error deleting order items:', orderItemsError);
        return NextResponse.json(
          { error: 'שגיאה במחיקת פריטי הזמנות' },
          { status: 500 }
        );
      }

      console.log(`🛍️ Deleted order items for ${orderIds.length} orders`);

      // Delete the orders themselves
      const { error: ordersError } = await supabase
        .from('orders')
        .delete()
        .in('id', orderIds);

      if (ordersError) {
        console.error('Error deleting orders:', ordersError);
        return NextResponse.json(
          { error: 'שגיאה במחיקת הזמנות' },
          { status: 500 }
        );
      }

      console.log(`📦 Deleted ${orderIds.length} orders`);
    }

    // Finally, delete the general order
    const { error } = await supabase
      .from('general_orders')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting general order:', error);
      return NextResponse.json(
        { error: 'שגיאה במחיקת הזמנה קבוצתית' },
        { status: 500 }
      );
    }

    console.log(`✅ General order ${id} and all related data deleted successfully`);

    // Close the shop if this was the current active order
    try {
      const { error: shopError } = await supabase
        .rpc('toggle_shop_status', {
          open_status: false,
          general_order_id: null,
          status_message: 'החנות סגורה כרגע. נפתח בהזמנה קבוצתית הבאה.'
        });

      if (shopError) {
        console.error('Error closing shop (RPC might not exist):', shopError);
      }
    } catch (shopRpcError) {
      console.error('Shop RPC function not available:', shopRpcError);
    }

    return NextResponse.json({
      message: 'הזמנה קבוצתית וכל ההזמנות הקשורות נמחקו בהצלחה',
      deletedOrders: relatedOrders?.length || 0
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'שגיאה בשרת' },
      { status: 500 }
    );
  }
}