import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// Test email configuration
export async function POST(request) {
  try {
    const { testEmail } = await request.json();
    
    if (!testEmail) {
      return NextResponse.json(
        { error: 'כתובת אימייל נדרשה לבדיקה' },
        { status: 400 }
      );
    }

    // Create transporter with current settings
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Verify connection
    await transporter.verify();

    // Send test email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: testEmail,
      subject: 'בדיקת מערכת אימייל - Vape Shop',
      html: `
        <!DOCTYPE html>
        <html dir="rtl">
        <head><meta charset="UTF-8"><title>בדיקת אימייל</title></head>
        <body style="font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
        <h1 style="margin: 0; font-size: 28px;">✅ בדיקת מערכת אימייל</h1>
        </div>
        <div style="padding: 30px;">
        <h2 style="color: #333; margin-bottom: 20px;">הבדיקה הצליחה!</h2>
        <p style="color: #666; line-height: 1.6; font-size: 16px;">
          מערכת האימייל פועלת כראוי. אימייל זה נשלח מ:
        </p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #333;"><strong>🖥️ שרת SMTP:</strong> Gmail (smtp.gmail.com)</p>
        <p style="margin: 10px 0 0 0; color: #333;"><strong>📧 כתובת שולח:</strong> ${process.env.EMAIL_USER}</p>
        <p style="margin: 10px 0 0 0; color: #333;"><strong>🔐 אבטחה:</strong> App Password</p>
        <p style="margin: 10px 0 0 0; color: #333;"><strong>⏰ זמן שליחה:</strong> ${new Date().toLocaleString('he-IL')}</p>
        </div>
        <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #155724; font-weight: bold;">✅ מערכת ההזמנות הקבוצתיות מוכנה לשליחת אימיילים!</p>
        </div>
        </div>
        </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({
      success: true,
      message: 'אימייל בדיקה נשלח בהצלחה',
      config: {
        smtp: 'Gmail',
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        from: process.env.EMAIL_USER
      }
    });

  } catch (error) {
    console.error('Email test failed:', error);
    
    let errorMessage = 'שגיאה בבדיקת מערכת האימייל';
    if (error.code === 'EAUTH') {
      errorMessage = 'שגיאת אימות - בדוק את סיסמת האפליקציה של Gmail';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'שגיאת חיבור לשרת SMTP';
    } else if (error.code === 'EENVELOPE') {
      errorMessage = 'שגיאה בכתובת אימייל';
    }

    return NextResponse.json(
      { 
        error: errorMessage,
        details: error.message,
        code: error.code
      },
      { status: 500 }
    );
  }
}

// GET - Show current email configuration (without sensitive data)
export async function GET() {
  return NextResponse.json({
    smtp: {
      service: 'Gmail',
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      user: process.env.EMAIL_USER ? process.env.EMAIL_USER.replace(/(.{3}).*(@.*)/, '$1***$2') : 'לא הוגדר',
      passwordSet: !!process.env.EMAIL_PASS
    },
    status: 'מוכן לשליחה',
    features: [
      'הזמנות קבוצתיות - התראת פתיחה',
      'תזכורות - שעה ו-10 דקות לפני סגירה', 
      'אישורי הזמנה אישיים',
      'התראת סגירת הזמנה',
      'תמיכה בעברית ו-RTL'
    ]
  });
}