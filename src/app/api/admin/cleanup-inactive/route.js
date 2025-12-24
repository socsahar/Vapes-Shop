import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';

const INACTIVE_DAYS = 90; // 3 months

export async function POST(request) {
    try {
        // Optional: Add admin authentication check here
        // const user = await verifyAdmin(request);
        // if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { dryRun = false } = await request.json().catch(() => ({}));

        // Calculate the cutoff date (3 months ago)
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - INACTIVE_DAYS);
        const cutoffISO = cutoffDate.toISOString();

        // Find inactive users (exclude admins)
        const { data: inactiveUsers, error: fetchError } = await supabaseAdmin
            .from('users')
            .select('id, username, full_name, email, last_login, role, created_at')
            .neq('role', 'admin') // Don't delete admins
            .or(`last_login.is.null,last_login.lt.${cutoffISO}`);

        if (fetchError) {
            console.error('Error fetching inactive users:', fetchError);
            return NextResponse.json(
                { error: 'Failed to fetch inactive users', details: fetchError.message },
                { status: 500 }
            );
        }

        if (!inactiveUsers || inactiveUsers.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No inactive users found',
                deleted: 0,
                users: []
            });
        }

        if (dryRun) {
            // Just return the list of users that would be deleted
            const usersList = inactiveUsers.map(user => ({
                id: user.id,
                name: user.full_name,
                email: user.email,
                username: user.username,
                lastLogin: user.last_login || 'Never',
                daysSinceLogin: user.last_login 
                    ? Math.floor((Date.now() - new Date(user.last_login).getTime()) / (1000 * 60 * 60 * 24))
                    : Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24))
            }));

            return NextResponse.json({
                success: true,
                dryRun: true,
                message: `Found ${inactiveUsers.length} inactive user(s) to delete`,
                count: inactiveUsers.length,
                users: usersList
            });
        }

        // Actually delete the users
        const deletedUsers = [];
        const failedDeletions = [];

        for (const user of inactiveUsers) {
            try {
                // Delete related records
                await supabaseAdmin
                    .from('activity_logs')
                    .delete()
                    .eq('user_id', user.id);

                await supabaseAdmin
                    .from('admin_activity_logs')
                    .delete()
                    .eq('user_id', user.id);

                await supabaseAdmin
                    .from('general_order_participants')
                    .delete()
                    .eq('user_id', user.id);

                await supabaseAdmin
                    .from('push_notifications')
                    .delete()
                    .eq('created_by', user.id);

                await supabaseAdmin
                    .from('general_orders')
                    .update({ created_by: null })
                    .eq('created_by', user.id);

                await supabaseAdmin
                    .from('whatsapp_conversations')
                    .update({ user_id: null })
                    .eq('user_id', user.id);

                await supabaseAdmin
                    .from('whatsapp_messages')
                    .update({ user_id: null })
                    .eq('user_id', user.id);

                await supabaseAdmin
                    .from('orders')
                    .update({ user_id: null })
                    .eq('user_id', user.id);

                await supabaseAdmin
                    .from('cart_items')
                    .delete()
                    .eq('user_id', user.id);

                await supabaseAdmin
                    .from('password_reset_tokens')
                    .delete()
                    .eq('user_id', user.id);

                await supabaseAdmin
                    .from('user_logs')
                    .delete()
                    .eq('user_id', user.id);

                await supabaseAdmin
                    .from('visitor_tracking')
                    .update({ user_id: null })
                    .eq('user_id', user.id);

                // Delete the user
                const { error: deleteError } = await supabaseAdmin
                    .from('users')
                    .delete()
                    .eq('id', user.id);

                if (deleteError) {
                    failedDeletions.push({
                        user: user.full_name,
                        email: user.email,
                        error: deleteError.message
                    });
                } else {
                    deletedUsers.push({
                        name: user.full_name,
                        email: user.email,
                        lastLogin: user.last_login || 'Never'
                    });
                }

            } catch (error) {
                failedDeletions.push({
                    user: user.full_name,
                    email: user.email,
                    error: error.message
                });
            }
        }

        return NextResponse.json({
            success: true,
            message: `Cleanup completed. Deleted ${deletedUsers.length} user(s)`,
            deleted: deletedUsers.length,
            failed: failedDeletions.length,
            users: deletedUsers,
            failures: failedDeletions
        });

    } catch (error) {
        console.error('Cleanup inactive users API Error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}

export async function GET(request) {
    try {
        // Optional: Add admin authentication check here
        
        const { searchParams } = new URL(request.url);
        const days = parseInt(searchParams.get('days') || '90');

        // Calculate the cutoff date
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const cutoffISO = cutoffDate.toISOString();

        // Find inactive users (exclude admins)
        const { data: inactiveUsers, error: fetchError } = await supabaseAdmin
            .from('users')
            .select('id, username, full_name, email, last_login, role, created_at')
            .neq('role', 'admin')
            .or(`last_login.is.null,last_login.lt.${cutoffISO}`);

        if (fetchError) {
            console.error('Error fetching inactive users:', fetchError);
            return NextResponse.json(
                { error: 'Failed to fetch inactive users', details: fetchError.message },
                { status: 500 }
            );
        }

        const usersList = (inactiveUsers || []).map(user => ({
            id: user.id,
            name: user.full_name,
            email: user.email,
            username: user.username,
            lastLogin: user.last_login || 'Never',
            daysSinceLogin: user.last_login 
                ? Math.floor((Date.now() - new Date(user.last_login).getTime()) / (1000 * 60 * 60 * 24))
                : Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24))
        }));

        return NextResponse.json({
            success: true,
            count: usersList.length,
            cutoffDays: days,
            cutoffDate: cutoffDate.toISOString(),
            users: usersList
        });

    } catch (error) {
        console.error('Get inactive users API Error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
