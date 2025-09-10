import { NextResponse } from 'next/server';
import { supabaseAdmin, getCurrentUserFromRequest } from '../../../lib/supabase';

// POST /api/test-order-email - Test order confirmation email
export async function POST(request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'נדרשת התחברות' }, { status: 401 });
        }

        const { orderId, generalOrderId } = await request.json();

        if (!orderId || !generalOrderId) {
            return NextResponse.json({ error: 'נדרש מזהה הזמנה' }, { status: 400 });
        }

        // Queue test order confirmation email
        const { error: emailError } = await supabaseAdmin
            .from('email_logs')
            .insert([{
                recipient_email: user.email,
                subject: 'בדיקת אישור הזמנה',
                body: `USER_ORDER_CONFIRMATION:${orderId}:${generalOrderId}`,
                status: 'failed' // Use 'failed' as queue status
            }]);

        if (emailError) {
            console.error('Error queueing test email:', emailError);
            return NextResponse.json({ error: 'שגיאה בשליחת אימייל בדיקה' }, { status: 500 });
        }

        // Trigger email processing
        try {
            const emailProcessResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/admin/email-service`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (emailProcessResponse.ok) {
                return NextResponse.json({ 
                    success: true, 
                    message: 'אימייל אישור הזמנה נשלח בהצלחה',
                    email: user.email 
                });
            } else {
                return NextResponse.json({ error: 'שגיאה בעיבוד אימייל' }, { status: 500 });
            }
        } catch (processError) {
            console.error('Error triggering email processing:', processError);
            return NextResponse.json({ error: 'שגיאה בשליחת אימייל' }, { status: 500 });
        }

    } catch (error) {
        console.error('Error in test order email:', error);
        return NextResponse.json({ error: 'שגיאה בבדיקת אימייל הזמנה' }, { status: 500 });
    }
}