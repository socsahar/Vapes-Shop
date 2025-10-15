import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OneSignalService from '@/lib/oneSignalService';

// Initialize services
const oneSignal = new OneSignalService();

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

// Notification service using real database
class NotificationService {
    static async sendNotification(data) {
        try {
            const notification = {
                title: data.title,
                body: data.body,
                icon: data.icon || '/favicon.ico',
                badge: data.badge || '/favicon.ico',
                image: data.image || null,
                url: data.url || null,
                audience: data.audience || 'all',
                user_ids: data.userIds || [],
                scheduled_at: data.scheduledAt || null,
                status: data.scheduledAt ? 'scheduled' : 'sent',
                sent_count: 0,
                delivered_count: 0,
                clicked_count: 0,
                created_by: data.createdBy
            };

            // Insert into database
            const { data: insertedNotification, error } = await supabase
                .from('push_notifications')
                .insert([notification])
                .select()
                .single();

            if (error) {
                console.error('Database error:', error);
                throw error;
            }

            // Send via OneSignal if not scheduled
            if (!data.scheduledAt) {
                try {
                    console.log('Sending notification via OneSignal:', insertedNotification);
                    const oneSignalResponse = await oneSignal.sendNotification({
                        title: insertedNotification.title,
                        body: insertedNotification.body, // Fixed: was 'message', should be 'body'
                        icon: insertedNotification.icon,
                        image: insertedNotification.image,
                        url: insertedNotification.url,
                        audience: insertedNotification.audience,
                        userIds: insertedNotification.user_ids
                    });

                    console.log('OneSignal response:', oneSignalResponse);

                    // Update database with sent count
                    if (oneSignalResponse.recipients) {
                        await supabase
                            .from('push_notifications')
                            .update({ 
                                sent_count: oneSignalResponse.recipients,
                                onesignal_id: oneSignalResponse.id 
                            })
                            .eq('id', insertedNotification.id);
                        
                        insertedNotification.sent_count = oneSignalResponse.recipients;
                    }
                } catch (pushError) {
                    console.error('OneSignal error:', pushError);
                    // Don't fail the whole request if push fails
                    // The notification is still saved in database
                }
            }

            return insertedNotification;
        } catch (error) {
            console.error('Error sending notification:', error);
            throw error;
        }
    }

    static async getAllNotifications() {
        try {
            const { data: notifications, error } = await supabase
                .from('push_notifications')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Database error:', error);
                throw error;
            }

            return notifications || [];
        } catch (error) {
            console.error('Error fetching notifications:', error);
            return [];
        }
    }

    static async getNotificationStats() {
        try {
            const { data: notifications, error } = await supabase
                .from('push_notifications')
                .select('status, sent_count, clicked_count');

            if (error) {
                console.error('Database error:', error);
                throw error;
            }

            const total = notifications?.length || 0;
            const sent = notifications?.filter(n => n.status === 'sent').length || 0;
            const scheduled = notifications?.filter(n => n.status === 'scheduled').length || 0;
            const totalSent = notifications?.reduce((sum, n) => sum + (n.sent_count || 0), 0) || 0;
            const totalClicks = notifications?.reduce((sum, n) => sum + (n.clicked_count || 0), 0) || 0;

            return {
                total,
                sent,
                scheduled,
                totalSent,
                totalClicks,
                clickRate: totalSent > 0 ? ((totalClicks / totalSent) * 100).toFixed(1) : '0'
            };
        } catch (error) {
            console.error('Error calculating stats:', error);
            return {
                total: 0,
                sent: 0,
                scheduled: 0,
                totalSent: 0,
                totalClicks: 0,
                clickRate: '0'
            };
        }
    }

    static async deleteNotification(id) {
        try {
            const { error } = await supabase
                .from('push_notifications')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('Database error:', error);
                throw error;
            }

            return true;
        } catch (error) {
            console.error('Error deleting notification:', error);
            return false;
        }
    }
}

export async function GET() {
    try {
        const notifications = await NotificationService.getAllNotifications();
        const stats = await NotificationService.getNotificationStats();
        
        return NextResponse.json({
            success: true,
            notifications,
            stats
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return NextResponse.json(
            { error: 'Failed to fetch notifications' },
            { status: 500 }
        );
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const {
            title,
            message,
            audience = 'all',
            userIds = [],
            scheduledAt = null,
            icon = null,
            image = null,
            url = null,
            createdBy = 'admin'
        } = body;

        // Validation
        if (!title || !message) {
            return NextResponse.json(
                { error: 'Title and message are required' },
                { status: 400 }
            );
        }

        if (audience === 'specific_users' && (!userIds || userIds.length === 0)) {
            return NextResponse.json(
                { error: 'User IDs are required for specific users audience' },
                { status: 400 }
            );
        }

        // Create notification
        const notification = await NotificationService.sendNotification({
            title,
            body: message,
            audience,
            userIds,
            scheduledAt,
            icon,
            image,
            url,
            createdBy
        });

        return NextResponse.json({
            success: true,
            message: scheduledAt 
                ? 'Notification scheduled successfully!'
                : 'Notification sent successfully!',
            notification
        });
        
    } catch (error) {
        console.error('Error sending notification:', error);
        return NextResponse.json(
            { error: 'Failed to send notification' },
            { status: 500 }
        );
    }
}

export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { error: 'Notification ID is required' },
                { status: 400 }
            );
        }

        const success = await NotificationService.deleteNotification(id);
        
        if (!success) {
            return NextResponse.json(
                { error: 'Notification not found or failed to delete' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Notification deleted successfully!'
        });
        
    } catch (error) {
        console.error('Error deleting notification:', error);
        return NextResponse.json(
            { error: 'Failed to delete notification' },
            { status: 500 }
        );
    }
}