import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
    try {
        const { token } = await request.json();

        if (!token) {
            return NextResponse.json(
                { error: 'אסימון חסר', valid: false },
                { status: 400 }
            );
        }

        // Check if token exists and is not expired
        const { data: tokenData, error: tokenError } = await supabase
            .from('password_reset_tokens')
            .select('*')
            .eq('token', token)
            .eq('used', false)
            .gt('expires_at', new Date().toISOString())
            .single();

        if (tokenError || !tokenData) {
            return NextResponse.json(
                { error: 'אסימון לא תקין או פג תוקף', valid: false },
                { status: 400 }
            );
        }

        return NextResponse.json({ 
            valid: true,
            message: 'אסימון תקין'
        });

    } catch (error) {
        console.error('Token validation error:', error);
        return NextResponse.json(
            { error: 'שגיאה בבדיקת האסימון', valid: false },
            { status: 500 }
        );
    }
}