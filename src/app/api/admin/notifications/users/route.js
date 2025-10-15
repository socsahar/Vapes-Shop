import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with SERVICE ROLE to bypass RLS
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const role = searchParams.get('role'); // 'customer', 'admin', or null for all
        
        // Fetch real users from database
        let query = supabase
            .from('users')
            .select('id, full_name, email, phone, role')
            .order('full_name', { ascending: true });
        
        // Filter by role if specified (customer or admin)
        if (role) {
            query = query.eq('role', role);
        }
        
        const { data: users, error } = await query;
        
        if (error) {
            console.error('Database error:', error);
            return NextResponse.json(
                { error: 'Failed to fetch users from database' },
                { status: 500 }
            );
        }
        
        return NextResponse.json({
            success: true,
            users: users.map(user => ({
                id: user.id,
                name: user.full_name,
                email: user.email,
                phone: user.phone || 'N/A',
                role: user.role
            }))
        });
        
    } catch (error) {
        console.error('Error fetching users for notifications:', error);
        return NextResponse.json(
            { error: 'Failed to fetch users' },
            { status: 500 }
        );
    }
}