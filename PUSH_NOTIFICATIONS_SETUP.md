# 📱 Push Notifications Setup for Median App

## Overview
Your vape shop website is wrapped in a Median app for Android (and soon iOS). This guide explains how to enable real push notifications.

---

## 🚀 Quick Setup (Recommended: OneSignal)

### Step 1: Create OneSignal Account
1. Go to https://onesigal.com and create a free account
2. Click **"New App/Website"**
3. Enter name: **"Vape Shop Israel"**
4. Select **"Android"** (and iOS later)

### Step 2: Configure Android
1. In OneSignal dashboard, go to **Settings → Platforms**
2. Click **"Google Android (FCM)"**
3. You'll need Firebase credentials (OneSignal guides you through this)
4. Or use OneSignal's automatic setup (easier!)

### Step 3: Get Your Keys
From OneSignal dashboard, copy:
- **App ID** (e.g., `a1b2c3d4-e5f6-...`)
- **REST API Key** (Settings → Keys & IDs)

### Step 4: Add to Your .env.local
```bash
# OneSignal Configuration
ONESIGNAL_APP_ID=your_app_id_here
ONESIGNAL_REST_API_KEY=your_rest_api_key_here
```

### Step 5: Configure Median
1. Log in to your **Median dashboard**
2. Go to **App Configuration → Push Notifications**
3. Select **"OneSignal"**
4. Enter your **OneSignal App ID**
5. Save and **rebuild your app**

### Step 6: Update the Notification API
The OneSignal integration is already coded! Just need to connect it:

1. Update `/api/admin/notifications/route.js` to use OneSignal
2. Test by sending a notification from admin panel
3. It will be sent via OneSignal to all app users!

---

## 📋 How It Works

### User Flow:
```
1. Admin sends notification from website
   ↓
2. Server calls OneSignal API
   ↓
3. OneSignal sends to user devices
   ↓
4. User taps notification
   ↓
5. Median app opens to specified URL
```

### Example Notification:
```javascript
{
  title: "🎉 מוצרים חדשים הגיעו!",
  body: "בואו לראות את הקולקציה החדשה שלנו",
  url: "/shop",
  icon: "🛍️",
  audience: "all" // or "specific_users" or "admins_only"
}
```

---

## 🎯 Advanced Features

### User Segmentation
Tag users in OneSignal by:
- **Role:** customer, admin
- **Last Order:** date
- **Preferences:** product categories
- **Location:** city

### Automated Triggers
Set up automatic notifications:
- Welcome message when user installs app
- Cart abandonment reminders
- Order status updates
- New product launches

### A/B Testing
Test different notification messages to see which performs better

### Analytics
Track:
- Delivery rate
- Open rate
- Click-through rate
- Conversion rate

---

## 💡 Best Practices

### Timing
- ⏰ Send during business hours (10 AM - 8 PM)
- 📅 Avoid Shabbat/holidays
- 🎯 Test different times to find best engagement

### Content
- ✅ Keep titles under 50 characters
- ✅ Messages under 200 characters
- ✅ Use emojis for attention
- ✅ Clear call-to-action
- ❌ Don't spam (max 1-2 per day)

### URLs
Always include a deep link:
- `/shop` - Browse products
- `/orders` - View orders
- `/shop?promo=FLASH30` - Special offers
- `/shop?product=123` - Specific product

---

## 🔧 Technical Details

### OneSignal Player IDs
When users install your Median app, OneSignal automatically:
1. Generates a unique Player ID
2. Subscribes them to notifications
3. You can link this to your user database

### Linking Users
In your app initialization:
```javascript
// When user logs in, set their external ID
OneSignal.setExternalUserId(user.id);
```

This lets you send notifications to specific users by their database ID!

### Deep Linking
Median automatically handles URLs in notifications:
- Relative URLs: `/shop` → Opens in app
- Absolute URLs: `https://vapes-shop.top/shop` → Opens in app
- Parameters: `/shop?promo=SALE` → Passes to page

---

## 📊 Integration Checklist

- [ ] Create OneSignal account
- [ ] Configure Android platform
- [ ] Get App ID and REST API Key
- [ ] Add keys to .env.local
- [ ] Configure in Median dashboard
- [ ] Rebuild Median app
- [ ] Connect OneSignal service to notification API
- [ ] Test notification send
- [ ] Verify notification received on Android
- [ ] Track analytics

---

## 🆘 Troubleshooting

### Notifications not received?
1. Check OneSignal dashboard → Audience → All Users (any subscribed users?)
2. Verify App ID is correct in Median
3. Ensure app has notification permissions
4. Check device notification settings

### Can't send notifications?
1. Verify REST API Key is correct
2. Check server logs for errors
3. Test OneSignal API directly from dashboard

### Notifications received but don't open app?
1. Check URL format in notification
2. Verify deep linking in Median settings
3. Test with simple URL like `/shop`

---

## 📱 Next Steps

1. **Set up OneSignal** (30 minutes)
2. **Configure Median** (15 minutes)
3. **Test notifications** (10 minutes)
4. **Plan notification campaigns** (ongoing)

Once set up, you'll be able to:
- ✅ Send instant notifications
- ✅ Schedule future notifications
- ✅ Target specific user groups
- ✅ Track engagement metrics
- ✅ Automate marketing campaigns

---

## 💰 Pricing

**OneSignal Free Plan includes:**
- Unlimited devices
- Unlimited notifications
- Advanced segmentation
- Rich media messages
- Real-time analytics

Perfect for your vape shop! 🎉

---

**Need help?** Contact OneSignal support or check their docs: https://documentation.onesignal.com
