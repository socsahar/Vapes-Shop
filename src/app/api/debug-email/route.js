import { NextResponse } from 'next/server';

// Use dynamic import for nodemailer compatibility
async function getNodemailer() {
    const nodemailer = await import('nodemailer');
    // Handle both CommonJS and ES module exports
    return nodemailer.default || nodemailer;
}

export async function GET() {
    try {
        console.log('=== EMAIL CONFIGURATION DEBUG ===');
        
        // Check environment variables
        const emailConfig = {
            GMAIL_USER: process.env.GMAIL_USER ? '✅ Set' : '❌ Missing',
            GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD ? '✅ Set' : '❌ Missing',
            NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || '❌ Missing',
            NODE_ENV: process.env.NODE_ENV || 'development'
        };

        console.log('Environment Variables:', emailConfig);

        // Test SMTP connection
        const nodemailer = await getNodemailer();
        const testResults = [];

        // Test configuration 1: Standard Gmail
        try {
            const transporter1 = nodemailer.createTransporter({
                service: 'gmail',
                auth: {
                    user: process.env.GMAIL_USER,
                    pass: process.env.GMAIL_APP_PASSWORD,
                }
            });

            await Promise.race([
                transporter1.verify(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), 10000)
                )
            ]);

            testResults.push({ config: 'gmail-service', status: '✅ Success' });
        } catch (error) {
            testResults.push({ config: 'gmail-service', status: `❌ Failed: ${error.message}` });
        }

        // Test configuration 2: Manual SMTP
        try {
            const transporter2 = nodemailer.createTransporter({
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
            });

            await Promise.race([
                transporter2.verify(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), 10000)
                )
            ]);

            testResults.push({ config: 'gmail-manual-587', status: '✅ Success' });
        } catch (error) {
            testResults.push({ config: 'gmail-manual-587', status: `❌ Failed: ${error.message}` });
        }

        // Test configuration 3: Alternative port
        try {
            const transporter3 = nodemailer.createTransporter({
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
            });

            await Promise.race([
                transporter3.verify(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), 10000)
                )
            ]);

            testResults.push({ config: 'gmail-manual-465', status: '✅ Success' });
        } catch (error) {
            testResults.push({ config: 'gmail-manual-465', status: `❌ Failed: ${error.message}` });
        }

        const debugInfo = {
            timestamp: new Date().toISOString(),
            environment: emailConfig,
            smtpTests: testResults,
            recommendations: []
        };

        // Add recommendations based on results
        const successfulConfigs = testResults.filter(r => r.status.includes('Success'));
        
        if (successfulConfigs.length === 0) {
            debugInfo.recommendations.push('❌ No SMTP configurations work - check Gmail app password');
            debugInfo.recommendations.push('🔧 Verify 2FA is enabled and app password is generated');
            debugInfo.recommendations.push('🌐 Check if hosting provider blocks SMTP ports');
        } else {
            debugInfo.recommendations.push(`✅ Working configurations: ${successfulConfigs.map(c => c.config).join(', ')}`);
        }

        if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
            debugInfo.recommendations.push('🔑 Set GMAIL_USER and GMAIL_APP_PASSWORD environment variables');
        }

        console.log('Debug Info:', JSON.stringify(debugInfo, null, 2));

        return NextResponse.json(debugInfo);

    } catch (error) {
        console.error('Debug endpoint error:', error);
        return NextResponse.json({
            error: 'Debug endpoint failed: ' + error.message,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const { testEmail } = await request.json();
        
        if (!testEmail) {
            return NextResponse.json({ error: 'Test email address required' }, { status: 400 });
        }

        console.log(`Sending test email to: ${testEmail}`);

        // Try to send a test email
        const response = await fetch(new URL('/api/send-email', request.url), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                to: testEmail,
                subject: '🧪 Vapes Shop - Test Email',
                html: `
                <div dir="rtl" style="font-family: Arial, sans-serif;">
                    <h2>🧪 בדיקת מערכת האימייל</h2>
                    <p>זהו מייל בדיקה מהוייפ שופ.</p>
                    <p>אם קיבלת מייל זה, המערכת עובדת כראוי!</p>
                    <p>זמן שליחה: ${new Date().toLocaleString('he-IL')}</p>
                </div>
                `
            })
        });

        const result = await response.json();

        return NextResponse.json({
            testEmailSent: response.ok,
            result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        return NextResponse.json({
            testEmailSent: false,
            error: error.message,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}