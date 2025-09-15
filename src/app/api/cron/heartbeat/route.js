import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
    try {
        // Log that the endpoint was hit
        await supabase
            .from('activity_log')
            .insert({
                type: 'cron_heartbeat',
                description: 'Cron heartbeat check - system is responsive',
                status: 'completed',
                metadata: { 
                    timestamp: new Date().toISOString(),
                    environment: process.env.NODE_ENV,
                    railway_env: process.env.RAILWAY_ENVIRONMENT || 'not-set'
                }
            });

        return NextResponse.json({ 
            status: 'ok',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV,
            message: 'Cron system is responsive'
        });
        
    } catch (error) {
        console.error('Cron heartbeat error:', error);
        
        return NextResponse.json({ 
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}

// Also allow POST for manual testing
export const POST = GET;