import { NextResponse } from 'next/server';
import { supabaseAdmin, getCurrentUserFromRequest } from '../../../../lib/supabase';
import { processQueuedEmails } from '../../../../lib/emailProcessor';

// POST /api/general-orders/participate - Join a general order with items
export async function POST(request) {
    try {
        // Get current user from JWT token
        let user = await getCurrentUserFromRequest(request);
        
        // Fallback authentication for development
        if (!user) {
            const userId = request.headers.get('x-user-id');
            const userToken = request.headers.get('x-user-token');
            
            console.log('[PARTICIPATE] Trying fallback auth for:', userId);
            
            // Check if this is a fallback authentication
            if (userId === '00000000-0000-0000-0000-000000000001' && userToken) {
                const expectedFallbackToken = Buffer.from(userId + 'admin').toString('base64');
                if (userToken === expectedFallbackToken) {
                    console.log('[PARTICIPATE] Using fallback admin user - fetching real data');
                    
                    // Fetch real admin user data from database
                    const { data: realUser, error: userError } = await supabaseAdmin
                        .from('users')
                        .select('*')
                        .eq('id', '6f4378f6-9194-4093-93cd-12d972ffc0dd')
                        .single();
                    
                    if (realUser && !userError) {
                        const { password: _, ...userWithoutPassword } = realUser;
                        user = userWithoutPassword;
                        console.log('[PARTICIPATE] Using real admin user:', user.username, 'Email:', user.email);
                    } else {
                        console.error('[PARTICIPATE] Failed to fetch real admin user:', userError);
                    }
                }
            }
        }
        
        if (!user) {
            console.log('[PARTICIPATE] No valid authentication found');
            return NextResponse.json({ error: 'נדרשת התחברות' }, { status: 401 });
        }
        
        console.log('[PARTICIPATE] Authenticated user:', user.username);

        const body = await request.json();
        const { general_order_id, items } = body;

        if (!general_order_id || !items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: 'פרטי ההזמנה לא תקינים' }, { status: 400 });
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

        // Check if order is open
        if (generalOrder.status !== 'open') {
            return NextResponse.json({ error: 'הזמנה קבוצתית לא פתוחה להשתתפות' }, { status: 400 });
        }

        // Check if deadline has passed
        if (new Date(generalOrder.deadline) <= new Date()) {
            return NextResponse.json({ error: 'תאריך ההזמנה הקבוצתית חלף' }, { status: 400 });
        }

        // Validate items and get product details
        const productIds = items.map(item => item.product_id);
        const { data: products, error: productsError } = await supabaseAdmin
            .from('products')
            .select('*')
            .in('id', productIds);

        if (productsError) {
            console.error('Database error:', productsError);
            return NextResponse.json({ error: 'שגיאה בטעינת מוצרים' }, { status: 500 });
        }

        // Validate all products exist
        const productMap = {};
        products.forEach(product => {
            productMap[product.id] = product;
        });

        for (const item of items) {
            if (!productMap[item.product_id]) {
                return NextResponse.json({ error: `מוצר לא נמצא: ${item.product_id}` }, { status: 400 });
            }
            if (!item.quantity || item.quantity < 1) {
                return NextResponse.json({ error: 'כמות לא תקינה' }, { status: 400 });
            }
        }

        // Create individual order for this user in the general order
        const totalAmount = items.reduce((sum, item) => {
            const product = productMap[item.product_id];
            return sum + (product.price * item.quantity);
        }, 0);

        // First, check if user already has an order for this general order
        const { data: existingOrder, error: existingOrderError } = await supabaseAdmin
            .from('orders')
            .select('id')
            .eq('user_id', user.id)
            .eq('general_order_id', general_order_id)
            .single();

        let orderId;
        
        if (existingOrder && !existingOrderError) {
            // Update existing order
            orderId = existingOrder.id;
            
            // Remove existing order items
            const { error: deleteItemsError } = await supabaseAdmin
                .from('order_items')
                .delete()
                .eq('order_id', orderId);

            if (deleteItemsError) {
                console.error('Error removing existing order items:', deleteItemsError);
                return NextResponse.json({ error: 'שגיאה בעדכון השתתפות' }, { status: 500 });
            }

            // Update order total
            const { error: updateOrderError } = await supabaseAdmin
                .from('orders')
                .update({ 
                    total_amount: totalAmount,
                    updated_at: new Date().toISOString()
                })
                .eq('id', orderId);

            if (updateOrderError) {
                console.error('Error updating order:', updateOrderError);
                return NextResponse.json({ error: 'שגיאה בעדכון הזמנה' }, { status: 500 });
            }
        } else {
            // Create new order for this user in the general order
            // Use 'pending' status which is appropriate for orders awaiting group completion
            console.log('Creating order with data:', {
                user_id: user.id,
                general_order_id: general_order_id,
                total_amount: totalAmount
            });
            
            const { data: newOrder, error: orderError } = await supabaseAdmin
                .from('orders')
                .insert({
                    user_id: user.id,
                    general_order_id: general_order_id,
                    total_amount: totalAmount,
                    status: 'open'  // Try open status
                })
                .select()
                .single();

            if (orderError) {
                console.error('Error creating order:', orderError);
                return NextResponse.json({ error: 'שגיאה ביצירת הזמנה' }, { status: 500 });
            }

            orderId = newOrder.id;
            console.log('✅ Order created successfully with pending status');
        }

        // Create order items with price column
        console.log('Creating order items with price column...');
        const orderItems = items.map(item => {
            const product = productMap[item.product_id];
            const unitPrice = product.price;
            const totalPrice = unitPrice * item.quantity;
            
            console.log(`Item: ${product.name}, Quantity: ${item.quantity}, Unit Price: ${unitPrice}, Total: ${totalPrice}`);
            
            return {
                order_id: orderId,
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: unitPrice,
                total_price: totalPrice
            };
        });

        const { data: createdItems, error: insertError } = await supabaseAdmin
            .from('order_items')
            .insert(orderItems)
            .select(`
                *,
                products (
                    name,
                    description,
                    image_url,
                    price
                )
            `);

        if (insertError) {
            console.error('Database error:', insertError);
            return NextResponse.json({ error: 'שגיאה בהוספת פריטים להזמנה' }, { status: 500 });
        }

        // Calculate total for this participation
        const total_amount = createdItems.reduce((sum, item) => {
            return sum + (item.unit_price * item.quantity);
        }, 0);

        // Queue order confirmation email
        try {
            // First, check if there's a corresponding participant entry
            const { data: participant, error: participantError } = await supabaseAdmin
                .from('general_order_participants')
                .select('id')
                .eq('user_id', user.id)
                .eq('general_order_id', general_order_id)
                .single();

            let emailBody;
            if (participant && !participantError) {
                // Use new format with participant ID
                emailBody = `USER_ORDER_CONFIRMATION:${participant.id}:${general_order_id}`;
            } else {
                // Use old format as fallback
                emailBody = `USER_ORDER_CONFIRMATION:${orderId}:${general_order_id}`;
            }

            const { error: emailError } = await supabaseAdmin
                .from('email_logs')
                .insert([{
                    recipient_email: user.email,
                    subject: `אישור הזמנה - ${generalOrder.title}`,
                    body: emailBody,
                    status: 'failed' // Use 'failed' as queue status, will be changed to 'sent' when processed
                }]);

            if (emailError) {
                console.error('Error queueing order confirmation email:', emailError);
            } else {
                console.log('Order confirmation email queued successfully');
                
                // Process queued emails directly (non-blocking)
                setTimeout(async () => {
                    try {
                        const result = await processQueuedEmails();
                        // Email processing handled silently
                    } catch (error) {
                        // Email processing errors are non-blocking
                    }
                }, 1000); // Wait 1 second before processing
            }
        } catch (emailQueueError) {
            console.error('Error in email queue system:', emailQueueError);
        }

        return NextResponse.json({
            message: 'השתתפות בהזמנה קבוצתית נוספה בהצלחה',
            items: createdItems,
            total_amount
        }, { status: 201 });
    } catch (error) {
        console.error('Error participating in general order:', error);
        return NextResponse.json({ error: 'שגיאה בהשתתפות בהזמנה קבוצתית' }, { status: 500 });
    }
}

