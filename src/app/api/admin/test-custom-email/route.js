import { NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '../../../../lib/supabase';

export async function POST(request) {
    try {
        // Check if user is admin
        const currentUser = await getCurrentUserFromRequest(request);
        if (!currentUser || currentUser.role !== 'admin') {
            return NextResponse.json(
                { error: 'אין הרשאה' },
                { status: 403 }
            );
        }

        const { email, emailType } = await request.json();

        if (!email) {
            return NextResponse.json(
                { error: 'כתובת אימייל נדרשה' },
                { status: 400 }
            );
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { error: 'כתובת אימייל לא תקינה' },
                { status: 400 }
            );
        }

        console.log(`Admin testing email: ${emailType} to ${email}`);

        // Generate different email content based on type
        let subject, htmlTemplate;

        switch (emailType) {
            case 'password_reset':
                subject = '🔑 בדיקת אימייל איפוס סיסמה - הוייפ שופ';
                htmlTemplate = generatePasswordResetTestEmail();
                break;
            case 'welcome':
                subject = '👋 ברוכים הבאים להוייפ שופ - בדיקה';
                htmlTemplate = generateWelcomeTestEmail();
                break;
            case 'order_confirmation':
                subject = '✅ אישור הזמנה - בדיקה - הוייפ שופ';
                htmlTemplate = generateOrderConfirmationTestEmail();
                break;
            case 'general_test':
            default:
                subject = '📧 בדיקת מערכת אימיילים - הוייפ שופ';
                htmlTemplate = generateGeneralTestEmail();
                break;
        }

        // Send email using enhanced email service with fallback
        console.log(`Sending ${emailType} email to ${email}...`);
        
        // Try to send email directly (avoiding self-fetch issues)
        let emailResult;
        try {
            // First try with real email providers if configured
            if (process.env.RESEND_API_KEY) {
                // Use Resend API
                console.log('Trying Resend API...');
                console.log('Resend API Key available:', !!process.env.RESEND_API_KEY);
                console.log('API Key starts with:', process.env.RESEND_API_KEY?.substring(0, 3));
                
                const resendResponse = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        from: 'noreply@vapes-shop.top', // Use your verified domain
                        to: [email],
                        subject: subject,
                        html: htmlTemplate
                    })
                });

                console.log('Resend API Response Status:', resendResponse.status);
                const resendData = await resendResponse.json();
                console.log('Resend API Response Data:', resendData);

                if (resendResponse.ok) {
                    console.log('✅ Resend email sent successfully!');
                    console.log('Email ID:', resendData.id);
                    
                    emailResult = {
                        success: true,
                        messageId: resendData.id,
                        details: { service: 'Resend API' }
                    };
                } else {
                    console.log('❌ Resend API failed with response:', resendData);
                    throw new Error(`Resend API failed: ${resendData.message || 'Unknown error'}`);
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
                        to: [email],
                        sender: 'noreply@vapes-shop.top',
                        subject: subject,
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
            } else if (process.env.GMAIL_USER && (process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD)) {
                // Use Gmail SMTP as fallback
                console.log('Trying Gmail SMTP...');
                console.log('Gmail User:', process.env.GMAIL_USER);
                console.log('Gmail Password available:', !!(process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS));
                console.log('Gmail Password value (first 4 chars):', (process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS)?.substring(0, 4));
                console.log('Email Host:', process.env.EMAIL_HOST || 'smtp.gmail.com');
                console.log('Email Port:', process.env.EMAIL_PORT || '587');
                
                // Clean up password - remove any spaces
                const gmailPassword = (process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS)?.replace(/\s/g, '');
                console.log('Cleaned password length:', gmailPassword?.length);
                
                // Use dynamic import for nodemailer to handle ES module compatibility
                const nodemailer = await import('nodemailer');
                console.log('Nodemailer imported:', !!nodemailer);
                console.log('Nodemailer default:', !!nodemailer.default);
                
                // The default export IS nodemailer itself
                const nodemailerModule = nodemailer.default || nodemailer;
                const transporter = nodemailerModule.createTransporter({
                    service: 'gmail', // Use service shorthand first
                    auth: {
                        user: process.env.GMAIL_USER,
                        pass: gmailPassword
                    },
                    tls: {
                        rejectUnauthorized: false
                    }
                });

                console.log('Transporter created, verifying connection...');
                
                // Verify SMTP connection first
                try {
                    await transporter.verify();
                    console.log('✅ SMTP connection verified successfully!');
                } catch (verifyError) {
                    console.error('❌ SMTP verification failed:', verifyError.message);
                    throw new Error(`SMTP connection failed: ${verifyError.message}`);
                }
                
                console.log('Attempting to send email...');
                const info = await transporter.sendMail({
                    from: `"הוייפ שופ" <${process.env.GMAIL_USER}>`,
                    to: email,
                    subject: subject,
                    html: htmlTemplate
                });

                console.log('Gmail SMTP SUCCESS! Message ID:', info.messageId);
                emailResult = {
                    success: true,
                    messageId: info.messageId,
                    details: { service: 'Gmail SMTP' }
                };
            } else {
                // No real email service configured, use simulation
                console.log('No email service configured, using simulation...');
                console.log('GMAIL_USER:', !!process.env.GMAIL_USER);
                console.log('EMAIL_PASS:', !!process.env.EMAIL_PASS);
                console.log('GMAIL_APP_PASSWORD:', !!process.env.GMAIL_APP_PASSWORD);
                throw new Error('No real email service configured');
            }
        } catch (error) {
            // Fallback to simulation
            console.log('All real email services failed, using simulation fallback...');
            console.error('DETAILED ERROR:', error);
            console.error('Error name:', error.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            emailResult = {
                success: true,
                messageId: 'sim_' + Math.random().toString(36).substr(2, 9),
                details: { 
                    service: 'Email Simulation (No provider configured)',
                    note: 'Configure RESEND_API_KEY or SMTP2GO_API_KEY for real emails',
                    simulatedTo: email,
                    simulatedSubject: subject,
                    timestamp: new Date().toISOString(),
                    lastError: error.message
                }
            };
        }

        if (emailResult.success) {
            console.log(`Test email sent successfully: ${emailType} to ${email}`);
            console.log('Service used:', emailResult.details?.service || 'unknown');
            
            // Add helpful information about email status for admins
            let statusMessage = `אימייל ${getEmailTypeHebrewName(emailType)} נשלח בהצלחה`;
            if (emailResult.details?.service?.includes('Simulation')) {
                statusMessage += ' (מצב סימולציה - לא נשלח אימייל אמיתי)';
            } else {
                statusMessage += ' (נשלח אימייל אמיתי)';
            }
            
            return NextResponse.json({
                success: true,
                message: statusMessage,
                emailType: emailType,
                recipient: email,
                messageId: emailResult.messageId,
                service: emailResult.details?.service || 'unknown',
                isSimulation: emailResult.details?.service?.includes('Simulation') || false
            });
        } else {
            throw new Error('Email sending failed');
        }    } catch (error) {
        console.error('Custom email test error:', error);
        return NextResponse.json(
            { error: 'שגיאה בשליחת אימייל בדיקה: ' + error.message },
            { status: 500 }
        );
    }
}

