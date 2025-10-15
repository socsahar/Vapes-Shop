# 🔴 OneSignal Android Push Notifications - Complete Fix Guide

## Problem Summary
- ✅ OneSignal is integrated in code
- ✅ Users appear as "subscribed" in OneSignal dashboard
- ❌ Notifications show "0 users" sent
- ❌ Users never receive notifications
- ❌ OneSignal dashboard shows: **"Invalid Google Project Number"**

## Root Causes
1. **Missing Firebase Cloud Messaging (FCM) configuration**
2. **Wrong payload field in code** (`message` instead of `body`)
3. **Median app needs Firebase Sender ID**

---

## ✅ SOLUTION 1: Configure Firebase Cloud Messaging

### Why This is Needed:
Android push notifications require **Firebase Cloud Messaging (FCM)**. OneSignal uses FCM to deliver notifications to Android devices.

### Step-by-Step Instructions:

#### Step 1: Get Firebase Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)

2. **If you don't have a Firebase project:**
   - Click "Add project"
   - Name it "Vape Shop" or similar
   - Accept terms and click "Continue"
   - Disable Google Analytics (optional) or configure it
   - Click "Create project"
   - Wait for project to be created
   - Click "Continue"

3. **If you already have a Firebase project:**
   - Select your existing project

4. **Get the required credentials:**
   - Click the **⚙️ Settings** icon (top left)
   - Click **"Project settings"**
   - Go to **"Cloud Messaging"** tab
   - You'll see two important values:
     - **Server Key** (starts with `AAAA...`) - Long key
     - **Sender ID** (numeric like `123456789012`)
   - **Copy both values** - you'll need them!

5. **If Cloud Messaging API is disabled:**
   - You might see a message saying "Cloud Messaging API is disabled"
   - Click the **"Enable"** button
   - Wait for it to enable (takes ~1 minute)
   - Refresh the page
   - Now you should see the Server Key and Sender ID

#### Step 2: Configure OneSignal with Firebase

