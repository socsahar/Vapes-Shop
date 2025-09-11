# Email Service Setup Guide

## Current Status
🔄 **Email system is currently in simulation mode** - emails are logged but not actually sent.

To enable real email delivery, configure one of the email service providers below.

## Email Service Providers

### Option 1: Resend (Recommended) 🌟
**Pros:** Easy setup, good free tier, modern API
**Free tier:** 100 emails/day, 3,000 emails/month

1. Sign up at [resend.com](https://resend.com)
2. Get your API key from the dashboard
3. Add to Railway environment variables:
   ```
   RESEND_API_KEY=re_your_api_key_here
   ```

### Option 2: SMTP2GO
**Pros:** Reliable SMTP service, good delivery rates
**Free tier:** 1,000 emails/month

1. Sign up at [smtp2go.com](https://smtp2go.com)
2. Get your API key from the dashboard
3. Add to Railway environment variables:
   ```
   SMTP2GO_API_KEY=api-your_api_key_here
   ```

### Option 3: SendGrid
**Pros:** Industry standard, reliable
**Free tier:** 100 emails/day

1. Sign up at [sendgrid.com](https://sendgrid.com)
2. Create an API key with mail send permissions
3. Add to Railway environment variables:
   ```
   SENDGRID_API_KEY=SG.your_api_key_here
   ```

### Option 4: EmailJS (Client-side)
**Pros:** No server configuration needed
**Free tier:** 200 emails/month

1. Sign up at [emailjs.com](https://emailjs.com)
2. Get your public key, service ID, and template ID
3. Add to Railway environment variables:
   ```
   EMAILJS_PUBLIC_KEY=your_public_key_here
   EMAILJS_SERVICE_ID=your_service_id_here
   EMAILJS_TEMPLATE_ID=your_template_id_here
   ```

## Setting Environment Variables in Railway

1. Go to your Railway project dashboard
2. Click on your service
3. Go to the "Variables" tab
4. Add the environment variable for your chosen email service
5. Deploy the changes

## Testing Email Setup

### Option 1: Admin Panel (Recommended)
1. Go to the admin panel in your app
2. Navigate to the email testing section
3. Choose an email type and enter a test recipient
4. Send a test email
5. Check the logs to see which service was used

### Option 2: Forgot Password Feature
1. Use the "Forgot Password" feature on the login page
2. Check if you receive the actual email
3. Look at the Railway logs to see the email status

## Current Email Flow

The system tries email services in this order:

1. **Real Email Service** (`/api/real-email`)
   - Tries Resend API (if `RESEND_API_KEY` is set)
   - Falls back to SMTP2GO API (if `SMTP2GO_API_KEY` is set)
   - Falls back to EmailJS (if EmailJS keys are set)
   - Falls back to simulation mode

2. **Simple Email Service** (`/api/simple-email`) - Fallback
   - Tries HTTP-based email sending
   - Falls back to simulation mode

## Troubleshooting

### Check Email Service Status
Look for these messages in Railway logs:

✅ **Success:** "Email sent successfully via [service_name]"
⚠️ **Simulation:** "EMAIL IN SIMULATION MODE - User will not receive actual email"
❌ **Error:** "Both email services failed"

### Common Issues

1. **API Key not set:** Service falls back to simulation
2. **Invalid API key:** Error in logs, falls back to next service
3. **Rate limiting:** Check your provider's limits
4. **Domain verification:** Some providers require sender domain verification

### Email Templates

All email templates support:
- ✅ Hebrew RTL (right-to-left) layout
- ✅ UTF-8 encoding for Hebrew text
- ✅ Responsive design
- ✅ Modern HTML styling

Email types available:
- Password reset
- Welcome emails
- Order confirmations
- General test emails

## Security Notes

- Never commit API keys to the repository
- Use Railway environment variables for all sensitive data
- API keys should have minimal required permissions
- Monitor email usage to avoid unexpected charges

## Next Steps

1. **Choose an email service provider** (Resend recommended for ease of use)
2. **Sign up and get API key**
3. **Add environment variable to Railway**
4. **Test using admin panel**
5. **Verify real emails are being sent**

---

*Last updated: ${new Date().toLocaleDateString('en-US')}*