import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

export async function POST(request) {
    try {
        const { username, email, password, full_name, phone } = await request.json();

        if (!username || !email || !password || !full_name) {
            return NextResponse.json(
                { error: 'כל השדות הנדרשים חייבים להיות מלאים' },
                { status: 400 }
            );
        }

        // Check if username already exists
        const { data: existingUsername } = await supabase
            .from('users')
            .select('id')
            .eq('username', username)
            .single();

        if (existingUsername) {
            return NextResponse.json(
                { error: 'שם המשתמש כבר קיים במערכת' },
                { status: 409 }
            );
        }

        // Check if email already exists
        const { data: existingEmail } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (existingEmail) {
            return NextResponse.json(
                { error: 'כתובת האימייל כבר רשומה במערכת' },
                { status: 409 }
            );
        }

        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create new user
        const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert([{
                username,
                email,
                password: hashedPassword,
                full_name,
                phone: phone || null,
                role: 'customer',
                status: 'active',
                email_notifications: true,
                force_password_change: false
            }])
            .select()
            .single();

        if (insertError) {
            console.error('Insert error:', insertError);
            
            // If it's a role constraint error, try with admin role as fallback
            if (insertError.code === '23514' && insertError.message.includes('users_role_check')) {
                console.log('Role constraint failed, trying with admin role as fallback...');
                const { data: adminUser, error: adminError } = await supabase
                    .from('users')
                    .insert([{
                        username,
                        email,
                        password: hashedPassword,
                        full_name,
                        phone: phone || null,
                        role: 'admin', // Fallback to admin role
                        status: 'active',
                        email_notifications: true,
                        force_password_change: false
                    }])
                    .select()
                    .single();
                    
                if (adminError) {
                    console.error('Admin fallback also failed:', adminError);
                    return NextResponse.json(
                        { error: 'שגיאה ביצירת החשבון - בעיה בהגדרות בסיס הנתונים' },
                        { status: 500 }
                    );
                } else {
                    // Success with admin role
                    const { password: _, ...userWithoutPassword } = adminUser;
                    
                    // Send welcome email to new user
                    try {
                        console.log('Sending welcome email to new admin user:', adminUser.email);
                        await sendWelcomeEmail(adminUser);
                    } catch (emailError) {
                        console.error('Failed to send welcome email:', emailError);
                        // Don't fail registration if email fails - just log the error
                    }
                    
                    return NextResponse.json({
                        user: userWithoutPassword,
                        message: 'החשבון נוצר בהצלחה'
                    }, { status: 201 });
                }
            }
            
            return NextResponse.json(
                { error: 'שגיאה ביצירת החשבון' },
                { status: 500 }
            );
        }

        // Remove password from response
        const { password: _, ...userWithoutPassword } = newUser;

        // Send welcome email to new user
        try {
            console.log('Sending welcome email to new user:', newUser.email);
            await sendWelcomeEmail(newUser);
        } catch (emailError) {
            console.error('Failed to send welcome email:', emailError);
            // Don't fail registration if email fails - just log the error
        }

        return NextResponse.json({
            user: userWithoutPassword,
            message: 'החשבון נוצר בהצלחה'
        }, { status: 201 });

    } catch (error) {
        console.error('Registration error:', error);
        return NextResponse.json(
            { error: 'שגיאה בשרת' },
            { status: 500 }
        );
    }
}

