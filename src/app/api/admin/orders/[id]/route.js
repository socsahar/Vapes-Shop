import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function DELETE(request, { params }) {
    try {
        const { id } = params;

        // Verify admin authentication
        const authHeader = request.headers.get('authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 401 });
        }

        // Verify user is admin
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('role')
            .eq('id', userId)
            .single();

        if (userError || !user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
        }

        // Delete order items first (foreign key constraint)
        const { error: itemsError } = await supabase
            .from('order_items')
            .delete()
            .eq('order_id', id);

        if (itemsError) {
            console.error('Error deleting order items:', itemsError);
            return NextResponse.json({ error: 'Failed to delete order items' }, { status: 500 });
        }

        // Delete the order
        const { error: orderError } = await supabase
            .from('orders')
            .delete()
            .eq('id', id);

        if (orderError) {
            console.error('Error deleting order:', orderError);
            return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 });
        }

        return NextResponse.json({ 
            success: true, 
            message: 'Order deleted successfully' 
        });

    } catch (error) {
        console.error('Error in DELETE /api/admin/orders/[id]:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
