import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const { to, subject, html } = await request.json();

        console.log('Simple email service: Preparing to send email...');
        console.log('To:', to);
        console.log('Subject:', subject);

        // Validate environment variables
        if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
            throw new Error('Missing email configuration');
        }

        // Use EmailJS or similar service (simulated for now)
        // In production, you would use a service like:
        // - SendGrid: https://sendgrid.com/
        // - Mailgun: https://www.mailgun.com/
        // - EmailJS: https://www.emailjs.com/
        // - Resend: https://resend.com/

        console.log('Email service: Simulating successful email send...');
        
        // Simulate email sending delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Log the email details for debugging
        console.log('Email Details:');
        console.log('- From:', process.env.GMAIL_USER);
        console.log('- To:', to);
        console.log('- Subject:', subject);
        console.log('- HTML Length:', html?.length || 0);

        // Return success response
        const messageId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        console.log('Email sent successfully (simulated):', messageId);

        return NextResponse.json({
            success: true,
            messageId: messageId,
            message: 'Email sent successfully',
            details: {
                service: 'simulation',
                timestamp: new Date().toISOString(),
                to: to,
                subject: subject
            }
        });

    } catch (error) {
        console.error('Simple email service error:', error);
        
        return NextResponse.json({
            success: false,
            error: 'Failed to send email: ' + error.message,
            details: {
                timestamp: new Date().toISOString(),
                errorType: error.constructor.name
            }
        }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({
        message: 'Simple Email Service',
        status: 'active',
        features: [
            'Password reset emails',
            'User notifications',
            'System alerts'
        ],
        usage: 'Send POST request with { to, subject, html } payload'
    });
}