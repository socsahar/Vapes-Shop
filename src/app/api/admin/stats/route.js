import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';

export async function GET(request) {
    try {
        // Get users count
        const { count: usersCount, error: usersError } = await supabaseAdmin
            .from('users')
            .select('*', { count: 'exact', head: true });

        if (usersError) {
            console.error('Error counting users:', usersError);
        }

        // Get products count
        const { count: productsCount, error: productsError } = await supabaseAdmin
            .from('products')
            .select('*', { count: 'exact', head: true });

        if (productsError) {
            console.error('Error counting products:', productsError);
        }

        // Get orders count
        const { count: ordersCount, error: ordersError } = await supabaseAdmin
            .from('orders')
            .select('*', { count: 'exact', head: true });

        if (ordersError) {
            console.error('Error counting orders:', ordersError);
        }

        // Get general orders count
        const { count: generalOrdersCount, error: generalOrdersError } = await supabaseAdmin
            .from('general_orders')
            .select('*', { count: 'exact', head: true });

        if (generalOrdersError) {
            console.error('Error counting general orders:', generalOrdersError);
        }

        // Calculate total revenue from CLOSED general orders
        // Revenue comes from individual user orders linked to closed general orders
        const { data: closedGeneralOrders, error: closedOrdersError } = await supabaseAdmin
            .from('general_orders')
            .select('id')
            .eq('status', 'closed');

        if (closedOrdersError) {
            console.error('[STATS] Error fetching closed general orders:', closedOrdersError);
        }

        console.log('[STATS] Closed general orders:', closedGeneralOrders?.length || 0);

        let totalRevenue = 0;
        if (!closedOrdersError && closedGeneralOrders && closedGeneralOrders.length > 0) {
            const closedOrderIds = closedGeneralOrders.map(order => order.id);
            console.log('[STATS] Closed order IDs:', closedOrderIds);
            
            // Get all user orders for these closed general orders
            const { data: userOrders, error: revenueError } = await supabaseAdmin
                .from('orders')
                .select('id, total_amount, general_order_id')
                .in('general_order_id', closedOrderIds);

            console.log('[STATS] User orders for closed general orders:', userOrders?.length || 0);
            if (userOrders && userOrders.length > 0) {
                console.log('[STATS] Sample user order:', userOrders[0]);
            }

            if (!revenueError && userOrders) {
                totalRevenue = userOrders.reduce((sum, order) => {
                    const amount = parseFloat(order.total_amount) || 0;
                    console.log(`[STATS] Order ${order.id}: ₪${amount}`);
                    return sum + amount;
                }, 0);
                console.log('[STATS] Total revenue calculated:', totalRevenue);
            } else if (revenueError) {
                console.error('[STATS] Error fetching user orders:', revenueError);
            }
        } else {
            console.log('[STATS] No closed general orders found, revenue = 0');
        }

        const statsResult = {
            users: usersCount || 0,
            products: productsCount || 0,
            orders: ordersCount || 0,
            generalOrders: generalOrdersCount || 0,
            revenue: totalRevenue
        };

        console.log('[STATS] Final stats result:', statsResult);

        return NextResponse.json(statsResult);

    } catch (error) {
        console.error('Stats API Error:', error);
        return NextResponse.json(
            { 
                users: 0,
                products: 0,
                orders: 0,
                generalOrders: 0,
                revenue: 0,
                error: 'Failed to fetch stats'
            },
            { status: 500 }
        );
    }
}