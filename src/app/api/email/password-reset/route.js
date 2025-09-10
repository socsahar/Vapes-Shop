import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request) {
    try {
        const { email, userName, temporaryPassword, resetToken, username } = await request.json();

        if (!email || !temporaryPassword) {
            return NextResponse.json(
                { error: 'Email and temporary password are required' },
                { status: 400 }
            );
        }

        // Configure email transporter (you'll need to set up your email credentials)
        const transporter = nodemailer.createTransporter({
            service: 'gmail', // or your email service
            auth: {
                user: process.env.GMAIL_USER, // Your email
                pass: process.env.GMAIL_APP_PASSWORD, // Your email password or app password
            },
        });

        // Create the change password URL
        const changePasswordUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/auth/change-password?token=${resetToken}`;

        // Email template in Hebrew
        const htmlTemplate = `
        <!DOCTYPE html>
        <html dir="rtl" lang="he">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>איפוס סיסמה - הוייפ שופ</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    direction: rtl;
                    text-align: right;
                    background-color: #f8fafc;
                    margin: 0;
                    padding: 20px;
                }
                .container {
                    max-width: 600px;
                    margin: 0 auto;
                    background: white;
                    border-radius: 16px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    overflow: hidden;
                }
                .header {
                    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
                    padding: 30px 20px;
                    text-align: center;
                    color: white;
                }
                .header h1 {
                    margin: 0;
                    font-size: 24px;
                    font-weight: bold;
                }
                .content {
                    padding: 30px 20px;
                }
                .password-box {
                    background: rgba(245, 158, 11, 0.1);
                    border: 2px solid rgba(245, 158, 11, 0.3);
                    border-radius: 12px;
                    padding: 20px;
                    margin: 20px 0;
                    text-align: center;
                }
                .password {
                    font-family: 'Courier New', monospace;
                    font-size: 24px;
                    font-weight: bold;
                    color: #92400e;
                    background: white;
                    padding: 15px;
                    border-radius: 8px;
                    border: 1px solid rgba(245, 158, 11, 0.3);
                    letter-spacing: 2px;
                    margin: 10px 0;
                }
                .button {
                    display: inline-block;
                    background: linear-gradient(135deg, #3b82f6, #2563eb);
                    color: white;
                    text-decoration: none;
                    padding: 15px 30px;
                    border-radius: 10px;
                    font-weight: bold;
                    margin: 20px 0;
                    transition: all 0.3s ease;
                }
                .button:hover {
                    background: linear-gradient(135deg, #2563eb, #1d4ed8);
                }
                .warning {
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    border-radius: 8px;
                    padding: 15px;
                    margin: 20px 0;
                    color: #dc2626;
                }
                .footer {
                    background: #f8fafc;
                    padding: 20px;
                    text-align: center;
                    color: #64748b;
                    font-size: 14px;
                }
                .icon {
                    font-size: 48px;
                    margin-bottom: 10px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="icon">🔑</div>
                    <h1>איפוס סיסמה</h1>
                    <p>הוייפ שופ - מערכת ניהול</p>
                </div>
                
                <div class="content">
                    <h2>שלום ${userName},</h2>
                    <p>המנהל ביצע איפוס סיסמה עבור החשבון שלך.</p>
                    
                    <div class="password-box">
                        <h3>🔐 הסיסמה החד-פעמית שלך:</h3>
                        <div class="password">${temporaryPassword}</div>
                        <p><strong>שם משתמש:</strong> ${username}</p>
                    </div>
                    
                    <div class="warning">
                        <strong>⚠️ חשוב!</strong><br>
                        זוהי סיסמה זמנית חד-פעמית. תתבקש לשנות אותה מיד בכניסה הראשונה.
                    </div>
                    
                    <p><strong>הוראות:</strong></p>
                    <ol>
                        <li>השתמש בסיסמה הזמנית כדי להתחבר למערכת</li>
                        <li>המערכת תבקש ממך לשנות את הסיסמה מיד</li>
                        <li>בחר סיסמה חזקה וייחודית</li>
                    </ol>
                    
                    <div style="text-align: center;">
                        <a href="${changePasswordUrl}" class="button">
                            🔄 שנה סיסמה עכשיו
                        </a>
                    </div>
                    
                    <p><strong>או העתק את הקישור הבא:</strong></p>
                    <p style="word-break: break-all; background: #f1f5f9; padding: 10px; border-radius: 6px; font-family: monospace; font-size: 12px;">
                        ${changePasswordUrl}
                    </p>
                </div>
                
                <div class="footer">
                    <p>אם לא ביקשת איפוס סיסמה, אנא פנה למנהל המערכת מיד.</p>
                    <p>© ${new Date().getFullYear()} הוייפ שופ. כל הזכויות שמורות.</p>
                </div>
            </div>
        </body>
        </html>
        `;

        // Send email
        const mailOptions = {
            from: `"הוייפ שופ" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: '🔑 איפוס סיסמה - הוייפ שופ',
            html: htmlTemplate,
        };

        await transporter.sendMail(mailOptions);

        return NextResponse.json({
            success: true,
            message: 'Password reset email sent successfully'
        });

    } catch (error) {
        console.error('Email sending error:', error);
        return NextResponse.json(
            { error: 'Failed to send email' },
            { status: 500 }
        );
    }
}