1. Go to [OneSignal Dashboard](https://onesignal.com/)

2. Click on your app: **"Vapes-Shop"**

3. Click **⚙️ Settings** (left sidebar)

4. Click **"Platforms"** tab

5. Find **"Google Android (FCM)"** section

6. Click **"Configure"** or **"Edit"**

7. Paste the credentials you copied:
   ```
   Firebase Server Key: AAAA........................(long key from Firebase)
   Firebase Sender ID: 123456789012 (numeric ID from Firebase)
   ```

8. Click **"Save"**

9. You should see: ✅ **"Google Android FCM Configured"**

#### Step 3: Update Median App Configuration

1. Go to [Median Dashboard](https://median.co/)

2. Select your **Vapes-Shop** app

3. Go to **"Push Notifications"** section

4. Make sure:
   - ✅ Push Notifications are **Enabled**
   - ✅ Provider is set to **"OneSignal"**
   - ✅ OneSignal App ID: `fb7835a3-68b7-4cf6-8882-483a28989b5f`

5. **IMPORTANT - Add Firebase Sender ID:**
   - Look for **"Firebase Sender ID"** or **"GCM/FCM Sender ID"** field
   - Paste the **Sender ID** (numeric) you got from Firebase
   - Example: `123456789012`

6. Click **"Save"**

#### Step 4: Rebuild Median App

1. In Median Dashboard, go to **"Build"** section

2. Click **"Create New Build"**

3. Wait for build to complete (~5-15 minutes)

4. Download the new **APK file**

5. **IMPORTANT:** 
   - Uninstall the old app from all test devices
   - Install the new APK
   - This ensures devices register with the new Firebase configuration

---

## ✅ SOLUTION 2: Code Fixes (Already Applied)

### Fixed Issues:
1. ✅ Changed `message` to `body` in notification payload
2. ✅ Added detailed error logging
3. ✅ Fixed v2 API key authentication (Bearer token)

### What Changed:
```javascript
// BEFORE (Wrong):
const oneSignalResponse = await oneSignal.sendNotification({
    title: insertedNotification.title,
    message: insertedNotification.body,  // ❌ Wrong field name
    ...
});

// AFTER (Fixed):
const oneSignalResponse = await oneSignal.sendNotification({
    title: insertedNotification.title,
    body: insertedNotification.body,  // ✅ Correct field name
    ...
});
```

---

## 🧪 Testing Steps

### Test 1: Verify Firebase Configuration

1. Go to OneSignal Dashboard → Settings → Platforms
2. Check **"Google Android (FCM)"** section
3. ✅ Should show: "Configured" with green checkmark
4. ❌ Should NOT show: "Invalid Google Project Number"

### Test 2: Test User Subscription

1. Install the rebuilt app on a test device
2. Open the app (this triggers OneSignal registration)
3. Go to OneSignal Dashboard → **Audience** → **All Users**
4. Find the test device subscription
5. Click on it to view details
6. ✅ Status should show: **"Subscribed"** (not "Never Subscribed")
7. ✅ Should NOT show: "Invalid Google Project Number" error

### Test 3: Send Test Notification

1. After Railway redeploys (automatic after git push)
2. Go to your admin panel: `https://vapes-shop.top/admin`
3. Click **"התראות"** (Notifications) tab
4. Create a test notification:
   - **Title:** "בדיקה" (Test)
   - **Message:** "זוהי הודעת בדיקה" (This is a test message)
   - **Audience:** "כל המשתמשים" (All users)
5. Click **"שלח עכשיו"** (Send Now)
6. ✅ Should see: **"נשלח בהצלחה ל-5 משתמשים!"** (Success to 5 users)
7. ❌ Should NOT see: **"0 משתמשים"** (0 users)
8. ✅ **Check phones** - notification should appear!

### Test 4: Check Notification in OneSignal Dashboard

1. Go to OneSignal Dashboard
2. Click **"Messages"** → **"All Messages"**
3. Find your test notification
4. Click on it
5. ✅ Check stats:
   - **Sent:** Should show 5 (or however many subscribed users)
   - **Delivered:** Should increase as notifications are delivered
   - **Clicked:** Will increase if users click the notification

---

## 🔍 Debugging

### Issue: Still shows "Invalid Google Project Number"

**Causes:**
- Firebase Server Key not added to OneSignal
- Firebase Sender ID not added to Median
- Cloud Messaging API not enabled in Firebase

**Solution:**
1. Double-check Firebase Console → Cloud Messaging tab
2. Make sure you copied the **Server Key** (long AAAA... key)
3. Make sure you copied the **Sender ID** (numeric)
4. Make sure both are pasted correctly in OneSignal
5. Make sure Sender ID is also in Median configuration
6. Rebuild Median app after any changes

### Issue: Still shows "0 users" sent

**Causes:**
- Railway hasn't redeployed with code fix yet
- API still using old code with `message` instead of `body`

**Solution:**
1. Check Railway dashboard - look for recent deployment
2. Wait for deployment to complete
3. Check deployment logs for errors
4. Try sending notification again after deployment completes

### Issue: Users subscribed but not receiving notifications

**Causes:**
- Using old APK without Firebase configuration
- Firebase Sender ID missing from Median
- App not rebuilt after Firebase configuration

**Solution:**
1. Uninstall old app completely from devices
2. Install newly built APK (after Firebase config)
3. Open app (triggers new OneSignal registration)
4. Check OneSignal dashboard - device should re-register
5. Try sending notification again

---

## 📋 Checklist - Complete This in Order

### Firebase Setup:
- [ ] Created Firebase project (or selected existing one)
- [ ] Enabled Cloud Messaging API
- [ ] Copied **Server Key** (AAAA...)
- [ ] Copied **Sender ID** (numeric)

### OneSignal Configuration:
- [ ] Logged into OneSignal Dashboard
- [ ] Went to Settings → Platforms → Google Android (FCM)
- [ ] Pasted Firebase Server Key
- [ ] Pasted Firebase Sender ID
- [ ] Clicked Save
- [ ] Verified status shows "Configured" ✅

### Median Configuration:
- [ ] Logged into Median Dashboard
- [ ] Went to Push Notifications section
- [ ] Verified OneSignal App ID is correct
- [ ] Added Firebase Sender ID to Median
- [ ] Clicked Save

### App Rebuild:
- [ ] Created new build in Median
- [ ] Waited for build to complete
- [ ] Downloaded new APK
- [ ] Uninstalled old app from test devices
- [ ] Installed new APK on test devices

### Code Deployment:
- [ ] Code changes committed to GitHub ✅
- [ ] Code pushed to GitHub ✅
- [ ] Railway auto-deployed (check Railway dashboard)
- [ ] Deployment completed successfully

### Testing:
- [ ] Opened rebuilt app on test device
- [ ] Checked OneSignal dashboard - user shows "Subscribed"
- [ ] No "Invalid Google Project Number" error
- [ ] Sent test notification from admin panel
- [ ] Success message shows correct user count (not 0)
- [ ] Notification appeared on test device ✅

---

## 📱 What to Expect After Fix

### Before Fix:
❌ "נשלח בהצלחה ל-0 משתמשים!" (0 users)
❌ No notifications received
❌ OneSignal dashboard shows "Invalid Google Project Number"
❌ Users show "Never Subscribed"

### After Fix:
✅ "נשלח בהצלחה ל-5 משתמשים!" (5 users or actual count)
✅ Notifications appear on phones instantly
✅ OneSignal dashboard shows "Subscribed" status
✅ No Firebase errors
✅ Delivery statistics show in OneSignal dashboard

---

## 🆘 Still Not Working?

If you've completed all steps and it's still not working:

1. **Take screenshots of:**
   - Firebase Cloud Messaging page (with Server Key visible)
   - OneSignal Platform Configuration page
   - Median Push Notifications configuration
   - OneSignal user subscription status (the page you showed)
   - Admin panel after sending notification
   - Railway deployment logs

2. **Check Railway logs:**
   - Go to Railway dashboard
   - Click on your service
   - Check **"Deployments"** tab
   - Look for errors in deployment logs
   - Look for OneSignal API responses in logs

3. **Check console logs in admin panel:**
   - Open browser developer tools (F12)
   - Go to Console tab
   - Send a test notification
   - Look for OneSignal API responses
   - Share any error messages

---

## 📚 Additional Resources

- [Firebase Console](https://console.firebase.google.com/)
- [OneSignal Dashboard](https://onesignal.com/)
- [Median Dashboard](https://median.co/)
- [OneSignal Android FCM Setup Guide](https://documentation.onesignal.com/docs/android-sdk-setup)
- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)

---

## Summary

The main issue is that **Android push notifications require Firebase Cloud Messaging**. Even though OneSignal is configured, it needs Firebase credentials to actually deliver notifications to Android devices.

**Quick Fix:**
1. Get Firebase Server Key + Sender ID
2. Add both to OneSignal
3. Add Sender ID to Median
4. Rebuild app
5. Reinstall on devices
6. Test notifications

After these steps, you should see actual recipient counts and notifications will be delivered to users' phones! 🚀
