import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET - Fetch all orders (admin only)
export async function GET() {
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items(
          id,
          product_id,
          quantity,
          unit_price,
          total_price,
          products(name, price, description, image_url)
        ),
        general_orders(
          id,
          title,
          status
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching orders:', error);
      return NextResponse.json(
        { error: 'שגיאה בטעינת ההזמנות' },
        { status: 500 }
      );
    }

    // Fetch user data separately for each order
    const ordersWithUsers = await Promise.all(orders.map(async (order) => {
      const { data: user } = await supabase
        .from('users')
        .select('full_name, phone, username')
        .eq('id', order.user_id)
        .single();
      
      return {
        ...order,
        user: user
      };
    }));

    // Calculate totals and format data
    const formattedOrders = ordersWithUsers.map(order => ({
      ...order,
      // Ensure total_amount is calculated from order_items if not set
      total_amount: order.total_amount || order.order_items?.reduce((sum, item) => sum + parseFloat(item.total_price || 0), 0) || 0,
      // Add helper info
      items_count: order.order_items?.length || 0,
      is_group_order: !!order.general_order_id
    }));

    return NextResponse.json({
      orders: formattedOrders,
      total: formattedOrders.length
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'שגיאה בשרת' },
      { status: 500 }
    );
  }
}