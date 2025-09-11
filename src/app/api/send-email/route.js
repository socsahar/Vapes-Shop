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

        console.log('Send email service: Preparing to send email...');
        console.log('To:', to);
        console.log('Subject:', subject);

        let emailResult;
        
        // Try Resend API first (primary service)
        if (process.env.RESEND_API_KEY) {
            try {
                console.log('Trying Resend API...');
                
                const resendResponse = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        from: 'noreply@vapes-shop.top',
                        to: [to],
                        subject: subject,
                        html: html
                    })
                });

                if (resendResponse.ok) {
                    const resendData = await resendResponse.json();
                    console.log('✅ Resend email sent successfully!');
                    
                    return NextResponse.json({
                        success: true,
                        messageId: resendData.id,
                        service: 'Resend API'
                    });
                } else {
                    const resendError = await resendResponse.json();
                    console.log('❌ Resend API failed:', resendError);
                    throw new Error(`Resend API failed: ${resendError.message || 'Unknown error'}`);
                }
            } catch (resendError) {
                console.log('Resend API failed, trying Gmail SMTP fallback...');
            }
        }
        
        // Fallback to Gmail SMTP with multiple configurations
        const gmailPassword = process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS;
        
        const emailConfigs = [
            // Configuration 1: Standard SMTP
            {
                name: 'gmail-smtp-standard',
                config: {
                    service: 'gmail',
                    auth: {
                        user: process.env.GMAIL_USER,
                        pass: gmailPassword,
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
                        pass: gmailPassword,
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
                console.log(`Trying Gmail SMTP configuration: ${emailConfig.name}`);
                
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

                console.log(`Gmail SMTP email sent successfully using ${emailConfig.name}:`, result.messageId);
                
                return NextResponse.json({
                    success: true,
                    messageId: result.messageId,
                    service: `Gmail SMTP (${emailConfig.name})`
                });

            } catch (configError) {
                console.log(`Failed with ${emailConfig.name}:`, configError.message);
                lastError = configError;
                continue; // Try next configuration
            }
        }

        // If all configurations failed
        console.error('All email services failed. Last error:', lastError);
        
        return NextResponse.json({
            success: false,
            error: 'Failed to send email with all services',
            lastError: lastError?.message || 'Unknown error'
        }, { status: 500 });

    } catch (error) {
        console.error('Email service error:', error);
        return NextResponse.json({
            success: false,
            error: 'Email service error: ' + error.message
        }, { status: 500 });
    }
}