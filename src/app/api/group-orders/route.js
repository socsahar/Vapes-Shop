import { NextResponse } from 'next/server';
import { supabaseAdmin, getCurrentUserFromRequest } from '../../../lib/supabase';

// GET /api/group-orders - List active group orders for users  
export async function GET(request) {
    try {
        // Get current user from JWT token
        const user = await getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'נדרשת התחברות' }, { status: 401 });
        }
        
        console.log('Fetching active group orders...');
        
        const now = new Date().toISOString();
        console.log('Current time:', now);

        // First, automatically close any expired orders
        const { data: expiredOrders } = await supabaseAdmin
            .from('general_orders')
            .select('id, title')
            .eq('status', 'open')
            .lt('deadline', now);

        if (expiredOrders && expiredOrders.length > 0) {
            console.log(`Auto-closing ${expiredOrders.length} expired orders...`);
            
            // Close the expired orders
            await supabaseAdmin
                .from('general_orders')
                .update({ 
                    status: 'closed',
                    updated_at: now
                })
                .in('id', expiredOrders.map(order => order.id));
            
            // Send closure emails for each expired order
            for (const order of expiredOrders) {
                try {
                    // Queue closure email
                    const { error: emailError } = await supabaseAdmin
                        .from('email_logs')
                        .insert([{
                            recipient_email: 'SYSTEM_ORDER_CLOSED',
                            subject: `הזמנה קבוצתית נסגרה אוטומטית - ${order.title}`,
                            body: `GENERAL_ORDER_CLOSED:${order.id}`,
                            status: 'failed' // Use 'failed' as queue status
                        }]);

                    if (emailError) {
                        console.error('Error queueing closure email for order:', order.id, emailError);
                    } else {
                        console.log(`Closure email queued for expired order: ${order.title}`);
                        
                        // Trigger automatic email processing
                        try {
                            const emailProcessResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/admin/email-service`, {
                                method: 'GET'
                            });
                            
                            if (emailProcessResponse.ok) {
                                const emailResult = await emailProcessResponse.json();
                                console.log(`Auto-close email processing result for ${order.title}:`, emailResult);
                            }
                        } catch (emailProcessError) {
                            console.error('Error triggering email processing for auto-closed order:', emailProcessError);
                        }
                    }
                } catch (emailSystemError) {
                    console.error('Error in closure email system for order:', order.id, emailSystemError);
                }
            }
        }

        // Get active general orders (open and not past deadline)
        const { data: orders, error } = await supabaseAdmin
            .from('general_orders')
            .select(`
                *,
                orders (
                    id,
                    user_id,
                    total_amount
                )
            `)
            .eq('status', 'open')
            .gte('deadline', now)
            .order('deadline', { ascending: true });

        if (error) {
            console.error('Database error:', error);
            return NextResponse.json({ error: 'שגיאה בטעינת הזמנות קבוצתיות' }, { status: 500 });
        }

        // Calculate participation info for each order
        const ordersWithInfo = orders.map(order => {
            const items = order.orders || [];
            const total_participants = new Set(items.map(item => item.user_id)).size;
            const total_amount = items.reduce((sum, item) => sum + (item.total_amount || 0), 0);
            
            // Check if current user is participating
            const userOrder = items.find(item => item.user_id === user.id);
            const user_participating = !!userOrder;
            const user_total = userOrder ? userOrder.total_amount : 0;

            // Calculate time remaining in days, hours, and minutes
            const deadline = new Date(order.deadline);
            const time_remaining = deadline.getTime() - new Date().getTime();
            const total_hours = Math.max(0, Math.floor(time_remaining / (1000 * 60 * 60)));
            const days_remaining = Math.floor(total_hours / 24);
            const hours_remaining = total_hours % 24;
            const minutes_remaining = Math.max(0, Math.floor((time_remaining % (1000 * 60 * 60)) / (1000 * 60)));

            return {
                id: order.id,
                title: order.title,
                description: order.description,
                deadline: order.deadline,
                status: order.status,
                created_at: order.created_at,
                total_participants,
                total_amount,
                user_participating,
                user_total,
                days_remaining,
                hours_remaining,
                minutes_remaining,
                is_ending_soon: total_hours < 24
            };
        });

        return NextResponse.json({
            orders: ordersWithInfo,
            active_count: ordersWithInfo.length
        });
    } catch (error) {
        console.error('Error fetching group orders:', error);
        return NextResponse.json({ error: 'שגיאה בטעינת הזמנות קבוצתיות' }, { status: 500 });
    }
}

// POST /api/group-orders - Participate in group order (alternative endpoint)
export async function POST(request) {
    try {
        // Get current user from JWT token
        const user = await getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'נדרשת התחברות' }, { status: 401 });
        }
        
        const body = await request.json();
        const { general_order_id, items, action } = body;

        if (!general_order_id) {
            return NextResponse.json({ error: 'מזהה הזמנה קבוצתית נדרש' }, { status: 400 });
        }

        // Check if general order exists and is open
        const { data: generalOrder, error: orderError } = await supabaseAdmin
            .from('general_orders')
            .select('*')
            .eq('id', general_order_id)
            .single();

        if (orderError) {
            if (orderError.code === 'PGRST116') {
                return NextResponse.json({ error: 'הזמנה קבוצתית לא נמצאה' }, { status: 404 });
            }
            console.error('Database error:', orderError);
            return NextResponse.json({ error: 'שגיאה בטעינת הזמנה קבוצתית' }, { status: 500 });
        }

        // Check if order is open and not expired
        if (generalOrder.status !== 'open') {
            return NextResponse.json({ error: 'הזמנה קבוצתית לא פתוחה להשתתפות' }, { status: 400 });
        }

        if (new Date(generalOrder.deadline) <= new Date()) {
            return NextResponse.json({ error: 'תאריך ההזמנה הקבוצתית חלף' }, { status: 400 });
        }

        // Handle different actions
        if (action === 'leave') {
            // Remove user from group order
            const { error: deleteError } = await supabaseAdmin
                .from('orders')
                .delete()
                .eq('general_order_id', general_order_id)
                .eq('user_id', user.id);

            if (deleteError) {
                console.error('Error leaving group order:', deleteError);
                return NextResponse.json({ error: 'שגיאה ביציאה מההזמנה הקבוצתית' }, { status: 500 });
            }

            return NextResponse.json({ message: 'יצאת מההזמנה הקבוצתית בהצלחה' });
        }

        if (action === 'join' && items && Array.isArray(items)) {
            // Forward to participation endpoint
            const participateResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/general-orders/participate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    general_order_id,
                    items
                })
            });

            const result = await participateResponse.json();
            
            if (!participateResponse.ok) {
                return NextResponse.json(result, { status: participateResponse.status });
            }

            return NextResponse.json(result);
        }

        return NextResponse.json({ error: 'פעולה לא תקינה' }, { status: 400 });
    } catch (error) {
        console.error('Error in group order action:', error);
        return NextResponse.json({ error: 'שגיאה בפעולה על הזמנה קבוצתית' }, { status: 500 });
    }
}