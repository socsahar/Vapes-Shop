import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
    try {
        const body = await request.json();
        const { sessionId, pageUrl, referrer } = body;

        // Get IP address from various headers (for production with proxies/load balancers)
        const forwardedFor = request.headers.get('x-forwarded-for');
        const realIp = request.headers.get('x-real-ip');
        const cfConnectingIp = request.headers.get('cf-connecting-ip'); // Cloudflare
        const trueClientIp = request.headers.get('true-client-ip'); // Cloudflare Enterprise
        const xClientIp = request.headers.get('x-client-ip');
        
        // Get the first IP from x-forwarded-for (most reliable)
        let visitorIp = forwardedFor?.split(',')[0]?.trim() 
            || cfConnectingIp 
            || trueClientIp 
            || xClientIp 
            || realIp 
            || 'unknown';

        // Handle localhost addresses - convert to a more readable format
        if (visitorIp === '::1' || visitorIp === '::ffff:127.0.0.1' || visitorIp === '127.0.0.1') {
            visitorIp = 'localhost';
        }

        // Get user agent
        const userAgent = request.headers.get('user-agent') || 'unknown';

        // Insert visitor tracking record
        const { error } = await supabase
            .from('visitor_tracking')
            .insert({
                visitor_ip: visitorIp === 'unknown' ? null : visitorIp,
                user_agent: userAgent,
                page_url: pageUrl || '/',
                referrer: referrer || null,
                session_id: sessionId,
                visited_at: new Date().toISOString()
            });

        if (error) {
            console.error('Error tracking visitor:', error);
            return NextResponse.json(
                { error: 'Failed to track visitor' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error in POST /api/track-visit:', error);
        return NextResponse.json(
            { error: 'Server error' },
            { status: 500 }
        );
    }
}