// GET /api/general-orders/participate - Check user participation status
export async function GET(request) {
    try {
        // Get current user from JWT token
        let user = await getCurrentUserFromRequest(request);
        
        // Fallback authentication for development
        if (!user) {
            const userId = request.headers.get('x-user-id');
            const userToken = request.headers.get('x-user-token');
            
            console.log('[PARTICIPATE GET] Trying fallback auth for:', userId);
            
            // Check if this is a fallback authentication
            if (userId === '00000000-0000-0000-0000-000000000001' && userToken) {
                const expectedFallbackToken = Buffer.from(userId + 'admin').toString('base64');
                if (userToken === expectedFallbackToken) {
                    console.log('[PARTICIPATE GET] Using fallback admin user - fetching real data');
                    
                    // Fetch real admin user data from database
                    const { data: realUser, error: userError } = await supabaseAdmin
                        .from('users')
                        .select('*')
                        .eq('id', '6f4378f6-9194-4093-93cd-12d972ffc0dd')
                        .single();
                    
                    if (realUser && !userError) {
                        const { password: _, ...userWithoutPassword } = realUser;
                        user = userWithoutPassword;
                        console.log('[PARTICIPATE GET] Using real admin user:', user.username, 'Email:', user.email);
                    } else {
                        console.error('[PARTICIPATE GET] Failed to fetch real admin user:', userError);
                    }
                }
            }
        }
        
        if (!user) {
            console.log('[PARTICIPATE GET] No valid authentication found');
            return NextResponse.json({ error: 'נדרשת התחברות' }, { status: 401 });
        }
        
        console.log('[PARTICIPATE GET] Authenticated user:', user.username);

        const { searchParams } = new URL(request.url);
        const general_order_id = searchParams.get('general_order_id');

        if (!general_order_id) {
            return NextResponse.json({ error: 'מזהה הזמנה קבוצתית נדרש' }, { status: 400 });
        }

        // Get user's participation in this general order
        const { data: userOrder, error } = await supabaseAdmin
            .from('orders')
            .select(`
                id,
                total_amount,
                status,
                created_at,
                order_items (
                    id,
                    product_id,
                    quantity,
                    unit_price,
                    total_price,
                    products (
                        name,
                        description,
                        image_url,
                        price
                    )
                )
            `)
            .eq('general_order_id', general_order_id)
            .eq('user_id', user.id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // No participation found
                return NextResponse.json({
                    participating: false,
                    items: [],
                    total_amount: 0,
                    total_items: 0
                });
            }
            console.error('Database error:', error);
            return NextResponse.json({ error: 'שגיאה בטעינת השתתפות' }, { status: 500 });
        }

        const total_amount = userOrder.total_amount || 0;
        const total_items = userOrder.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

        return NextResponse.json({
            participating: true,
            items: userOrder.order_items,
            total_amount,
            total_items
        });
    } catch (error) {
        console.error('Error checking participation:', error);
        return NextResponse.json({ error: 'שגיאה בבדיקת השתתפות' }, { status: 500 });
    }
}