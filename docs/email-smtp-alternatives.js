// Alternative SMTP Configurations for Email Service

// 1. Gmail (Current Setup)
const gmailTransporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // App Password required
  },
});

// 2. Outlook/Hotmail
const outlookTransporter = nodemailer.createTransporter({
  service: 'hotmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// 3. Yahoo Mail
const yahooTransporter = nodemailer.createTransporter({
  service: 'yahoo',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// 4. SendGrid (Professional Service)
const sendgridTransporter = nodemailer.createTransporter({
  host: 'smtp.sendgrid.net',
  port: 587,
  secure: false,
  auth: {
    user: 'apikey',
    pass: process.env.SENDGRID_API_KEY,
  },
});

// 5. Mailgun (Professional Service)
const mailgunTransporter = nodemailer.createTransporter({
  host: 'smtp.mailgun.org',
  port: 587,
  secure: false,
  auth: {
    user: process.env.MAILGUN_SMTP_USER,
    pass: process.env.MAILGUN_SMTP_PASS,
  },
});

// 6. AWS SES (Amazon)
const sesTransporter = nodemailer.createTransporter({
  host: 'email-smtp.us-east-1.amazonaws.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.AWS_SES_USER,
    pass: process.env.AWS_SES_PASS,
  },
});

// 7. Custom SMTP Server
const customTransporter = nodemailer.createTransporter({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// For Hebrew emails, ensure proper encoding
const hebrewTransporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  defaults: {
    encoding: 'utf-8',
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
    },
  },
});