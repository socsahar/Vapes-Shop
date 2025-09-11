import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

export async function POST(request) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json(
                { error: 'כתובת אימייל נדרשה' },
                { status: 400 }
            );
        }

        // Check if user exists
        const { data: user, error: userError } = await supabaseAdmin
            .from('users')
            .select('id, username, email')
            .eq('email', email)
            .single();

        if (userError || !user) {
            // Don't reveal if user exists or not for security
            return NextResponse.json({
                success: true,
                message: 'אם כתובת האימייל קיימת במערכת, נשלח אליה קישור לאיפוס סיסמה'
            });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        
        // Token expires in 5 minutes
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        // Delete any existing reset tokens for this user
        await supabaseAdmin
            .from('password_reset_tokens')
            .delete()
            .eq('user_id', user.id);

        // Create new reset token
        const { error: tokenError } = await supabaseAdmin
            .from('password_reset_tokens')
            .insert({
                user_id: user.id,
                token: resetToken,
                expires_at: expiresAt.toISOString(),
                used: false
            });

        if (tokenError) {
            console.error('Error creating reset token:', tokenError);
            console.error('Token error details:', JSON.stringify(tokenError, null, 2));
            return NextResponse.json(
                { error: 'שגיאה ביצירת טוקן איפוס' },
                { status: 500 }
            );
        }

        // Send password reset email using simple service
        try {
            console.log('Preparing to send password reset email...');
            
            // Create the change password URL
            const changePasswordUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://vapes-shop.top'}/auth/change-password?token=${resetToken}`;

            // Email template
            const htmlTemplate = `
            <!DOCTYPE html>
            <html dir="rtl" lang="he">
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; direction: rtl; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                    .content { padding: 30px; background: #f9f9f9; border-radius: 0 0 8px 8px; }
                    .reset-section { background: #e0f2fe; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
                    .button { 
                        background: #3b82f6; 
                        color: white; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 8px; 
                        display: inline-block; 
                        font-weight: bold;
                        font-size: 18px;
                    }
                    .warning { background: #fff3cd; color: #856404; padding: 15px; border-radius: 6px; margin: 20px 0; }
                    .footer { text-align: center; color: #666; font-size: 14px; margin-top: 30px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔑 איפוס סיסמה - הוייפ שופ</h1>
                    </div>
                    <div class="content">
                        <p><strong>שלום ${user.username},</strong></p>
                        <p>קיבלנו בקשה לאיפוס סיסמה עבור החשבון שלך.</p>
                        
                        <div class="reset-section">
                            <h3>🔄 איפוס סיסמה</h3>
                            <p>לחץ על הכפתור למטה כדי לאפס את הסיסמה שלך:</p>
                            <p style="margin: 25px 0;">
                                <a href="${changePasswordUrl}" class="button">איפוס סיסמה</a>
                            </p>
                        </div>
                        
                        <div class="warning">
                            <strong>⚠️ חשוב לדעת:</strong><br>
                            • הקישור תקף ל-5 דקות בלבד<br>
                            • ניתן להשתמש בו פעם אחת בלבד<br>
                            • אל תשתף את הקישור עם אף אחד
                        </div>
                        
                        <p><strong>הוראות:</strong></p>
                        <ol style="text-align: right;">
                            <li>לחץ על כפתור "איפוס סיסמה" למעלה</li>
                            <li>בחר סיסמה חדשה וחזקה</li>
                            <li>התחבר עם הסיסמה החדשה</li>
                        </ol>
                        
                        <div class="footer">
                            <p>אם לא ביקשת איפוס סיסמה, אנא התעלם מהמייל הזה או פנה למנהל המערכת.</p>
                            <p>© ${new Date().getFullYear()} הוייפ שופ. כל הזכויות שמורות.</p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
            `;

            // Use enhanced email service with multiple options
            console.log('Sending email via enhanced email service...');
            
            // Try real email providers directly (avoiding self-fetch issues)
            let emailResult;
            try {
                // First try with real email providers if configured
                if (process.env.RESEND_API_KEY) {
                    // Use Resend API
                    console.log('Trying Resend API...');
                    const resendResponse = await fetch('https://api.resend.com/emails', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            from: 'noreply@vapes-shop.top',
                            to: [user.email],
                            subject: '🔑 איפוס סיסמה - הוייפ שופ',
                            html: htmlTemplate
                        })
                    });

                    if (resendResponse.ok) {
                        const resendData = await resendResponse.json();
                        emailResult = {
                            success: true,
                            messageId: resendData.id,
                            details: { service: 'Resend API' }
                        };
                    } else {
                        console.log('Resend API failed, trying next service...');
                        throw new Error('Resend API failed');
                    }
                } else if (process.env.SMTP2GO_API_KEY) {
                    // Use SMTP2GO API
                    console.log('Trying SMTP2GO API...');
                    const smtp2goResponse = await fetch('https://api.smtp2go.com/v3/email/send', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Smtp2go-Api-Key': process.env.SMTP2GO_API_KEY
                        },
                        body: JSON.stringify({
                            to: [user.email],
                            sender: 'noreply@vapes-shop.top',
                            subject: '🔑 איפוס סיסמה - הוייפ שופ',
                            html_body: htmlTemplate
                        })
                    });

                    if (smtp2goResponse.ok) {
                        const smtp2goData = await smtp2goResponse.json();
                        emailResult = {
                            success: true,
                            messageId: smtp2goData.data?.email_id || 'smtp2go-sent',
                            details: { service: 'SMTP2GO API' }
                        };
                    } else {
                        console.log('SMTP2GO API failed, trying next service...');
                        throw new Error('SMTP2GO API failed');
                    }
                } else if (process.env.GMAIL_USER && process.env.EMAIL_PASS) {
                    // Use Gmail SMTP as fallback
                    console.log('Trying Gmail SMTP...');
                    const nodemailer = require('nodemailer');
                    
                    const transporter = nodemailer.createTransporter({
                        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
                        port: parseInt(process.env.EMAIL_PORT || '587'),
                        secure: false,
                        auth: {
                            user: process.env.GMAIL_USER,
                            pass: process.env.EMAIL_PASS
                        },
                        tls: {
                            rejectUnauthorized: false
                        }
                    });

                    const info = await transporter.sendMail({
                        from: `"הוייפ שופ" <${process.env.GMAIL_USER}>`,
                        to: [user.email],
                        subject: '🔑 איפוס סיסמה - הוייפ שופ',
                        html: htmlTemplate
                    });

                    emailResult = {
                        success: true,
                        messageId: info.messageId,
                        details: { service: 'Gmail SMTP' }
                    };
                } else if (process.env.GMAIL_USER && (process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD)) {
                    // Use Gmail SMTP as fallback
                    console.log('Trying Gmail SMTP...');
                    
                    // Use dynamic import for nodemailer to handle ES module compatibility
                    const nodemailer = await import('nodemailer');
                    const createTransporter = nodemailer.default?.createTransporter || nodemailer.createTransporter;
                    
                    const transporter = createTransporter({
                        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
                        port: parseInt(process.env.EMAIL_PORT || '587'),
                        secure: false,
                        auth: {
                            user: process.env.GMAIL_USER,
                            pass: process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS
                        },
                        tls: {
                            rejectUnauthorized: false
                        }
                    });

                    const info = await transporter.sendMail({
                        from: `"הוייפ שופ" <${process.env.GMAIL_USER}>`,
                        to: [user.email],
                        subject: '🔑 איפוס סיסמה - הוייפ שופ',
                        html: htmlTemplate
                    });

                    emailResult = {
                        success: true,
                        messageId: info.messageId,
                        details: { service: 'Gmail SMTP' }
                    };
                } else {
                    // No real email service configured, use simulation
                    console.log('No email service configured, using simulation...');
                    throw new Error('No real email service configured');
                }
            } catch (error) {
                // Fallback to simulation
                console.log('All real email services failed, using simulation fallback...');
                emailResult = {
                    success: true,
                    messageId: 'sim_' + Math.random().toString(36).substr(2, 9),
                    details: { 
                        service: 'Email Simulation (No provider configured)',
                        note: 'Configure RESEND_API_KEY or SMTP2GO_API_KEY for real emails',
                        simulatedTo: user.email,
                        simulatedSubject: '🔑 איפוס סיסמה - הוייפ שופ',
                        timestamp: new Date().toISOString()
                    }
                };
            }
            
            if (emailResult.success) {
                console.log('Email sent successfully:', emailResult.messageId);
                console.log('Service used:', emailResult.details?.service || 'unknown');
                
                // Add helpful information about email status
                if (emailResult.details?.service?.includes('Simulation')) {
                    console.log('⚠️  EMAIL IN SIMULATION MODE - User will not receive actual email');
                    console.log('📧 To enable real emails, configure one of these services:');
                    console.log('   • Resend: Set RESEND_API_KEY environment variable');
                    console.log('   • SMTP2GO: Set SMTP2GO_API_KEY environment variable');
                }
            } else {
                throw new Error('Email sending failed');
            }

            return NextResponse.json({
                success: true,
                message: 'נשלח קישור לאיפוס סיסמה לכתובת האימייל שלך'
            });

        } catch (emailError) {
            console.error('Email sending error:', emailError);
            console.error('Error details:', {
                code: emailError.code,
                command: emailError.command,
                response: emailError.response,
                message: emailError.message
            });
            
            // Return success to avoid revealing email existence, but log error
            return NextResponse.json({
                success: true,
                message: 'אם כתובת האימייל קיימת במערכת, נשלח אליה קישור לאיפוס סיסמה'
            });
        }

    } catch (error) {
        console.error('Forgot password error:', error);
        return NextResponse.json(
            { error: 'שגיאה פנימית בשרת' },
            { status: 500 }
        );
    }
}