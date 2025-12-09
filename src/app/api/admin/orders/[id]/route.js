import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';

export async function DELETE(request, { params }) {
    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
        }

        // Delete order items first (foreign key constraint)
        const { error: itemsError } = await supabaseAdmin
            .from('order_items')
            .delete()
            .eq('order_id', id);

        if (itemsError) {
            console.error('Error deleting order items:', itemsError);
            return NextResponse.json({ error: 'Failed to delete order items' }, { status: 500 });
        }

        // Delete the order
        const { error: orderError } = await supabaseAdmin
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
