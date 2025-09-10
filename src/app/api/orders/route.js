import { NextResponse } from 'next/server';
import { supabaseAdmin, getCurrentUserFromRequest } from '../../../lib/supabase';

// GET /api/orders - Get user's orders within group orders
export async function GET(request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'נדרשת התחברות' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const general_order_id = searchParams.get('general_order_id');
        const status = searchParams.get('status'); // 'active', 'completed', 'all'

        let query = supabaseAdmin
            .from('orders')
            .select(`
                id,
                user_id,
                general_order_id,
                total_amount,
                status,
                created_at,
                general_orders (
                    id,
                    title,
                    description,
                    deadline,
                    status,
                    created_at
                ),
                order_items (
                    id,
                    product_id,
                    quantity,
                    price,
                    products (
                        name,
                        description,
                        image_url,
                        price
                    )
                )
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        // Filter by general order if specified
        if (general_order_id) {
            query = query.eq('general_order_id', general_order_id);
        }

        const { data: orders, error } = await query;

        if (error) {
            console.error('Database error:', error);
            return NextResponse.json({ error: 'שגיאה בטעינת הזמנות' }, { status: 500 });
        }

        // Filter and format orders
        let filteredOrders = orders || [];
        
        // Filter by status if specified
        if (status && status !== 'all') {
            if (status === 'active') {
                filteredOrders = filteredOrders.filter(order => order.general_orders?.status === 'open');
            } else if (status === 'completed') {
                filteredOrders = filteredOrders.filter(order => 
                    order.general_orders?.status === 'closed' || order.general_orders?.status === 'completed'
                );
            }
        }

        // Format the response
        const formattedOrders = filteredOrders.map(order => {
            const deadline = new Date(order.general_orders?.deadline || new Date());
            const now = new Date();
            const time_remaining = deadline.getTime() - now.getTime();
            
            return {
                id: order.id,
                general_order: order.general_orders,
                items: order.order_items?.map(item => ({
                    id: item.id,
                    product: item.products,
                    quantity: item.quantity,
                    unit_price: item.price,
                    total_price: item.price * item.quantity
                })) || [],
                total_amount: order.total_amount || 0,
                total_items: order.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
                hours_remaining: Math.max(0, Math.floor(time_remaining / (1000 * 60 * 60))),
                minutes_remaining: Math.max(0, Math.floor((time_remaining % (1000 * 60 * 60)) / (1000 * 60))),
                is_expired: deadline <= now,
                is_ending_soon: time_remaining > 0 && time_remaining < 24 * 60 * 60 * 1000,
                created_at: order.created_at
            };
        });

        return NextResponse.json({
            orders: formattedOrders,
            total_orders: formattedOrders.length,
            active_orders: formattedOrders.filter(o => o.general_order?.status === 'open').length,
            completed_orders: formattedOrders.filter(o => ['closed', 'completed'].includes(o.general_order?.status)).length
        });
    } catch (error) {
        console.error('Error fetching user orders:', error);
        return NextResponse.json({ error: 'שגיאה בטעינת הזמנות' }, { status: 500 });
    }
}

// POST /api/orders - Deprecated - Use /api/general-orders/participate instead
export async function POST(request) {
    return NextResponse.json({ 
        error: 'API זה הוצא משירות. השתמש ב-/api/general-orders/participate במקום זאת',
        redirect: '/api/general-orders/participate',
        message: 'Please use the group orders participation API for adding items to orders'
    }, { status: 410 });
}