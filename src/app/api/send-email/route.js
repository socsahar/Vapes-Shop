import { NextResponse } from 'next/server';

// Use dynamic import for nodemailer compatibility
async function getNodemailer() {
    const nodemailer = await import('nodemailer');
    // Handle both CommonJS and ES module exports
    return nodemailer.default || nodemailer;
}

export async function POST(request) {
    try {
        const { to, subject, html, text } = await request.json();

        // Enhanced email sending with multiple fallback options
        const emailConfigs = [
            // Configuration 1: Standard SMTP
            {
                name: 'gmail-smtp-standard',
                config: {
                    service: 'gmail',
                    auth: {
                        user: process.env.GMAIL_USER,
                        pass: process.env.GMAIL_APP_PASSWORD,
                    }
                }
            },
            // Configuration 2: Manual SMTP settings
            {
                name: 'gmail-smtp-manual',
                config: {
                    host: 'smtp.gmail.com',
                    port: 587,
                    secure: false,
                    auth: {
                        user: process.env.GMAIL_USER,
                        pass: process.env.GMAIL_APP_PASSWORD,
                    },
                    tls: {
                        rejectUnauthorized: false
                    }
                }
            },
            // Configuration 3: Alternative port
            {
                name: 'gmail-smtp-alt',
                config: {
                    host: 'smtp.gmail.com',
                    port: 465,
                    secure: true,
                    auth: {
                        user: process.env.GMAIL_USER,
                        pass: process.env.GMAIL_APP_PASSWORD,
                    },
                    tls: {
                        rejectUnauthorized: false
                    }
                }
            }
        ];

        const nodemailer = await getNodemailer();
        let lastError;
        
        for (const emailConfig of emailConfigs) {
            try {
                console.log(`Trying email configuration: ${emailConfig.name}`);
                
                const transporter = nodemailer.createTransporter(emailConfig.config);

                const mailOptions = {
                    from: `"הוייפ שופ" <${process.env.GMAIL_USER}>`,
                    to,
                    subject,
                    html,
                    text: text || 'אנא השתמש בדפדפן שתומך ב-HTML לצפייה במייל זה.'
                };

                // Send email with timeout
                const result = await Promise.race([
                    transporter.sendMail(mailOptions),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Email timeout')), 30000)
                    )
                ]);

                console.log(`Email sent successfully using ${emailConfig.name}:`, result.messageId);
                
                return NextResponse.json({
                    success: true,
                    messageId: result.messageId,
                    configUsed: emailConfig.name
                });

            } catch (configError) {
                console.log(`Failed with ${emailConfig.name}:`, configError.message);
                lastError = configError;
                continue; // Try next configuration
            }
        }

        // If all configurations failed
        console.error('All email configurations failed. Last error:', lastError);
        
        return NextResponse.json({
            success: false,
            error: 'Failed to send email with all configurations',
            lastError: lastError.message
        }, { status: 500 });

    } catch (error) {
        console.error('Email service error:', error);
        return NextResponse.json({
            success: false,
            error: 'Email service error: ' + error.message
        }, { status: 500 });
    }
}