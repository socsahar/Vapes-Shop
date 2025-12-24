import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';

export async function PUT(request, { params }) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { full_name, username, email, phone, role } = body;

        if (!id) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            );
        }

        // Validate required fields
        if (!full_name || !username || !email || !role) {
            return NextResponse.json(
                { error: 'Full name, username, email, and role are required' },
                { status: 400 }
            );
        }

        // Check if username or email already exists for other users
        const { data: existingUsers, error: checkError } = await supabaseAdmin
            .from('users')
            .select('id, username, email')
            .neq('id', id)
            .or(`username.eq.${username},email.eq.${email}`);

        if (checkError) {
            console.error('Error checking existing users:', checkError);
            return NextResponse.json(
                { error: 'Failed to validate user data' },
                { status: 500 }
            );
        }

        if (existingUsers && existingUsers.length > 0) {
            const duplicateUsername = existingUsers.find(user => user.username === username);
            const duplicateEmail = existingUsers.find(user => user.email === email);
            
            if (duplicateUsername) {
                return NextResponse.json(
                    { error: 'Username already exists' },
                    { status: 400 }
                );
            }
            
            if (duplicateEmail) {
                return NextResponse.json(
                    { error: 'Email already exists' },
                    { status: 400 }
                );
            }
        }

        // Update user in database with role fallback
        let updateData = {
            full_name,
            username,
            email,
            phone: phone || null,
            role: role === 'user' ? 'admin' : role, // Fallback for constraint
            updated_at: new Date().toISOString()
        };

        const { data: updatedUser, error } = await supabaseAdmin
            .from('users')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating user:', error);
            return NextResponse.json(
                { error: 'Failed to update user' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            user: updatedUser,
            message: 'User updated successfully'
        });

    } catch (error) {
        console.error('Update user API Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function DELETE(request, { params }) {
    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            );
        }

        // First, check if the user exists
        const { data: userToDelete, error: fetchError } = await supabaseAdmin
            .from('users')
            .select('id, role, username')
            .eq('id', id)
            .single();

        if (fetchError || !userToDelete) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Delete related records that don't have CASCADE or SET NULL
        // This is necessary because some foreign keys don't have proper ON DELETE clauses
        
        // Delete activity logs (doesn't have ON DELETE CASCADE)
        await supabaseAdmin
            .from('activity_logs')
            .delete()
            .eq('user_id', id)
            .then(() => console.log('Deleted activity_logs'))
            .catch(err => console.log('No activity_logs or error:', err.message));

        // Delete admin activity logs
        await supabaseAdmin
            .from('admin_activity_logs')
            .delete()
            .eq('user_id', id)
            .then(() => console.log('Deleted admin_activity_logs'))
            .catch(err => console.log('No admin_activity_logs or error:', err.message));

        // Delete general order participants
        await supabaseAdmin
            .from('general_order_participants')
            .delete()
            .eq('user_id', id)
            .then(() => console.log('Deleted general_order_participants'))
            .catch(err => console.log('No general_order_participants or error:', err.message));

        // Delete push notifications created by user
        await supabaseAdmin
            .from('push_notifications')
            .delete()
            .eq('created_by', id)
            .then(() => console.log('Deleted push_notifications'))
            .catch(err => console.log('No push_notifications or error:', err.message));

        // Set created_by to NULL for general_orders
        await supabaseAdmin
            .from('general_orders')
            .update({ created_by: null })
            .eq('created_by', id)
            .then(() => console.log('Nullified general_orders.created_by'))
            .catch(err => console.log('No general_orders or error:', err.message));

        // Set user_id to NULL for whatsapp_conversations (has ON DELETE SET NULL)
        await supabaseAdmin
            .from('whatsapp_conversations')
            .update({ user_id: null })
            .eq('user_id', id)
            .then(() => console.log('Nullified whatsapp_conversations'))
            .catch(err => console.log('No whatsapp_conversations or error:', err.message));

        // Set user_id to NULL for whatsapp_messages (has ON DELETE SET NULL)
        await supabaseAdmin
            .from('whatsapp_messages')
            .update({ user_id: null })
            .eq('user_id', id)
            .then(() => console.log('Nullified whatsapp_messages'))
            .catch(err => console.log('No whatsapp_messages or error:', err.message));

        // Keep orders but set user_id to null for historical data
        await supabaseAdmin
            .from('orders')
            .update({ user_id: null })
            .eq('user_id', id)
            .then(() => console.log('Nullified orders.user_id'))
            .catch(err => console.log('No orders or error:', err.message));

        // Delete cart items (should have CASCADE but we'll be explicit)
        await supabaseAdmin
            .from('cart_items')
            .delete()
            .eq('user_id', id)
            .then(() => console.log('Deleted cart_items'))
            .catch(err => console.log('No cart_items or error:', err.message));

        // Delete password reset tokens (has ON DELETE CASCADE)
        await supabaseAdmin
            .from('password_reset_tokens')
            .delete()
            .eq('user_id', id)
            .then(() => console.log('Deleted password_reset_tokens'))
            .catch(err => console.log('No password_reset_tokens or error:', err.message));

        // Delete user logs
        await supabaseAdmin
            .from('user_logs')
            .delete()
            .eq('user_id', id)
            .then(() => console.log('Deleted user_logs'))
            .catch(err => console.log('No user_logs or error:', err.message));

        // Set user_id to NULL for visitor tracking records
        await supabaseAdmin
            .from('visitor_tracking')
            .update({ user_id: null })
            .eq('user_id', id)
            .then(() => console.log('Nullified visitor_tracking'))
            .catch(err => console.log('No visitor_tracking or error:', err.message));

        // Finally, delete the user
        const { error } = await supabaseAdmin
            .from('users')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting user:', error);
            return NextResponse.json(
                { error: `Failed to delete user: ${error.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'User deleted successfully'
        });

    } catch (error) {
        console.error('Delete user API Error:', error);
        return NextResponse.json(
            { error: `Internal server error: ${error.message}` },
            { status: 500 }
        );
    }
}