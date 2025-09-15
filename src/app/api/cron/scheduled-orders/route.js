import { NextResponse } from 'next/server';

export async function GET(request) {
    try {
        // Basic security: check for a secret key in query params or headers
        const secretKey = request.nextUrl.searchParams.get('key') || request.headers.get('x-cron-key');
        const expectedKey = process.env.CRON_SECRET_KEY || 'your-secret-cron-key';
        
        if (!secretKey || secretKey !== expectedKey) {
            console.log('❌ Unauthorized cron attempt:', {
                provided: secretKey ? 'PROVIDED' : 'MISSING',
                ip: request.headers.get('x-forwarded-for') || 'unknown',
                userAgent: request.headers.get('user-agent') || 'unknown'
            });
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('🤖 [CRON] Scheduled orders cron job triggered...');
        
        // Import and run the cron job
        const { default: runCronJob } = await import('../../../../cron-service.js');
        await runCronJob();
        
        return NextResponse.json({ 
            success: true, 
            message: 'Cron job executed successfully',
            timestamp: new Date().toISOString(),
            service: 'scheduled-orders-cron'
        });
        
    } catch (error) {
        console.error('❌ [CRON] Scheduled orders cron failed:', error);
        
        return NextResponse.json({ 
            success: false, 
            error: error.message,
            timestamp: new Date().toISOString(),
            service: 'scheduled-orders-cron'
        }, { status: 500 });
    }
}

// Also support POST method for compatibility
export const POST = GET;