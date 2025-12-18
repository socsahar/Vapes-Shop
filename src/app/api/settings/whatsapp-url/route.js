import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET - Fetch WhatsApp URL (public endpoint)
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
            url: data?.setting_value || 'https://chat.whatsapp.com/ElBYUnPmbqt86voJGQs9tZ' // Default fallback
        });
    } catch (error) {
        console.error('Error in GET /api/settings/whatsapp-url:', error);
        return NextResponse.json(
            { error: 'שגיאת שרת', url: 'https://chat.whatsapp.com/ElBYUnPmbqt86voJGQs9tZ' },
            { status: 500 }
        );
    }
}