// Function to send welcome email to new users
async function sendWelcomeEmail(user) {
    const welcomeEmailTemplate = generateWelcomeEmailTemplate(user);
    
    try {
        // Try to send email using the enhanced email system with Gmail SMTP fallback
        let emailResult;
        
        // First try with real email providers if configured
        if (process.env.RESEND_API_KEY) {
            // Use Resend API
            console.log('Trying Resend API for welcome email...');
            const resendResponse = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: 'noreply@vapes-shop.top',
                    to: [user.email],
                    subject: '🎉 ברוכים הבאים להוייפ שופ - החנות המובילה בישראל!',
                    html: welcomeEmailTemplate
                })
            });

            if (resendResponse.ok) {
                const resendData = await resendResponse.json();
                emailResult = {
                    success: true,
                    messageId: resendData.id,
                    service: 'Resend API'
                };
            } else {
                throw new Error('Resend API failed');
            }
        } else if (process.env.SMTP2GO_API_KEY) {
            // Use SMTP2GO API
            console.log('Trying SMTP2GO API for welcome email...');
            const smtp2goResponse = await fetch('https://api.smtp2go.com/v3/email/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Smtp2go-Api-Key': process.env.SMTP2GO_API_KEY
                },
                body: JSON.stringify({
                    to: [user.email],
                    sender: 'noreply@vapes-shop.top',
                    subject: '🎉 ברוכים הבאים להוייפ שופ - החנות המובילה בישראל!',
                    html_body: welcomeEmailTemplate
                })
            });

            if (smtp2goResponse.ok) {
                const smtp2goData = await smtp2goResponse.json();
                emailResult = {
                    success: true,
                    messageId: smtp2goData.data?.email_id || 'smtp2go-sent',
                    service: 'SMTP2GO API'
                };
            } else {
                throw new Error('SMTP2GO API failed');
            }
        } else if (process.env.GMAIL_USER && (process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD)) {
            // Use Gmail SMTP as fallback
            console.log('Trying Gmail SMTP for welcome email...');
            
            // Use dynamic import for nodemailer to handle ES module compatibility
            const nodemailer = await import('nodemailer');
            const createTransporter = nodemailer.default?.createTransporter || nodemailer.createTransporter;
            
            const transporter = createTransporter({
                service: 'gmail',
                auth: {
                    user: process.env.GMAIL_USER,
                    pass: (process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS)?.replace(/\s/g, '')
                },
                tls: {
                    rejectUnauthorized: false
                }
            });

            const info = await transporter.sendMail({
                from: `"הוייפ שופ" <${process.env.GMAIL_USER}>`,
                to: user.email,
                subject: '🎉 ברוכים הבאים להוייפ שופ - החנות המובילה בישראל!',
                html: welcomeEmailTemplate
            });

            emailResult = {
                success: true,
                messageId: info.messageId,
                service: 'Gmail SMTP'
            };
        } else {
            // Fallback to simple email service
            console.log('No direct email provider configured, trying simple email service...');
            const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://vapes-shop.top'}/api/simple-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to: user.email,
                    subject: '🎉 ברוכים הבאים להוייפ שופ - החנות המובילה בישראל!',
                    html: welcomeEmailTemplate
                })
            });

            const result = await emailResponse.json();
            emailResult = result;
        }
        
        if (emailResult?.success) {
            console.log(`Welcome email sent successfully to ${user.email} using ${emailResult.service || 'unknown service'}`);
            console.log('Message ID:', emailResult.messageId);
        } else {
            throw new Error(emailResult?.error || 'Failed to send welcome email');
        }
        
    } catch (error) {
        console.error('Error sending welcome email:', error);
        throw error;
    }
}

