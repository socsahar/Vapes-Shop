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

        // Calculate total revenue
        const { data: orders, error: revenueError } = await supabaseAdmin
            .from('orders')
            .select('total_amount')
            .eq('status', 'completed');

        let totalRevenue = 0;
        if (!revenueError && orders) {
            totalRevenue = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
        }

        return NextResponse.json({
            users: usersCount || 0,
            products: productsCount || 0,
            orders: ordersCount || 0,
            revenue: totalRevenue
        });

    } catch (error) {
        console.error('Stats API Error:', error);
        return NextResponse.json(
            { 
                users: 0,
                products: 0,
                orders: 0,
                revenue: 0,
                error: 'Failed to fetch stats'
            },
            { status: 500 }
        );
    }
}