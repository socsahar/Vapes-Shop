import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
    try {
        // Check authentication
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Verify user is admin
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('role')
            .eq('id', decoded.userId)
            .single();

        if (userError || !user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        console.log('🤖 Manual cron trigger started by admin...');
        
        // Import and run the cron job
        const { default: runCronJob } = await import('../../../../../cron-service.js');
        await runCronJob();
        
        return NextResponse.json({ 
            success: true, 
            message: 'Cron job executed successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Manual cron failed:', error);
        
        return NextResponse.json({ 
            success: false, 
            error: error.message,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}