import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OneSignalService from '@/lib/oneSignalService';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const oneSignal = new OneSignalService();

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

    // If closing the order, calculate and store total_amount and total_orders
    if (status === 'closed') {
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('general_order_id', id);

      if (!ordersError && orders) {
        updateData.total_orders = orders.length;
        updateData.total_amount = orders.reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0);
        console.log(`💰 Closing order with ${orders.length} orders, total amount: ₪${updateData.total_amount}`);
      }
    }

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
      console.log('🔄 Closing shop because order status changed to closed...');
      
      // Get the shop status record first (there should only be one)
      const { data: shopStatus, error: fetchShopError } = await supabase
        .from('shop_status')
        .select('id, is_open, current_general_order_id')
        .single();

      if (fetchShopError) {
        console.error('❌ Error fetching shop status:', fetchShopError);
      } else if (shopStatus) {
        console.log('📊 Current shop status before closing:', {
          id: shopStatus.id,
          is_open: shopStatus.is_open,
          current_order: shopStatus.current_general_order_id
        });

        const { data: updatedShop, error: shopError } = await supabase
          .from('shop_status')
          .update({
            is_open: false,
            current_general_order_id: null,
            message: 'החנות סגורה כרגע. נפתח בהזמנה קבוצתית הבאה.',
            updated_at: new Date().toISOString()
          })
          .eq('id', shopStatus.id)
          .select();

        if (shopError) {
          console.error('❌ Error closing shop:', shopError);
        } else {
          console.log('✅ Shop closed successfully:', updatedShop);
        }
      } else {
        console.error('❌ No shop status record found');
      }

      // Send push notification when order closes
      try {
        console.log('📱 Sending push notification for closed general order...');
        const totalOrders = updateData.total_orders || 0;
        const totalAmount = updateData.total_amount || 0;
        
        await oneSignal.sendToAll({
          title: '🔒 הזמנה קבוצתית נסגרה',
          body: `${updatedOrder.title} נסגרה. סה"כ ${totalOrders} הזמנות, ₪${totalAmount.toLocaleString('en-US')}`,
          url: '/shop',
          icon: '/icon.png'
        });
        
        console.log('✅ Push notification sent successfully for closed order');
      } catch (notificationError) {
        console.error('❌ Failed to send push notification:', notificationError);
      }

      // Trigger automatic closure emails for all participants
      if (!updatedOrder.closure_email_sent) {
        try {
          // Import the closure email system
          const { processOrderClosure } = require('../../../../../../auto_closure_emails.cjs');
          
          console.log('🎯 Triggering automatic closure emails for order:', id);
          await processOrderClosure(id);
          
          console.log('✅ Automatic closure emails processed');
        } catch (error) {
          console.error('❌ Error processing automatic closure emails:', error);
        }

        // Legacy system notification (keeping for compatibility)
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
          
          // Determine the correct base URL for internal API calls
          let baseUrl;
          if (process.env.NODE_ENV === 'production') {
            if (process.env.NEXT_PUBLIC_SITE_URL) {
              baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
            } else if (process.env.RAILWAY_PUBLIC_DOMAIN) {
              baseUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
            } else if (process.env.NEXTAUTH_URL) {
              baseUrl = process.env.NEXTAUTH_URL;
            } else {
              console.log('⚠️ No production URL found, skipping automatic email processing');
              return NextResponse.json({ success: true, message: 'הזמנה קבוצתית נסגרה בהצלחה' });
            }
          } else {
            baseUrl = 'http://127.0.0.1:3000';
          }
          
          const emailProcessResponse = await fetch(`${baseUrl}/api/admin/email-service`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            },
            signal: AbortSignal.timeout(10000)
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

    // Delete related activity log entries
    const { error: activityError } = await supabase
      .from('activity_log')
      .delete()
      .eq('general_order_id', id);

    if (activityError) {
      console.log('Warning: Could not delete activity_log entries:', activityError);
    } else {
      console.log(`📊 Deleted activity_log entries for general order ${id}`);
    }

    // Delete related WhatsApp messages before deleting the general order
    const { error: whatsappError } = await supabase
      .from('whatsapp_messages')
      .delete()
      .eq('general_order_id', id);

    if (whatsappError) {
      console.log('Warning: Could not delete whatsapp_messages entries:', whatsappError);
    } else {
      console.log(`📱 Deleted whatsapp_messages entries for general order ${id}`);
    }

    // Delete related email entries from both tables before deleting the general order
    const { error: emailQueueError } = await supabase
      .from('email_queue')
      .delete()
      .eq('general_order_id', id);

    if (emailQueueError) {
      console.log('Warning: Could not delete email_queue entries:', emailQueueError);
    } else {
      console.log(`📧 Deleted email_queue entries for general order ${id}`);
    }

    // Also clean email_logs table (if general_order_id column exists)
    try {
      const { error: emailLogsError } = await supabase
        .from('email_logs')
        .delete()
        .eq('general_order_id', id);

      if (emailLogsError) {
        if (emailLogsError.code === '42703') {
          // Column doesn't exist - this is expected, skip silently
          console.log('📧 email_logs table does not have general_order_id column - skipping cleanup');
        } else {
          console.log('Warning: Could not delete email_logs entries:', emailLogsError);
        }
      } else {
        console.log(`📧 Deleted email_logs entries for general order ${id}`);
      }
    } catch (emailLogsCleanupError) {
      console.log('Warning: email_logs cleanup failed:', emailLogsCleanupError.message);
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

    // Close the shop after deleting the general order
    try {
      console.log('🔄 Attempting to close shop after order deletion...');
      
      // Get the shop status record first (there should only be one)
      const { data: shopStatus, error: fetchShopError } = await supabase
        .from('shop_status')
        .select('id, current_general_order_id, is_open')
        .single();

      if (fetchShopError) {
        console.error('❌ Error fetching shop status:', fetchShopError);
      } else if (shopStatus) {
        console.log('📊 Current shop status:', {
          id: shopStatus.id,
          is_open: shopStatus.is_open,
          current_order: shopStatus.current_general_order_id
        });

        // Update shop status to closed
        const { data: updatedShop, error: shopError } = await supabase
          .from('shop_status')
          .update({
            is_open: false,
            current_general_order_id: null,
            message: 'החנות סגורה כרגע. נפתח בהזמנה קבוצתית הבאה.',
            updated_at: new Date().toISOString()
          })
          .eq('id', shopStatus.id)
          .select();

        if (shopError) {
          console.error('❌ Error closing shop:', shopError);
        } else {
          console.log('✅ Shop closed successfully after order deletion:', updatedShop);
        }
      } else {
        console.error('❌ No shop status record found');
      }
    } catch (shopUpdateError) {
      console.error('❌ Shop status update error:', shopUpdateError);
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