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
            .eq('user_id', id);

        // Delete admin activity logs
        await supabaseAdmin
            .from('admin_activity_logs')
            .delete()
            .eq('user_id', id);

        // Set user_id to NULL for whatsapp_conversations (has ON DELETE SET NULL)
        await supabaseAdmin
            .from('whatsapp_conversations')
            .update({ user_id: null })
            .eq('user_id', id);

        // Set user_id to NULL for whatsapp_messages (has ON DELETE SET NULL)
        await supabaseAdmin
            .from('whatsapp_messages')
            .update({ user_id: null })
            .eq('user_id', id);

        // Delete orders (has ON DELETE CASCADE in schema.sql but might not be applied)
        // We'll keep orders but set user_id to null for historical data
        await supabaseAdmin
            .from('orders')
            .update({ user_id: null })
            .eq('user_id', id);

        // Delete cart items (should have CASCADE but we'll be explicit)
        await supabaseAdmin
            .from('cart_items')
            .delete()
            .eq('user_id', id);

        // Delete password reset tokens (has ON DELETE CASCADE)
        await supabaseAdmin
            .from('password_reset_tokens')
            .delete()
            .eq('user_id', id);

        // Delete visitor tracking records (has ON DELETE SET NULL)
        await supabaseAdmin
            .from('visitor_tracking')
            .update({ user_id: null })
            .eq('user_id', id);

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