import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role client for system monitoring data
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

export async function GET(request) {
    try {
        // Get cron job status information
        const cronStatus = await getCronJobStatus();
        
        // Get email status information  
        const emailStatus = await getEmailStatus();

        return NextResponse.json({
            success: true,
            status: {
                cronJobs: cronStatus,
                emails: emailStatus,
                lastUpdate: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error fetching system status:', error);
        return NextResponse.json(
            { error: 'שגיאה בטעינת סטטוס המערכת' },
            { status: 500 }
        );
    }
}

async function getCronJobStatus() {
    try {
        // Get real cron job status from cron_jobs table
        const { data: cronJobs, error: cronError } = await supabase
            .from('cron_jobs')
            .select('*')
            .order('last_run', { ascending: false });

        if (cronError) {
            console.error('Error fetching cron jobs:', cronError);
            return getDefaultCronStatus();
        }

        // Get recent activity for detailed information
        const { data: recentActivity, error: activityError } = await supabase
            .from('activity_log')
            .select('*')
            .like('type', 'cron_%')
            .order('created_at', { ascending: false })
            .limit(50);

        if (activityError) {
            console.error('Error fetching activity:', activityError);
        }

        // Get general orders for context
        const { data: generalOrders, error: ordersError } = await supabase
            .from('general_orders')
            .select('id, title, status, opening_time, deadline, created_at')
            .order('created_at', { ascending: false })
            .limit(20);

        if (ordersError) {
            console.error('Error fetching general orders:', ordersError);
        }

        // Build status object from real data
        const cronJobsMap = {};
        cronJobs?.forEach(job => {
            cronJobsMap[job.job_name] = job;
        });

        return {
            autoOrderOpening: buildCronStatus(
                cronJobsMap['auto_open_orders'],
                recentActivity?.filter(a => a.type === 'cron_auto_open_orders') || [],
                'פתיחת הזמנות אוטומטית',
                getNextScheduledOrders(generalOrders)
            ),
            autoOrderClosing: buildCronStatus(
                cronJobsMap['auto_close_orders'],
                recentActivity?.filter(a => a.type === 'cron_auto_close_orders') || [],
                'סגירת הזמנות אוטומטית',
                getExpiredOrders(generalOrders)
            ),
            reminderEmails: buildCronStatus(
                cronJobsMap['send_reminder_emails'],
                recentActivity?.filter(a => a.type === 'cron_send_reminder_emails') || [],
                'אימיילי תזכורת'
            ),
            emailQueue: buildCronStatus(
                cronJobsMap['process_email_queue'],
                recentActivity?.filter(a => a.type === 'cron_process_email_queue') || [],
                'תור אימיילים'
            )
        };

    } catch (error) {
        console.error('Error getting cron status:', error);
        return getDefaultCronStatus();
    }
}

async function getEmailStatus() {
    try {
        // Get real email status from email_queue table
        const { data: emailQueue, error: queueError } = await supabase
            .from('email_queue')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (queueError) {
            console.error('Error fetching email queue:', queueError);
            return getDefaultEmailStatus();
        }

        // Calculate statistics from real data
        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const recent24h = emailQueue?.filter(e => new Date(e.created_at) > last24h) || [];
        const recent7d = emailQueue?.filter(e => new Date(e.created_at) > last7d) || [];

        return {
            summary: {
                totalSent24h: recent24h.filter(e => e.status === 'sent').length,
                totalFailed24h: recent24h.filter(e => e.status === 'failed').length,
                totalDelivered24h: recent24h.filter(e => e.status === 'delivered').length,
                totalSent7d: recent7d.filter(e => e.status === 'sent').length
            },
            recentEmails: emailQueue?.slice(0, 15).map(email => ({
                id: email.id,
                type: getEmailTypeDisplay(email.email_type),
                status: getEmailStatusDisplay(email.status),
                recipient: email.recipient_name || email.recipient_email,
                timestamp: email.created_at,
                description: `${email.subject} - ${email.recipient_email}`,
                attempts: email.attempts,
                lastAttempt: email.last_attempt_at
            })) || [],
            queue: {
                pending: emailQueue?.filter(e => e.status === 'pending').length || 0,
                processing: emailQueue?.filter(e => e.status === 'sending').length || 0,
                failed: emailQueue?.filter(e => e.status === 'failed' && e.attempts >= e.max_attempts).length || 0
            }
        };

    } catch (error) {
        console.error('Error getting email status:', error);
        return getDefaultEmailStatus();
    }
}

function buildCronStatus(cronJob, activities, displayName, extraData = null) {
    if (!cronJob) {
        return {
            status: 'unknown',
            displayName,
            error: 'לא נמצא מידע על המשימה',
            lastRun: null,
            totalProcessed: 0
        };
    }

    // Determine status based on actual database fields
    const status = cronJob.status === 'success' ? 'active' : 
                  cronJob.status === 'failed' ? 'error' : 
                  cronJob.status === 'running' ? 'active' :
                  cronJob.status === 'idle' ? 'inactive' : 'unknown';

    return {
        status,
        displayName,
        lastRun: cronJob.last_run,
        lastRunStatus: cronJob.status,
        totalRuns: cronJob.run_count || 0,
        successfulRuns: cronJob.success_count || 0,
        failedRuns: cronJob.failure_count || 0,
        lastRunDuration: cronJob.duration_ms,
        errorMessage: cronJob.last_error,
        totalProcessed: activities.length,
        recentActivities: activities.slice(0, 5),
        extraData
    };
}

function getDefaultCronStatus() {
    return {
        autoOrderOpening: { status: 'unknown', error: 'לא ניתן לטעון נתונים' },
        autoOrderClosing: { status: 'unknown', error: 'לא ניתן לטעון נתונים' },
        reminderEmails: { status: 'unknown', error: 'לא ניתן לטעון נתונים' },
        emailQueue: { status: 'unknown', error: 'לא ניתן לטעון נתונים' }
    };
}

function getDefaultEmailStatus() {
    return {
        summary: { totalSent24h: 0, totalFailed24h: 0, totalDelivered24h: 0, totalSent7d: 0 },
        recentEmails: [],
        queue: { pending: 0, processing: 0, failed: 0 }
    };
}

function getNextScheduledOrders(orders) {
    if (!orders) return [];
    
    const now = new Date();
    return orders
        .filter(order => order.opening_time && new Date(order.opening_time) > now)
        .slice(0, 3)
        .map(order => ({
            id: order.id,
            title: order.title,
            scheduledFor: order.opening_time
        }));
}

function getExpiredOrders(orders) {
    if (!orders) return [];
    
    const now = new Date();
    return orders
        .filter(order => order.status === 'open' && new Date(order.deadline) < now)
        .slice(0, 3)
        .map(order => ({
            id: order.id,
            title: order.title,
            expiredAt: order.deadline
        }));
}

function getEmailTypeDisplay(emailType) {
    const typeMap = {
        'password_reset': 'איפוס סיסמה',
        'order_confirmation': 'אישור הזמנה', 
        'reminder': 'תזכורת',
        'summary': 'דוח סיכום',
        'welcome': 'ברוכים הבאים',
        'general_order_open': 'פתיחת הזמנה קבוצתית',
        'general_order_close': 'סגירת הזמנה קבוצתית'
    };
    
    return typeMap[emailType] || emailType || 'אימייל כללי';
}

function getEmailStatusDisplay(status) {
    const statusMap = {
        'pending': 'ממתין',
        'sending': 'נשלח כעת',
        'sent': 'נשלח',
        'delivered': 'נמסר',
        'failed': 'נכשל',
        'bounced': 'הוחזר'
    };
    
    return statusMap[status] || status || 'לא ידוע';
}