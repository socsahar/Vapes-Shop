# 🔔 Push Notifications Admin Guide

## Overview
The push notifications system allows you to send notifications to your mobile app users directly from the admin panel.

## Location
**Admin Panel → 🔔 התראות פוש (Push Notifications tab)**

## Features

### 1. **Statistics Dashboard**
View real-time stats about your notifications:
- 📊 Total Notifications Sent
- ✅ Successfully Sent
- ⏰ Scheduled Notifications
- 📲 Delivered to Users
- 👆 Click Rate

### 2. **Send New Notification**
Click the **"🔔 שלח התראה חדשה"** (Send New Notification) button to open the notification composer.

### 3. **Notification Composer**
The composer includes:

#### **Pre-built Templates:**
- 🛍️ New Products Announcement
- 📦 Group Order Opened
- ⏰ Group Order Reminder
- 📋 Order Status Update
- 🔥 Special Offer
- 🏪 Shop Opening
- 🔒 Shop Closing Soon
- 👋 Welcome New User
- 📉 Low Stock Alert
- ✏️ Custom Message

#### **Fields:**
- **Title** (max 50 characters) - Eye-catching headline
- **Message** (max 200 characters) - Full notification content
- **Audience Target:**
  - 🌐 All Users
  - 👥 Specific Users (select from list)
  - 👑 Admins Only
- **Icon** (optional) - Emoji or image URL
- **Link** (optional) - Where users go when they tap (e.g., /shop)
- **Schedule** (optional) - Send immediately or schedule for later

#### **Live Preview:**
See how your notification will look on users' devices before sending!

### 4. **Notification History**
View all sent and scheduled notifications with:
- Full notification content
- Audience size
- Delivery statistics
- Click-through rates
- Status (Sent/Scheduled/Failed)

### 5. **Quick Actions**
- 🔄 Refresh notifications list
- 🗑️ Delete notification from history

## Use Cases

### Example 1: New Product Launch
```
Title: 🎉 מוצרים חדשים הגיעו לחנות!
Message: בואו לבדוק את המוצרים החדשים שהגיעו אלינו השבוע
Audience: All Users
Link: /shop
```

### Example 2: Group Order Reminder
```
Title: ⏰ הזמנה קבוצתית נסגרת בקרוב!
Message: נותרו 30 דקות עד סגירת ההזמנה הקבוצתית
Audience: Specific Users (who haven't ordered yet)
Schedule: 30 minutes before deadline
```

### Example 3: Flash Sale
```
Title: 🔥 הצעה מיוחדת רק לכם!
Message: זה הזמן לחסוך! הנחות של עד 30% על מוצרים נבחרים
Audience: All Users
Link: /shop
Icon: 🔥
```

## Technical Details

### API Endpoints Created:
- `GET /api/admin/notifications` - Fetch notifications and stats
- `POST /api/admin/notifications` - Send new notification
- `DELETE /api/admin/notifications` - Delete notification
- `GET /api/admin/notifications/templates` - Get pre-built templates
- `GET /api/admin/notifications/users` - Get users list for targeting

### Current Implementation:
This is a **demo interface** showing you how the push notification system will work. 

To make it fully functional with real mobile apps, you'll need to integrate:
1. **Firebase Cloud Messaging (FCM)** for Android & iOS
2. **OneSignal** (easier, cross-platform)
3. **Web Push API** for PWA notifications

### Next Steps for Production:
1. Choose a notification service (FCM or OneSignal recommended)
2. Update the API routes to use the real service
3. Add device token registration in your mobile app
4. Test notifications on real devices

## Troubleshooting

### Can't see the Notifications tab?
1. Hard refresh your browser (Ctrl + Shift + R)
2. Clear browser cache
3. Try incognito/private mode
4. Check that you're logged in as admin

### Notifications showing but not real?
- Currently using mock data for demonstration
- Integrate with FCM/OneSignal for production use

## Benefits

✅ **Instant Communication** - Reach users immediately
✅ **Targeted Messaging** - Send to specific user groups
✅ **Scheduled Delivery** - Plan notifications ahead
✅ **Analytics** - Track delivery and engagement
✅ **Templates** - Quick access to common messages
✅ **Preview** - See before you send

---

**Need help?** The notifications system is ready to integrate with your mobile app!
