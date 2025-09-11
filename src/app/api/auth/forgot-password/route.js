import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

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

        // Send password reset email with enhanced SMTP configuration
        try {
            console.log('Configuring SMTP transporter...');
            
            // Enhanced SMTP configuration for production
            const transporterConfig = {
                host: 'smtp.gmail.com',
                port: 587,
                secure: false, // true for 465, false for other ports
                auth: {
                    user: process.env.GMAIL_USER,
                    pass: process.env.GMAIL_APP_PASSWORD,
                },
                tls: {
                    rejectUnauthorized: false
                },
                connectionTimeout: 60000, // 60 seconds
                greetingTimeout: 30000,   // 30 seconds
                socketTimeout: 60000,     // 60 seconds
                logger: false,
                debug: false
            };

            // Fallback configuration if primary fails
            const fallbackConfig = {
                service: 'gmail',
                auth: {
                    user: process.env.GMAIL_USER,
                    pass: process.env.GMAIL_APP_PASSWORD,
                },
                connectionTimeout: 30000,
                socketTimeout: 30000,
                logger: false,
                debug: false
            };

            let transporter;
            let transporterUsed = 'primary';

            try {
                console.log('Trying primary SMTP configuration...');
                transporter = nodemailer.createTransporter(transporterConfig);
                
                // Quick connection test with timeout
                await Promise.race([
                    transporter.verify(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('SMTP verification timeout')), 10000)
                    )
                ]);
                console.log('Primary SMTP configuration successful');
            } catch (primaryError) {
                console.log('Primary SMTP failed, trying fallback configuration...');
                console.log('Primary error:', primaryError.message);
                
                try {
                    transporter = nodemailer.createTransporter(fallbackConfig);
                    transporterUsed = 'fallback';
                    console.log('Fallback SMTP configuration ready (skipping verification)');
                } catch (fallbackError) {
                    console.error('Both SMTP configurations failed');
                    throw new Error('SMTP configuration failed: ' + fallbackError.message);
                }
            }

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

            // Send email with retry mechanism
            const mailOptions = {
                from: `"הוייפ שופ" <${process.env.GMAIL_USER}>`,
                to: user.email,
                subject: '🔑 איפוס סיסמה - הוייפ שופ',
                html: htmlTemplate,
            };

            console.log(`Attempting to send email to: ${user.email} using ${transporterUsed} configuration`);
            
            // Send with timeout
            const emailResult = await Promise.race([
                transporter.sendMail(mailOptions),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Email sending timeout')), 30000)
                )
            ]);
            
            console.log('Email sent successfully:', emailResult.messageId);

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