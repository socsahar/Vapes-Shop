import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabase';

export async function GET(request, { params }) {
    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            );
        }

        // Fetch orders for the specific user with items
        const { data: orders, error } = await supabaseAdmin
            .from('orders')
            .select(`
                id,
                status,
                total_amount,
                notes,
                created_at,
                updated_at
            `)
            .eq('user_id', id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching user orders:', error);
            return NextResponse.json(
                { error: 'Failed to fetch orders' },
                { status: 500 }
            );
        }

        // Fetch order items separately for each order
        const ordersWithItems = [];
        for (const order of orders || []) {
            const { data: items, error: itemsError } = await supabaseAdmin
                .from('order_items')
                .select(`
                    id,
                    product_id,
                    quantity,
                    price,
                    products(name, price)
                `)
                .eq('order_id', order.id);

            if (!itemsError) {
                ordersWithItems.push({
                    ...order,
                    items: items || []
                });
            } else {
                ordersWithItems.push({
                    ...order,
                    items: []
                });
            }
        }

        return NextResponse.json({
            success: true,
            orders: ordersWithItems
        });

    } catch (error) {
        console.error('User orders API Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}