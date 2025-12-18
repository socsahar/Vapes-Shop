import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
    try {
        const now = new Date();
        
        // Get total visits
        const { count: totalCount, error: totalError } = await supabase
            .from('visitor_tracking')
            .select('*', { count: 'exact', head: true });

        if (totalError) {
            console.error('Error fetching total visits:', totalError);
        }

        // Get today's visits (UTC)
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const { count: todayCount, error: todayError } = await supabase
            .from('visitor_tracking')
            .select('*', { count: 'exact', head: true })
            .gte('visited_at', todayStart.toISOString());

        if (todayError) {
            console.error('Error fetching today visits:', todayError);
        }

        // Get this week's visits (last 7 days)
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const { count: weekCount, error: weekError } = await supabase
            .from('visitor_tracking')
            .select('*', { count: 'exact', head: true })
            .gte('visited_at', weekAgo.toISOString());

        if (weekError) {
            console.error('Error fetching week visits:', weekError);
        }

        // Get this month's visits
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const { count: monthCount, error: monthError } = await supabase
            .from('visitor_tracking')
            .select('*', { count: 'exact', head: true })
            .gte('visited_at', monthStart.toISOString());

        if (monthError) {
            console.error('Error fetching month visits:', monthError);
        }

        return NextResponse.json({
            total: totalCount || 0,
            today: todayCount || 0,
            thisWeek: weekCount || 0,
            thisMonth: monthCount || 0
        });
    } catch (error) {
        console.error('Error in GET /api/admin/visitor-stats:', error);
        return NextResponse.json(
            { 
                error: 'שגיאת שרת',
                total: 0,
                today: 0,
                thisWeek: 0,
                thisMonth: 0
            },
            { status: 500 }
        );
    }
}
