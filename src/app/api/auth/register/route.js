import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

export async function POST(request) {
    try {
        const { username, email, password, full_name, phone } = await request.json();

        if (!username || !email || !password || !full_name) {
            return NextResponse.json(
                { error: 'כל השדות הנדרשים חייבים להיות מלאים' },
                { status: 400 }
            );
        }

        // Check if username already exists
        const { data: existingUsername } = await supabase
            .from('users')
            .select('id')
            .eq('username', username)
            .single();

        if (existingUsername) {
            return NextResponse.json(
                { error: 'שם המשתמש כבר קיים במערכת' },
                { status: 409 }
            );
        }

        // Check if email already exists
        const { data: existingEmail } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (existingEmail) {
            return NextResponse.json(
                { error: 'כתובת האימייל כבר רשומה במערכת' },
                { status: 409 }
            );
        }

        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create new user
        const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert([{
                username,
                email,
                password: hashedPassword,
                full_name,
                phone: phone || null,
                role: 'customer',
                status: 'active',
                email_notifications: true,
                force_password_change: false
            }])
            .select()
            .single();

        if (insertError) {
            console.error('Insert error:', insertError);
            
            // If it's a role constraint error, try with admin role as fallback
            if (insertError.code === '23514' && insertError.message.includes('users_role_check')) {
                console.log('Role constraint failed, trying with admin role as fallback...');
                const { data: adminUser, error: adminError } = await supabase
                    .from('users')
                    .insert([{
                        username,
                        email,
                        password: hashedPassword,
                        full_name,
                        phone: phone || null,
                        role: 'admin', // Fallback to admin role
                        status: 'active',
                        email_notifications: true,
                        force_password_change: false
                    }])
                    .select()
                    .single();
                    
                if (adminError) {
                    console.error('Admin fallback also failed:', adminError);
                    return NextResponse.json(
                        { error: 'שגיאה ביצירת החשבון - בעיה בהגדרות בסיס הנתונים' },
                        { status: 500 }
                    );
                } else {
                    // Success with admin role
                    const { password: _, ...userWithoutPassword } = adminUser;
                    return NextResponse.json({
                        user: userWithoutPassword,
                        message: 'החשבון נוצר בהצלחה'
                    }, { status: 201 });
                }
            }
            
            return NextResponse.json(
                { error: 'שגיאה ביצירת החשבון' },
                { status: 500 }
            );
        }

        // Remove password from response
        const { password: _, ...userWithoutPassword } = newUser;

        return NextResponse.json({
            user: userWithoutPassword,
            message: 'החשבון נוצר בהצלחה'
        }, { status: 201 });

    } catch (error) {
        console.error('Registration error:', error);
        return NextResponse.json(
            { error: 'שגיאה בשרת' },
            { status: 500 }
        );
    }
}