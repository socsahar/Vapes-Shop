const nodemailer = require('nodemailer');
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        console.log('Testing email configuration...');
        
        // Check environment variables
        if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
            return NextResponse.json({
                success: false,
                error: 'Missing email environment variables',
                details: {
                    hasGmailUser: !!process.env.GMAIL_USER,
                    hasGmailPassword: !!process.env.GMAIL_APP_PASSWORD
                }
            });
        }

        // Create transporter with minimal configuration
        console.log('Creating transporter...');
        const transporter = nodemailer.createTransporter({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD,
            }
        });

        console.log('Transporter created successfully');

        // Test email
        const testEmail = {
            from: process.env.GMAIL_USER,
            to: process.env.GMAIL_USER, // Send to self for testing
            subject: 'Test Email from Vapes Shop',
            text: 'This is a test email to verify SMTP configuration.',
            html: '<h1>Test Email</h1><p>This is a test email to verify SMTP configuration.</p>'
        };

        console.log('Sending test email...');
        const result = await transporter.sendMail(testEmail);
        
        console.log('Test email sent successfully:', result.messageId);

        return NextResponse.json({
            success: true,
            message: 'Test email sent successfully',
            messageId: result.messageId,
            details: {
                from: testEmail.from,
                to: testEmail.to,
                subject: testEmail.subject
            }
        });

    } catch (error) {
        console.error('Test email error:', error);
        
        return NextResponse.json({
            success: false,
            error: 'Failed to send test email',
            details: {
                message: error.message,
                code: error.code,
                command: error.command
            }
        }, { status: 500 });
    }
}

export async function GET(request) {
    return NextResponse.json({
        message: 'Email test endpoint',
        instructions: 'Send a POST request to test email configuration'
    });
}