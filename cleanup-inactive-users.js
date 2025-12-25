// Automated cleanup service for inactive users
// This script removes users who haven't logged in for 3 months
// Run this as a cron job (e.g., daily at 2 AM)

import { supabaseAdmin } from './src/lib/supabase.js';

const INACTIVE_DAYS = 90; // 3 months

async function cleanupInactiveUsers() {
    try {
        console.log('🧹 Starting inactive users cleanup...');
        console.log(`📅 Removing users inactive for more than ${INACTIVE_DAYS} days`);

        // Calculate the cutoff date (3 months ago)
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - INACTIVE_DAYS);
        const cutoffISO = cutoffDate.toISOString();

        console.log(`⏰ Cutoff date: ${cutoffDate.toLocaleDateString('he-IL')}`);

        // Find inactive users (exclude admins)
        const { data: inactiveUsers, error: fetchError } = await supabaseAdmin
            .from('users')
            .select('id, username, full_name, email, last_login, role')
            .neq('role', 'admin') // Don't delete admins
            .or(`last_login.is.null,last_login.lt.${cutoffISO}`);

        if (fetchError) {
            console.error('❌ Error fetching inactive users:', fetchError);
            return;
        }

        if (!inactiveUsers || inactiveUsers.length === 0) {
            console.log('✅ No inactive users found. All users are active!');
            return;
        }

        console.log(`\n📊 Found ${inactiveUsers.length} inactive user(s):`);
        
        const deletedUsers = [];
        const failedDeletions = [];

        for (const user of inactiveUsers) {
            try {
                const lastLoginDate = user.last_login 
                    ? new Date(user.last_login).toLocaleDateString('he-IL')
                    : 'Never';
                
                console.log(`\n🗑️  Processing: ${user.full_name} (${user.email})`);
                console.log(`   Last login: ${lastLoginDate}`);

                // Delete related records first
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

                // Keep orders but nullify user_id for historical data
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

                // Delete email queue and logs
                await supabaseAdmin
                    .from('email_queue')
                    .delete()
                    .eq('user_id', user.id);

                await supabaseAdmin
                    .from('email_logs')
                    .delete()
                    .eq('user_id', user.id);

                // Finally, delete the user
                const { error: deleteError } = await supabaseAdmin
                    .from('users')
                    .delete()
                    .eq('id', user.id);

                if (deleteError) {
                    console.error(`   ❌ Failed to delete: ${deleteError.message}`);
                    failedDeletions.push({
                        user: user.full_name,
                        email: user.email,
                        error: deleteError.message
                    });
                } else {
                    console.log(`   ✅ Successfully deleted`);
                    deletedUsers.push({
                        user: user.full_name,
                        email: user.email,
                        lastLogin: lastLoginDate
                    });
                }

            } catch (error) {
                console.error(`   ❌ Error processing user: ${error.message}`);
                failedDeletions.push({
                    user: user.full_name,
                    email: user.email,
                    error: error.message
                });
            }
        }

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📋 CLEANUP SUMMARY');
        console.log('='.repeat(60));
        console.log(`✅ Successfully deleted: ${deletedUsers.length} user(s)`);
        console.log(`❌ Failed deletions: ${failedDeletions.length} user(s)`);
        console.log(`📊 Total processed: ${inactiveUsers.length} user(s)`);
        console.log('='.repeat(60));

        if (deletedUsers.length > 0) {
            console.log('\n✅ Deleted users:');
            deletedUsers.forEach(u => {
                console.log(`   • ${u.user} (${u.email}) - Last login: ${u.lastLogin}`);
            });
        }

        if (failedDeletions.length > 0) {
            console.log('\n❌ Failed deletions:');
            failedDeletions.forEach(f => {
                console.log(`   • ${f.user} (${f.email}) - Error: ${f.error}`);
            });
        }

        console.log('\n🎉 Cleanup completed!\n');

    } catch (error) {
        console.error('❌ Fatal error during cleanup:', error);
        process.exit(1);
    }
}

// Run the cleanup
cleanupInactiveUsers()
    .then(() => {
        console.log('✨ Script finished successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('💥 Script failed:', error);
        process.exit(1);
    });