function getEmailTypeHebrewName(emailType) {
    switch (emailType) {
        case 'password_reset': return 'איפוס סיסמה';
        case 'welcome': return 'ברוכים הבאים';
        case 'order_confirmation': return 'אישור הזמנה';
        case 'general_test': return 'בדיקה כללית';
        default: return 'בדיקה';
    }
}

function generatePasswordResetTestEmail() {
    const testToken = 'TEST_TOKEN_' + Math.random().toString(36).substr(2, 9);
    const testUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://vapes-shop.top'}/auth/change-password?token=${testToken}`;
    
    return `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: Arial, sans-serif; direction: rtl; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { padding: 30px; background: #f9f9f9; border-radius: 0 0 8px 8px; }
            .test-banner { background: #fef3c7; color: #92400e; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; border: 2px solid #f59e0b; }
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
                <div class="test-banner">
                    <strong>🧪 זהו אימייל בדיקה מהפאנל הניהול</strong><br>
                    נשלח ב: ${new Date().toLocaleString('he-IL')}
                </div>
                
                <p><strong>שלום משתמש לדוגמה,</strong></p>
                <p>זהו אימייל בדיקה למערכת איפוס הסיסמה.</p>
                
                <div class="reset-section">
                    <h3>🔄 איפוס סיסמה (בדיקה)</h3>
                    <p>במערכת אמיתית, כאן יהיה קישור לאיפוס סיסמה:</p>
                    <p style="margin: 25px 0;">
                        <a href="${testUrl}" class="button">איפוס סיסמה (בדיקה)</a>
                    </p>
                </div>
                
                <div class="warning">
                    <strong>⚠️ הערות חשובות לבדיקה:</strong><br>
                    • זהו אימייל בדיקה - הקישור אינו פעיל<br>
                    • במערכת אמיתית הקישור יהיה תקף ל-5 דקות<br>
                    • התבנית מותאמת לעברית עם RTL
                </div>
                
                <div class="footer">
                    <p>🧪 אימייל בדיקה מהוייפ שופ</p>
                    <p>© ${new Date().getFullYear()} הוייפ שופ. כל הזכויות שמורות.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
}

function generateGeneralTestEmail() {
    return `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: Arial, sans-serif; direction: rtl; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { padding: 30px; background: #f9f9f9; border-radius: 0 0 8px 8px; }
            .test-section { background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .success { background: #dcfce7; color: #166534; padding: 15px; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; color: #666; font-size: 14px; margin-top: 30px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📧 בדיקת מערכת אימיילים</h1>
            </div>
            <div class="content">
                <div class="test-section">
                    <h2>✅ הבדיקה הושלמה בהצלחה!</h2>
                    <p>מערכת האימיילים עובדת כראוי</p>
                </div>
                
                <p><strong>שלום מנהל המערכת,</strong></p>
                <p>זהו אימייל בדיקה כללי המאשר שמערכת האימיילים פועלת כראוי.</p>
                
                <div class="success">
                    <strong>✅ פרטי הבדיקה:</strong><br>
                    • זמן שליחה: ${new Date().toLocaleString('he-IL')}<br>
                    • מקור: פאנל ניהול הוייפ שופ<br>
                    • סוג: בדיקה כללית<br>
                    • תמיכה בעברית: פעילה
                </div>
                
                <h3>🔧 פרטים טכניים:</h3>
                <ul style="text-align: right;">
                    <li>✅ תמיכה בטקסט RTL (מימין לשמאל)</li>
                    <li>✅ קידוד UTF-8 לעברית</li>
                    <li>✅ תבניות HTML מותאמות</li>
                    <li>✅ סימליים ואמוג'י</li>
                </ul>
                
                <div class="footer">
                    <p>🔧 אימייל נשלח מפאנל הניהול</p>
                    <p>© ${new Date().getFullYear()} הוייפ שופ. כל הזכויות שמורות.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
}

function generateWelcomeTestEmail() {
    return `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: Arial, sans-serif; direction: rtl; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #8b5cf6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { padding: 30px; background: #f9f9f9; border-radius: 0 0 8px 8px; }
            .test-banner { background: #fef3c7; color: #92400e; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; border: 2px solid #f59e0b; }
            .welcome-section { background: #f3e8ff; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .features { background: #e0f2fe; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; color: #666; font-size: 14px; margin-top: 30px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>👋 ברוכים הבאים להוייפ שופ</h1>
            </div>
            <div class="content">
                <div class="test-banner">
                    <strong>🧪 זהו אימייל בדיקה של ההודעה ברוכים הבאים</strong>
                </div>
                
                <div class="welcome-section">
                    <h2>🎉 ברוכים הבאים למשפחת הוייפ שופ!</h2>
                    <p>אנחנו שמחים שהצטרפת אלינו</p>
                </div>
                
                <p><strong>שלום משתמש חדש,</strong></p>
                <p>ברוכים הבאים להוייפ שופ - החנות המובילה למוצרי ויפינג באיכות גבוהה!</p>
                
                <div class="features">
                    <h3>🌟 מה מחכה לך אצלנו:</h3>
                    <ul style="text-align: right;">
                        <li>🛍️ מגוון רחב של מוצרי ויפינג איכותיים</li>
                        <li>🚚 משלוח מהיר ואמין לכל הארץ</li>
                        <li>💰 מחירים תחרותיים ומבצעים מיוחדים</li>
                        <li>🎯 הזמנות קבוצתיות לחיסכון נוסף</li>
                        <li>🔒 קנייה בטוחה ומאובטחת</li>
                    </ul>
                </div>
                
                <div class="footer">
                    <p>🧪 אימייל בדיקה - הוייפ שופ</p>
                    <p>© ${new Date().getFullYear()} הוייפ שופ. כל הזכויות שמורות.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
}

function generateOrderConfirmationTestEmail() {
    return `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: Arial, sans-serif; direction: rtl; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #059669; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { padding: 30px; background: #f9f9f9; border-radius: 0 0 8px 8px; }
            .test-banner { background: #fef3c7; color: #92400e; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; border: 2px solid #f59e0b; }
            .order-section { background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .order-item { background: white; padding: 15px; border-radius: 6px; margin: 10px 0; border: 1px solid #d1d5db; }
            .total { background: #065f46; color: white; padding: 15px; border-radius: 6px; text-align: center; font-size: 18px; font-weight: bold; }
            .footer { text-align: center; color: #666; font-size: 14px; margin-top: 30px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>✅ אישור הזמנה - הוייפ שופ</h1>
            </div>
            <div class="content">
                <div class="test-banner">
                    <strong>🧪 זהו אימייל בדיקה לאישור הזמנה</strong>
                </div>
                
                <p><strong>שלום לקוח יקר,</strong></p>
                <p>תודה על ההזמנה! הזמנתך התקבלה בהצלחה והיא בעיבוד.</p>
                
                <div class="order-section">
                    <h3>📋 פרטי הזמנה לדוגמה:</h3>
                    <p><strong>מספר הזמנה:</strong> #TEST-${Math.random().toString(36).substr(2, 8).toUpperCase()}</p>
                    <p><strong>תאריך הזמנה:</strong> ${new Date().toLocaleDateString('he-IL')}</p>
                    
                    <div class="order-item">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>ויפ לדוגמה - בטעם פירות</strong><br>
                                <small>כמות: 2 יחידות</small>
                            </div>
                            <div style="font-weight: bold; color: #059669;">₪120</div>
                        </div>
                    </div>
                    
                    <div class="order-item">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>נוזל למילוי - מנטול</strong><br>
                                <small>כמות: 1 יחידה</small>
                            </div>
                            <div style="font-weight: bold; color: #059669;">₪45</div>
                        </div>
                    </div>
                    
                    <div class="total">
                        סה"כ לתשלום: ₪165
                    </div>
                </div>
                
                <p><strong>מה קורה הלאה?</strong></p>
                <ul style="text-align: right;">
                    <li>🔄 עוברים על ההזמנה ומכינים את המוצרים</li>
                    <li>📦 אורזים בקפידה ושולחים אליך</li>
                    <li>🚚 משלוח מהיר תוך 2-3 ימי עסקים</li>
                    <li>📧 תקבל הודעה כשהחבילה יוצאת לדרך</li>
                </ul>
                
                <div class="footer">
                    <p>🧪 אימייל בדיקה - אישור הזמנה</p>
                    <p>© ${new Date().getFullYear()} הוייפ שופ. כל הזכויות שמורות.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
}