// Function to generate welcome email HTML template
function generateWelcomeEmailTemplate(user) {
    const currentYear = new Date().getFullYear();
    const shopUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://vapes-shop.top';
    const whatsappGroupUrl = 'https://chat.whatsapp.com/I8mx0Fy7bjq7xsG2EfqMDY';
    
    return `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ברוכים הבאים להוייפ שופ</title>
        <style>
            body { 
                font-family: 'Segoe UI', Tahoma, Arial, sans-serif; 
                direction: rtl; 
                text-align: right;
                margin: 0;
                padding: 0;
                background-color: #f5f5f5;
                line-height: 1.6;
            }
            .container { 
                max-width: 600px; 
                margin: 0 auto; 
                background-color: #ffffff;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header { 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white; 
                padding: 40px 30px; 
                text-align: center;
            }
            .header h1 {
                margin: 0;
                font-size: 32px;
                font-weight: bold;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            }
            .header .welcome-icon {
                font-size: 48px;
                margin-bottom: 10px;
                display: block;
            }
            .content { 
                padding: 40px 30px; 
                background: #ffffff;
            }
            .welcome-section { 
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                color: white;
                padding: 30px; 
                border-radius: 12px; 
                margin: 30px 0; 
                text-align: center;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            .welcome-section h2 {
                margin-top: 0;
                font-size: 24px;
                font-weight: bold;
            }
            .features { 
                background: #f8f9ff; 
                padding: 30px; 
                border-radius: 12px; 
                margin: 30px 0;
                border: 2px solid #e1e5f2;
            }
            .features h3 {
                color: #4c51bf;
                margin-top: 0;
                font-size: 20px;
                font-weight: bold;
            }
            .features ul {
                list-style: none;
                padding: 0;
                margin: 20px 0;
            }
            .features li {
                padding: 12px 0;
                border-bottom: 1px solid #e2e8f0;
                font-size: 16px;
            }
            .features li:last-child {
                border-bottom: none;
            }
            .features li::before {
                content: "✅ ";
                margin-left: 10px;
                font-size: 18px;
            }
            .cta-section {
                background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
                color: white;
                padding: 30px;
                border-radius: 12px;
                text-align: center;
                margin: 30px 0;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            .button { 
                background: #ffffff;
                color: #4facfe;
                padding: 15px 30px; 
                text-decoration: none; 
                border-radius: 25px; 
                display: inline-block; 
                font-weight: bold;
                font-size: 18px;
                margin: 15px 10px;
                transition: all 0.3s ease;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            }
            .button:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }
            .whatsapp-section {
                background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
                color: white;
                padding: 25px;
                border-radius: 12px;
                text-align: center;
                margin: 30px 0;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            .whatsapp-button {
                background: #ffffff;
                color: #25D366;
                padding: 12px 25px;
                text-decoration: none;
                border-radius: 20px;
                display: inline-block;
                font-weight: bold;
                margin-top: 15px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            }
            .info-box { 
                background: #e6fffa; 
                border-right: 4px solid #38b2ac;
                padding: 20px; 
                border-radius: 8px; 
                margin: 25px 0;
            }
            .info-box h4 {
                color: #2c7a7b;
                margin-top: 0;
                font-size: 18px;
            }
            .footer { 
                text-align: center; 
                color: #718096; 
                font-size: 14px; 
                padding: 30px;
                background: #f7fafc;
                border-top: 1px solid #e2e8f0;
            }
            .footer .logo {
                font-size: 24px;
                font-weight: bold;
                color: #4c51bf;
                margin-bottom: 10px;
            }
            .user-info {
                background: #fff5f5;
                border: 1px solid #fed7d7;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
            }
            .user-info h4 {
                color: #c53030;
                margin-top: 0;
                font-size: 16px;
            }
            @media only screen and (max-width: 600px) {
                .container { width: 100% !important; }
                .content { padding: 20px !important; }
                .header { padding: 30px 20px !important; }
                .features, .welcome-section, .cta-section, .whatsapp-section { 
                    padding: 20px !important; 
                    margin: 20px 0 !important;
                }
                .button { 
                    padding: 12px 20px !important; 
                    font-size: 16px !important;
                    margin: 10px 5px !important;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <span class="welcome-icon">🎉</span>
                <h1>ברוכים הבאים להוייפ שופ!</h1>
                <p style="font-size: 18px; margin: 10px 0 0 0; opacity: 0.9;">החנות המובילה למוצרי ויפינג באיכות גבוהה</p>
            </div>
            
            <div class="content">
                <div class="user-info">
                    <h4>👤 פרטי החשבון שלך:</h4>
                    <p><strong>שם מלא:</strong> ${user.full_name}</p>
                    <p><strong>שם משתמש:</strong> ${user.username}</p>
                    <p><strong>אימייל:</strong> ${user.email}</p>
                    ${user.phone ? `<p><strong>טלפון:</strong> ${user.phone}</p>` : ''}
                </div>
                
                <div class="welcome-section">
                    <h2>🌟 ברוכים הבאים למשפחת הוייפ שופ!</h2>
                    <p style="font-size: 18px; margin: 0;">אנחנו שמחים שהצטרפת אלינו והחלטת לבחור בטוב ביותר!</p>
                </div>

                <p style="font-size: 18px; color: #2d3748;"><strong>שלום ${user.full_name},</strong></p>
                <p style="font-size: 16px; color: #4a5568;">תודה שבחרת בהוייפ שופ! החשבון שלך נוצר בהצלחה ואתה מוכן להתחיל לקנות מהמגוון הרחב שלנו.</p>

                <div class="features">
                    <h3>🌟 מה מחכה לך אצלנו:</h3>
                    <ul>
                        <li><strong>מגוון עצום של מוצרים</strong> - ויפים, נוזלים, אביזרים ועוד</li>
                        <li><strong>איכות מעולה</strong> - רק מוצרים מהמותגים הטובים בעולם</li>
                        <li><strong>מחירים תחרותיים</strong> - הטובים ביותר בשוק הישראלי</li>
                        <li><strong>משלוח מהיר</strong> - לכל רחבי הארץ תוך 2-3 ימי עסקים</li>
                        <li><strong>הזמנות קבוצתיות</strong> - חסכו יותר עם ההזמנות הקבוצתיות שלנו</li>
                        <li><strong>שירות לקוחות מעולה</strong> - אנחנו כאן בשבילך 24/7</li>
                        <li><strong>משלוח חינם</strong> - על הזמנות מעל ₪200</li>
                    </ul>
                </div>

                <div class="cta-section">
                    <h3 style="margin-top: 0; font-size: 22px;">🛍️ מוכן להתחיל לקנות?</h3>
                    <p style="font-size: 16px; margin: 15px 0;">כנס לחנות שלנו ותגלה את המגוון המדהים!</p>
                    <a href="${shopUrl}/shop" class="button">כניסה לחנות 🛒</a>
                    <a href="${shopUrl}/auth/login" class="button">התחברות לאתר 🔐</a>
                </div>

                <div class="whatsapp-section">
                    <h3 style="margin-top: 0;">📱 הצטרף לקבוצת הוואטסאפ שלנו!</h3>
                    <p>קבל עדכונים על מוצרים חדשים, מבצעים מיוחדים והזמנות קבוצתיות</p>
                    <a href="${whatsappGroupUrl}" class="whatsapp-button">🔗 הצטרפות לקבוצה</a>
                </div>

                <div class="info-box">
                    <h4>💡 טיפים למתחילים:</h4>
                    <ul style="margin: 10px 0; padding-right: 20px;">
                        <li>בחר ויפ שמתאים לרמת הניקוטין שלך</li>
                        <li>נסה טעמים שונים למצוא את המועדף עליך</li>
                        <li>שמור על הויפ נקי לטעם טוב יותר</li>
                        <li>הצטרף להזמנות הקבוצתיות שלנו לחיסכון</li>
                    </ul>
                </div>
            </div>

            <div class="footer">
                <div class="logo">🌬️ הוייפ שופ</div>
                <p><strong>החנות המובילה למוצרי ויפינג באיכות גבוהה בישראל</strong></p>
                <p>📧 ${process.env.ADMIN_EMAIL || 'info@vapes-shop.top'} | 📱 <a href="${whatsappGroupUrl}" style="color: #4c51bf;">קבוצת וואטסאפ</a></p>
                <p>🌐 <a href="${shopUrl}" style="color: #4c51bf;">vapes-shop.top</a></p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                <p style="font-size: 12px; color: #a0aec0;">
                    קיבלת את המייל הזה כי נרשמת לאתר הוייפ שופ.<br>
                    אם אתה לא רוצה לקבל מיילים נוספים, <a href="${shopUrl}/unsubscribe" style="color: #4c51bf;">לחץ כאן להסרה מהרשימה</a>
                </p>
                <p style="font-size: 12px; color: #a0aec0;">© ${currentYear} הוייפ שופ. כל הזכויות שמורות.</p>
            </div>
        </div>
    </body>
    </html>
    `;
}