import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
    try {
        const { token, newPassword } = await request.json();

        if (!token || !newPassword) {
            return NextResponse.json(
                { error: 'אסימון או סיסמה חסרים' },
                { status: 400 }
            );
        }

        if (newPassword.length < 6) {
            return NextResponse.json(
                { error: 'הסיסמה חייבת להכיל לפחות 6 תווים' },
                { status: 400 }
            );
        }

        // Validate token and get user info
        const { data: tokenData, error: tokenError } = await supabase
            .from('password_reset_tokens')
            .select('*')
            .eq('token', token)
            .eq('used', false)
            .gt('expires_at', new Date().toISOString())
            .single();

        if (tokenError || !tokenData) {
            return NextResponse.json(
                { error: 'אסימון לא תקין או פג תוקף' },
                { status: 400 }
            );
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update user password and set force_password_change to false
        const { error: updateError } = await supabase
            .from('users')
            .update({ 
                password_hash: hashedPassword,
                force_password_change: false,
                updated_at: new Date().toISOString()
            })
            .eq('id', tokenData.user_id);

        if (updateError) {
            console.error('Error updating password:', updateError);
            return NextResponse.json(
                { error: 'שגיאה בעדכון הסיסמה' },
                { status: 500 }
            );
        }

        // Mark token as used
        const { error: markUsedError } = await supabase
            .from('password_reset_tokens')
            .update({ 
                used: true,
                used_at: new Date().toISOString()
            })
            .eq('token', token);

        if (markUsedError) {
            console.error('Error marking token as used:', markUsedError);
        }

        return NextResponse.json({ 
            success: true,
            message: 'הסיסמה שונתה בהצלחה'
        });

    } catch (error) {
        console.error('Change password error:', error);
        return NextResponse.json(
            { error: 'שגיאה בשינוי הסיסמה' },
            { status: 500 }
        );
    }
}