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
        console.log(`Starting deletion of related records for user ${id}...`);
        
        const cleanupOperations = [
            { name: 'activity_logs', type: 'delete', field: 'user_id' },
            { name: 'admin_activity_logs', type: 'delete', field: 'user_id' },
            { name: 'general_order_participants', type: 'delete', field: 'user_id' },
            { name: 'push_notifications', type: 'delete', field: 'created_by' },
            { name: 'general_orders', type: 'nullify', field: 'created_by' },
            { name: 'whatsapp_conversations', type: 'nullify', field: 'user_id' },
            { name: 'whatsapp_messages', type: 'nullify', field: 'user_id' },
            { name: 'orders', type: 'nullify', field: 'user_id' },
            { name: 'cart_items', type: 'delete', field: 'user_id' },
            { name: 'password_reset_tokens', type: 'delete', field: 'user_id' },
            { name: 'user_logs', type: 'delete', field: 'user_id' },
            { name: 'visitor_tracking', type: 'nullify', field: 'user_id' },
            { name: 'email_queue', type: 'delete', field: 'user_id' },
            { name: 'email_logs', type: 'delete', field: 'user_id' }
        ];

        for (const operation of cleanupOperations) {
            try {
                if (operation.type === 'delete') {
                    const { error } = await supabaseAdmin
                        .from(operation.name)
                        .delete()
                        .eq(operation.field, id);
                    
                    if (error) {
                        console.log(`⚠️ ${operation.name}: ${error.message}`);
                    } else {
                        console.log(`✅ ${operation.name}: deleted`);
                    }
                } else {
                    const { error } = await supabaseAdmin
                        .from(operation.name)
                        .update({ [operation.field]: null })
                        .eq(operation.field, id);
                    
                    if (error) {
                        console.log(`⚠️ ${operation.name}: ${error.message}`);
                    } else {
                        console.log(`✅ ${operation.name}: nullified`);
                    }
                }
            } catch (err) {
                console.log(`⚠️ ${operation.name}: ${err.message}`);
                // Continue with other operations even if one fails
            }
        }

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