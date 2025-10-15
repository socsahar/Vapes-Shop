# 🚂 Railway Environment Variables

## Push Notifications Update

Add these **2 new environment variables** to your Railway project:

---

## 📝 New Variables to Add:

### 1. **ONESIGNAL_APP_ID**
```
fb7835a3-68b7-4cf6-8882-483a28989b5f
```

### 2. **ONESIGNAL_REST_API_KEY**
```
os_v2_app_7n4dli3iw5gpncecja5crge3l5egnk3kadqeg2f6jo5pb5snjctrgmcnjag3gsp2jtweetll2dvwyrqkfomfae24sksvhgmme2dscta
```

---

## 🔧 How to Add in Railway:

1. Go to your Railway project dashboard
2. Click on your **vapes-shop** service
3. Go to **Variables** tab
4. Click **+ New Variable** for each:
   - Name: `ONESIGNAL_APP_ID`
   - Value: `fb7835a3-68b7-4cf6-8882-483a28989b5f`
   
   - Name: `ONESIGNAL_REST_API_KEY`
   - Value: `os_v2_app_7n4dli3iw5gpncecja5crge3l5egnk3kadqeg2f6jo5pb5snjctrgmcnjag3gsp2jtweetll2dvwyrqkfomfae24sksvhgmme2dscta`

5. Click **Save** or **Deploy** (Railway may auto-redeploy)

---

## ✅ Complete Environment Variables List

Here's your **FULL** Railway environment configuration:

### Supabase
```env
NEXT_PUBLIC_SUPABASE_URL=https://wdgodtzlnbchykmyzehi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkZ29kdHpsbmJjaHlrbXl6ZWhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMzU3MDksImV4cCI6MjA2OTkxMTcwOX0.id1bLR_Gw_mXscU9PrwpMFvG2wU18gWosHKLIyPXdFg
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkZ29kdHpsbmJjaHlrbXl6ZWhpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDMzNTcwOSwiZXhwIjoyMDY5OTExNzA5fQ.Qoo6aFZ4hiJ7dVCIAgAzELfFfnn9ai3TFXKof0T9wUI
```

### Email (Resend)
```env
RESEND_API_KEY=re_7UtfZJbQ_ANJisjmzM2kvVxKiw3hnF8Y8
```

### Gmail (Backup)
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
GMAIL_USER=sahargen7@gmail.com
GMAIL_APP_PASSWORD=feateszxhqnwiwcq
EMAIL_PASS=feateszxhqnwiwcq
EMAIL_PASSWORD=feateszxhqnwiwcq
```

### Authentication
```env
JWT_SECRET=vapes-shop-top-secure-jwt-secret-key-production-2025-very-long-string-for-security
NEXTAUTH_URL=https://vapes-shop.top
NEXTAUTH_SECRET=vapes-shop-top-nextauth-secret-production-2025-secure-key-for-authentication
```

### App Configuration
```env
NEXT_PUBLIC_BASE_URL=https://vapes-shop.top
NEXT_PUBLIC_SITE_URL=https://vapes-shop.top
NODE_ENV=production
APP_NAME=Vape Shop Israel
APP_DESCRIPTION=The best vape shop in Israel
CURRENCY=ILS
ADMIN_EMAIL=sahargen7@gmail.com
```

### **🆕 Push Notifications (OneSignal)**
```env
ONESIGNAL_APP_ID=fb7835a3-68b7-4cf6-8882-483a28989b5f
ONESIGNAL_REST_API_KEY=os_v2_app_7n4dli3iw5gpncecja5crge3l5egnk3kadqeg2f6jo5pb5snjctrgmcnjag3gsp2jtweetll2dvwyrqkfomfae24sksvhgmme2dscta
```

---

## 🚀 After Adding Variables:

1. **Railway will auto-redeploy** your app
2. Wait for deployment to complete (~2-3 minutes)
3. Push notifications will be active on production!
4. Test by:
   - Going to admin panel → Notifications tab
   - Sending a test notification
   - Checking OneSignal dashboard for delivery stats

---

## 📱 Next Steps:

### On Production Website:
✅ Push notifications API is live
✅ Admin can send notifications from dashboard
✅ Database tracks notification history

### On Median App:
1. Rebuild app with OneSignal enabled
2. Install on device
3. User appears in OneSignal dashboard
4. Send test notification from admin panel
5. User receives notification on phone!

---

## 🔒 Security Notes:

- ✅ All API keys are secure in Railway
- ✅ Never commit `.env.local` to git (it's in `.gitignore`)
- ✅ OneSignal REST API Key is for server-side only
- ✅ App ID is public-safe (used in Median app)

---

## 💡 Troubleshooting:

### If notifications don't work after deployment:

1. **Check Railway logs:**
   ```
   Railway Dashboard → Deployments → View Logs
   ```

2. **Verify variables are set:**
   ```
   Railway → Variables tab
   Should see ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY
   ```

3. **Test OneSignal directly:**
   - Go to OneSignal dashboard
   - Send test notification from there
   - If it works, integration is correct

4. **Check admin panel:**
   - Go to https://vapes-shop.top/admin
   - Notifications tab should be visible
   - Try sending a test notification

---

**Everything is committed and pushed to GitHub!** 🎉

Your production site will automatically update when Railway detects the new commit.
