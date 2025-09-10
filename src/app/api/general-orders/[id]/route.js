import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/supabase';

// GET /api/general-orders/[id] - Get specific general order
export async function GET(request, { params }) {
    try {
        const { id } = params;

        const { data: order, error } = await supabaseAdmin
            .from('general_orders')
            .select(`
                *,
                order_items (
                    id,
                    user_id,
                    product_id,
                    quantity,
                    price_per_item,
                    total_price,
                    created_at,
                    users (
                        full_name,
                        username,
                        email
                    ),
                    products (
                        name,
                        description,
                        image_url
                    )
                )
            `)
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return NextResponse.json({ error: 'הזמנה קבוצתית לא נמצאה' }, { status: 404 });
            }
            console.error('Database error:', error);
            return NextResponse.json({ error: 'שגיאה בטעינת הזמנה קבוצתית' }, { status: 500 });
        }

        // Calculate totals
        const items = order.order_items || [];
        const total_orders = items.length;
        const total_amount = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
        const unique_participants = new Set(items.map(item => item.user_id)).size;

        return NextResponse.json({
            ...order,
            total_orders,
            total_amount,
            participant_count: unique_participants
        });
    } catch (error) {
        console.error('Error fetching general order:', error);
        return NextResponse.json({ error: 'שגיאה בטעינת הזמנה קבוצתית' }, { status: 500 });
    }
}

// PUT /api/general-orders/[id] - Update general order
export async function PUT(request, { params }) {
    try {
        const user = getCurrentUser();
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
        }

        const { id } = params;
        const body = await request.json();
        const { title, description, deadline, opening_time, status } = body;

        // First check if order exists
        const { data: existingOrder, error: fetchError } = await supabaseAdmin
            .from('general_orders')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) {
            if (fetchError.code === 'PGRST116') {
                return NextResponse.json({ error: 'הזמנה קבוצתית לא נמצאה' }, { status: 404 });
            }
            console.error('Database error:', fetchError);
            return NextResponse.json({ error: 'שגיאה בטעינת הזמנה קבוצתית' }, { status: 500 });
        }

        // Validate dates if provided
        if (deadline) {
            const deadlineDate = new Date(deadline);
            if (deadlineDate <= new Date() && status !== 'closed') {
                return NextResponse.json({ error: 'תאריך הסגירה חייב להיות בעתיד' }, { status: 400 });
            }

            if (opening_time) {
                const openingDate = new Date(opening_time);
                if (openingDate >= deadlineDate) {
                    return NextResponse.json({ error: 'תאריך הפתיחה חייב להיות לפני תאריך הסגירה' }, { status: 400 });
                }
            }
        }

        // Prepare update data
        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (deadline !== undefined) updateData.deadline = deadline;
        if (opening_time !== undefined) updateData.opening_time = opening_time;
        if (status !== undefined) updateData.status = status;

        const { data: updatedOrder, error } = await supabase
            .from('general_orders')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Database error:', error);
            return NextResponse.json({ error: 'שגיאה בעדכון הזמנה קבוצתית' }, { status: 500 });
        }

        // Send notifications for status changes
        if (status && status !== existingOrder.status) {
            try {
                let emailType = '';
                if (status === 'open' && existingOrder.status === 'scheduled') {
                    emailType = 'general_order_opened';
                } else if (status === 'closed' && existingOrder.status === 'open') {
                    emailType = 'general_order_closed';
                }

                if (emailType) {
                    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/admin/email-service`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: emailType,
                            orderId: updatedOrder.id,
                            orderTitle: updatedOrder.title,
                            deadline: updatedOrder.deadline
                        })
                    });
                }
            } catch (emailError) {
                console.error('Failed to send status change notification:', emailError);
                // Don't fail the update if email fails
            }
        }

        return NextResponse.json(updatedOrder);
    } catch (error) {
        console.error('Error updating general order:', error);
        return NextResponse.json({ error: 'שגיאה בעדכון הזמנה קבוצתית' }, { status: 500 });
    }
}

// DELETE /api/general-orders/[id] - Delete general order
export async function DELETE(request, { params }) {
    try {
        const user = getCurrentUser();
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
        }

        const { id } = params;

        // First delete related order items
        const { error: itemsError } = await supabaseAdmin
            .from('order_items')
            .delete()
            .eq('general_order_id', id);

        if (itemsError) {
            console.error('Error deleting order items:', itemsError);
            return NextResponse.json({ error: 'שגיאה במחיקת פריטי הזמנה' }, { status: 500 });
        }

        // Then delete the general order
        const { error } = await supabase
            .from('general_orders')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Database error:', error);
            return NextResponse.json({ error: 'שגיאה במחיקת הזמנה קבוצתית' }, { status: 500 });
        }

        return NextResponse.json({ message: 'הזמנה קבוצתית נמחקה בהצלחה' });
    } catch (error) {
        console.error('Error deleting general order:', error);
        return NextResponse.json({ error: 'שגיאה במחיקת הזמנה קבוצתית' }, { status: 500 });
    }
}