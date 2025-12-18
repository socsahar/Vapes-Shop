import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET - Fetch WhatsApp URL
export async function GET(request) {
    try {
        // Fetch the WhatsApp URL from system_settings
        const { data, error } = await supabase
            .from('system_settings')
            .select('setting_value')
            .eq('setting_key', 'whatsapp_group_url')
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = not found
            console.error('Error fetching WhatsApp URL:', error);
            return NextResponse.json(
                { error: 'שגיאה בשליפת הקישור' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            url: data?.setting_value || ''
        });
    } catch (error) {
        console.error('Error in GET /api/admin/settings/whatsapp-url:', error);
        return NextResponse.json(
            { error: 'שגיאת שרת' },
            { status: 500 }
        );
    }
}

// POST - Update WhatsApp URL
export async function POST(request) {
    try {
        const body = await request.json();
        const { url } = body;

        if (!url || typeof url !== 'string') {
            return NextResponse.json(
                { error: 'יש להזין קישור תקין' },
                { status: 400 }
            );
        }

        // Validate URL format
        if (url && !url.startsWith('https://chat.whatsapp.com/')) {
            return NextResponse.json(
                { error: 'הקישור חייב להתחיל ב-https://chat.whatsapp.com/' },
                { status: 400 }
            );
        }

        // Check if setting exists
        const { data: existing } = await supabase
            .from('system_settings')
            .select('id')
            .eq('setting_key', 'whatsapp_group_url')
            .single();

        if (existing) {
            // Update existing setting
            const { error } = await supabase
                .from('system_settings')
                .update({
                    setting_value: url,
                    updated_at: new Date().toISOString()
                })
                .eq('setting_key', 'whatsapp_group_url');

            if (error) {
                console.error('Error updating WhatsApp URL:', error);
                return NextResponse.json(
                    { error: 'שגיאה בעדכון הקישור' },
                    { status: 500 }
                );
            }
        } else {
            // Insert new setting
            const { error } = await supabase
                .from('system_settings')
                .insert({
                    setting_key: 'whatsapp_group_url',
                    setting_value: url,
                    description: 'WhatsApp group URL for order pickup updates'
                });

            if (error) {
                console.error('Error inserting WhatsApp URL:', error);
                return NextResponse.json(
                    { error: 'שגיאה בשמירת הקישור' },
                    { status: 500 }
                );
            }
        }

        return NextResponse.json({
            success: true,
            message: 'קישור WhatsApp עודכן בהצלחה'
        });
    } catch (error) {
        console.error('Error in POST /api/admin/settings/whatsapp-url:', error);
        return NextResponse.json(
            { error: 'שגיאת שרת' },
            { status: 500 }
        );
    }
}
