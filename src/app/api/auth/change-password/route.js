import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

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
        const { data: tokenData, error: tokenError } = await supabaseAdmin
            .from('password_reset_tokens')
            .select('*')
            .eq('token', token)
            .eq('used', false)
            .gt('expires_at', new Date().toISOString())
            .single();

        if (tokenError || !tokenData) {
            return NextResponse.json(
                { error: 'הקישור פג תוקף' },
                { status: 400 }
            );
        }

        // Get current user to check if new password is same as old
        const { data: currentUser, error: userError } = await supabaseAdmin
            .from('users')
            .select('password')
            .eq('id', tokenData.user_id)
            .single();

        if (userError || !currentUser) {
            return NextResponse.json(
                { error: 'שגיאה בטעינת נתוני משתמש' },
                { status: 500 }
            );
        }

        // Check if new password is same as current password
        const isSamePassword = await bcrypt.compare(newPassword, currentUser.password);
        if (isSamePassword) {
            return NextResponse.json(
                { error: 'הסיסמה החדשה חייבת להיות שונה מהסיסמה הנוכחית' },
                { status: 400 }
            );
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        console.log('Hashed new password, updating user:', tokenData.user_id);

        // Update user password and set force_password_change to false
        const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({ 
                password: hashedPassword,
                force_password_change: false,
                updated_at: new Date().toISOString()
            })
            .eq('id', tokenData.user_id);

        if (updateError) {
            console.error('Error updating password:', updateError);
            console.error('Update error details:', JSON.stringify(updateError, null, 2));
            return NextResponse.json(
                { error: 'שגיאה בעדכון הסיסמה' },
                { status: 500 }
            );
        }

        console.log('Password updated successfully for user:', tokenData.user_id);

        // Mark token as used
        const { error: markUsedError } = await supabaseAdmin
            .from('password_reset_tokens')
            .update({ 
                used: true
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