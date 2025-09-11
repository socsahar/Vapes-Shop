# Railway Environment Variables Checklist

## Required Environment Variables for Production

Make sure these are set in your Railway project settings:

### 📧 Gmail SMTP Configuration
```
GMAIL_USER=sahargen7@gmail.com
GMAIL_APP_PASSWORD=feateszxhqnwiwcq
EMAIL_PASS=feateszxhqnwiwcq
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
```

### 🔐 Authentication
```
JWT_SECRET=vapes-shop-top-secure-jwt-secret-key-production-2025-very-long-string-for-security
NEXTAUTH_URL=https://vapes-shop.top
NEXTAUTH_SECRET=vapes-shop-top-nextauth-secret-production-2025-secure-key-for-authentication
```

### 🗄️ Supabase Database
```
NEXT_PUBLIC_SUPABASE_URL=https://wdgodtzlnbchykmyzehi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkZ29kdHpsbmJjaHlrbXl6ZWhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMzU3MDksImV4cCI6MjA2OTkxMTcwOX0.id1bLR_Gw_mXscU9PrwpMFvG2wU18gWosHKLIyPXdFg
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkZ29kdHpsbmJjaHlrbXl6ZWhpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDMzNTcwOSwiZXhwIjoyMDY5OTExNzA5fQ.Qoo6aFZ4hiJ7dVCIAgAzELfFfnn9ai3TFXKof0T9wUI
```

### 🌐 Site Configuration
```
NEXT_PUBLIC_BASE_URL=https://vapes-shop.top
NEXT_PUBLIC_SITE_URL=https://vapes-shop.top
NODE_ENV=production
ADMIN_EMAIL=sahargen7@gmail.com
APP_NAME="Vape Shop Israel"
APP_DESCRIPTION="The best vape shop in Israel"
CURRENCY=ILS
```

### 📨 Optional Email APIs (for fallback)
```
RESEND_API_KEY=   # Optional - leave empty if not using
SMTP2GO_API_KEY=  # Optional - leave empty if not using
```

## How to Set Environment Variables in Railway

1. Go to your Railway dashboard
2. Select your project
3. Go to the "Variables" tab
4. Add each variable one by one
5. Deploy your project

## Testing Email Functionality

After setting the variables, test emails using:
- Forgot password feature
- Admin panel email testing (in Settings)
- User registration (should send welcome email)

## Troubleshooting

If emails still don't work:
1. Check Railway logs for detailed error messages
2. Verify Gmail app password is exactly: `feateszxhqnwiwcq`
3. Make sure Gmail account has 2FA enabled
4. Ensure "Less secure app access" is disabled (use app password instead)