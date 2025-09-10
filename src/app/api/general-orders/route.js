import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/supabase';

// GET /api/general-orders - List all general orders
export async function GET() {
    try {
        
        // Get all general orders with participant counts
        const { data: orders, error } = await supabaseAdmin
            .from('general_orders')
            .select(`
                *,
                order_items (
                    id,
                    user_id,
                    quantity,
                    total_price
                )
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Database error:', error);
            return NextResponse.json({ error: 'שגיאה בטעינת הזמנות קבוצתיות' }, { status: 500 });
        }

        // Calculate totals for each order
        const ordersWithTotals = orders.map(order => {
            const items = order.order_items || [];
            const total_orders = items.length;
            const total_amount = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
            const unique_participants = new Set(items.map(item => item.user_id)).size;

            return {
                ...order,
                order_items: undefined, // Remove detailed items from response
                total_orders,
                total_amount,
                participant_count: unique_participants
            };
        });

        return NextResponse.json(ordersWithTotals);
    } catch (error) {
        console.error('Error fetching general orders:', error);
        return NextResponse.json({ error: 'שגיאה בטעינת הזמנות קבוצתיות' }, { status: 500 });
    }
}

// POST /api/general-orders - Create new general order (admin only)
export async function POST(request) {
    try {
        const user = getCurrentUser();
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
        }

        const body = await request.json();
        const { title, description, deadline, opening_time } = body;

        if (!title || !deadline) {
            return NextResponse.json({ error: 'כותרת ותאריך סגירה הם שדות חובה' }, { status: 400 });
        }

        // Validate dates
        const deadlineDate = new Date(deadline);
        if (deadlineDate <= new Date()) {
            return NextResponse.json({ error: 'תאריך הסגירה חייב להיות בעתיד' }, { status: 400 });
        }

        if (opening_time) {
            const openingDate = new Date(opening_time);
            if (openingDate >= deadlineDate) {
                return NextResponse.json({ error: 'תאריך הפתיחה חייב להיות לפני תאריך הסגירה' }, { status: 400 });
            }
        }

        // Determine initial status
        let status = 'open';
        if (opening_time) {
            const now = new Date();
            const openingDate = new Date(opening_time);
            status = openingDate > now ? 'scheduled' : 'open';
        }

        const { data: newOrder, error } = await supabaseAdmin
            .from('general_orders')
            .insert([{
                title,
                description,
                deadline,
                opening_time,
                status,
                created_by: user.id
            }])
            .select()
            .single();

        if (error) {
            console.error('Database error:', error);
            return NextResponse.json({ error: 'שגיאה ביצירת הזמנה קבוצתית' }, { status: 500 });
        }

        // If order is immediately open, send opening notification
        if (status === 'open') {
            try {
                await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/admin/email-service`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'general_order_opened',
                        orderId: order.id,
                        orderTitle: order.title,
                        deadline: order.deadline
                    })
                });
            } catch (emailError) {
                console.error('Failed to send opening notification:', emailError);
                // Don't fail the order creation if email fails
            }
        }

        return NextResponse.json(order, { status: 201 });
    } catch (error) {
        console.error('Error creating general order:', error);
        return NextResponse.json({ error: 'שגיאה ביצירת הזמנה קבוצתית' }, { status: 500 });
    }
}