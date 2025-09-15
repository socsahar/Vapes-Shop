import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Configure SSL bypass for Node.js environment
if (typeof window === 'undefined' && typeof process !== 'undefined') {
    // Only for local development - never in production or Railway
    if (process.env.NODE_ENV === 'development' && !process.env.RAILWAY_ENVIRONMENT) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

export async function POST(request) {
    try {
        const { username, password } = await request.json();

        if (!username || !password) {
            return NextResponse.json(
                { error: 'שם משתמש וסיסמה נדרשים' },
                { status: 400 }
            );
        }

        // Find user by username
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .eq('status', 'active')
            .single();

        if (userError || !user) {
            return NextResponse.json(
                { error: 'שם משתמש או סיסמה שגויים' },
                { status: 401 }
            );
        }

        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            return NextResponse.json(
                { error: 'שם משתמש או סיסמה שגויים' },
                { status: 401 }
            );
        }

        // Update last login
        await supabase
            .from('users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', user.id);

        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;

        return NextResponse.json({
            user: userWithoutPassword,
            message: 'התחברת בהצלחה'
        });

    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'שגיאה בשרת' },
            { status: 500 }
        );
    }
}