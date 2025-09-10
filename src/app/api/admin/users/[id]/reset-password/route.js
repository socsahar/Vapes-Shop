import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabase';
import bcrypt from 'bcryptjs';

export async function POST(request, { params }) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { newPassword, forceChange = true, sendEmail = false, userEmail, userName } = body;

        if (!id) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            );
        }

        if (!newPassword || newPassword.length < 6) {
            return NextResponse.json(
                { error: 'Password must be at least 6 characters long' },
                { status: 400 }
            );
        }

        // Check if user exists
        const { data: existingUser, error: userError } = await supabaseAdmin
            .from('users')
            .select('id, username, email, full_name')
            .eq('id', id)
            .single();

        if (userError || !existingUser) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Hash the new password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // Create a one-time password reset token
        const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24); // Token expires in 24 hours

        // Update user password and set force_password_change flag
        const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({
                password_hash: hashedPassword,
                force_password_change: forceChange,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (updateError) {
            console.error('Error updating password:', updateError);
            return NextResponse.json(
                { error: 'Failed to reset password' },
                { status: 500 }
            );
        }

        // Create password reset token
        const { error: tokenError } = await supabaseAdmin
            .from('password_reset_tokens')
            .insert({
                user_id: id,
                token: resetToken,
                expires_at: expiresAt.toISOString(),
                used: false // Mark as unused for the change password flow
            });

        if (tokenError) {
            console.error('Error creating reset token:', tokenError);
        }

        // Send email if requested
        if (sendEmail && userEmail) {
            try {
                const emailResponse = await fetch('/api/email/password-reset', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: userEmail,
                        userName: userName || existingUser.full_name,
                        temporaryPassword: newPassword,
                        resetToken: resetToken,
                        username: existingUser.username
                    }),
                });

                if (!emailResponse.ok) {
                    console.error('Failed to send password reset email');
                    return NextResponse.json({
                        success: true,
                        message: 'Password reset successfully but email failed to send',
                        emailSent: false,
                        user: {
                            id: existingUser.id,
                            username: existingUser.username,
                            email: existingUser.email,
                            full_name: existingUser.full_name
                        }
                    });
                }
            } catch (emailError) {
                console.error('Error sending email:', emailError);
                return NextResponse.json({
                    success: true,
                    message: 'Password reset successfully but email failed to send',
                    emailSent: false,
                    user: {
                        id: existingUser.id,
                        username: existingUser.username,
                        email: existingUser.email,
                        full_name: existingUser.full_name
                    }
                });
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Password reset successfully',
            emailSent: sendEmail,
            resetToken: resetToken,
            user: {
                id: existingUser.id,
                username: existingUser.username,
                email: existingUser.email,
                full_name: existingUser.full_name
            }
        });

    } catch (error) {
        console.error('Reset password API Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}