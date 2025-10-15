# Median App - Persistent Authentication Setup Guide

## Problem
Users are logged out every time they close and reopen the mobile app, even though we implemented cookie-based authentication.

## Root Cause
Median apps (and most mobile app wrappers) clear cookies and localStorage when the app is fully closed. This is normal mobile app behavior for privacy/security.

## Solution
Use **Median Native Storage API** which persists data permanently on the device, surviving app restarts and device reboots.

---

## ✅ What We've Already Done (Code Changes)

### 1. Updated `src/lib/authStorage.js`
Added Median native storage support with automatic fallback:
- **Median App**: Uses `window.median.nativeStorage` (most persistent)
- **Web Browser**: Uses cookies + localStorage (fallback)

The code now:
1. Detects if running in Median app
2. Stores authentication in Median native storage
3. Falls back to cookies/localStorage for web users
4. Retrieves from native storage first on app startup

### 2. Updated `src/lib/supabase.js`
Made authentication functions async to support Median's asynchronous native storage API:
- `getCurrentUser()` - now async
- `getAuthHeaders()` - now async
- `isUserAdmin()` - now async

---

## 🔧 What You Need to Do in Median Dashboard

### Step 1: Enable Native Storage
1. Go to [Median Dashboard](https://median.co/)
2. Select your app project
3. Go to **App Settings** → **Native Plugins**
4. Find **"Native Storage"** or **"Local Storage"**
5. **Enable** the Native Storage plugin
6. Click **Save**

### Step 2: Configure Storage Permissions
1. In the same **Native Plugins** section
2. Look for **Storage Permissions** or **Data Persistence**
3. Enable:
   - ✅ **Persistent Storage**
   - ✅ **Survive App Restarts**
   - ✅ **Survive Device Restarts**

### Step 3: Rebuild Your App
⚠️ **YES, you need to rebuild the Median app** for these changes to take effect:

1. In Median Dashboard, go to **Build** section
2. Click **"Create New Build"** or **"Rebuild App"**
3. Wait for the build to complete (usually 5-15 minutes)
4. Download the new APK
5. Install on test devices

---

## 🧪 How to Test

### Test 1: App Restart
1. Login to the app
2. Navigate around (to confirm you're logged in)
3. **Close the app completely** (swipe away from recent apps)
4. **Reopen the app**
5. ✅ **Expected**: User should still be logged in

### Test 2: Device Reboot
1. Login to the app
2. **Restart the phone completely**
3. Open the app after reboot
4. ✅ **Expected**: User should still be logged in

### Test 3: Logout
1. While logged in, click "Logout" button
2. ✅ **Expected**: User is logged out
3. Close and reopen app
4. ✅ **Expected**: User should see login screen

---

## 📝 Technical Details

### Median Native Storage API
```javascript
// Store data (persists permanently)
window.median.nativeStorage.set({
    key: 'vape_shop_user',
    value: JSON.stringify(userData)
});

// Retrieve data (async)
window.median.nativeStorage.get({
    key: 'vape_shop_user',
    callback: (value) => {
        const user = JSON.parse(value);
        console.log('User restored:', user);
    }
});

// Remove data
window.median.nativeStorage.remove({
    key: 'vape_shop_user'
});
```

### What Gets Stored
When a user logs in, we store:
- `vape_shop_user` - Full user object (id, username, email, role, etc.)
- `vape_shop_auth` - Authentication flag ('true')
- `vape_shop_user_id` - User ID (for quick checks)
- `vape_shop_auth_time` - Login timestamp (for session expiry checks)

All data is stored in:
1. **Median native storage** (if available) - survives everything
2. **localStorage** (backup) - cleared on app uninstall
3. **Cookies** (web fallback) - for browser testing

---

## 🔍 Debugging

### Check if Native Storage is Working

Add this to your browser console (or in the app):
```javascript
// Check if Median native storage is available
if (window.median && window.median.nativeStorage) {
    console.log('✅ Median native storage is available');
    
    // Test store
    window.median.nativeStorage.set({
        key: 'test_key',
        value: 'test_value'
    });
    
    // Test retrieve
    window.median.nativeStorage.get({
        key: 'test_key',
        callback: (value) => {
            console.log('Retrieved value:', value);
        }
    });
} else {
    console.log('❌ Median native storage NOT available');
    console.log('Using fallback: localStorage + cookies');
}
```

### Check Console Logs
When the app loads, you should see:
- `✅ User session restored from Median native storage` (in Median app)
- OR `✅ User session restored from localStorage` (in browser)

When user logs in:
- `✅ User session stored in Median native storage`
- `✅ User session stored successfully (all methods)`

---

## 🚀 Deployment Checklist

- [x] Code updated in `src/lib/authStorage.js`
- [x] Code updated in `src/lib/supabase.js`
- [x] Code committed to GitHub
- [x] Code pushed to Railway (auto-deployed)
- [ ] **Native Storage enabled in Median Dashboard**
- [ ] **Median app rebuilt with new configuration**
- [ ] **New APK downloaded and installed on test devices**
- [ ] **Tested: Login → Close App → Reopen → Still Logged In**

---

## 🆘 Troubleshooting

### Issue: Still logging out after rebuild
**Solution:**
1. Uninstall the old app completely
2. Install the fresh APK
3. Clear app data: Settings → Apps → Your App → Clear Data
4. Try login again

### Issue: "window.median is undefined"
**Solution:**
- Native Storage plugin not enabled in Median Dashboard
- App not rebuilt after enabling plugin
- Using old APK (need to install new one)

### Issue: Works on some devices, not others
**Solution:**
- Make sure all devices have the **latest rebuilt APK**
- Old APK doesn't have native storage support
- Uninstall old app, install new one

### Issue: Works in browser, not in app
**Solution:**
- This is expected - browser uses localStorage/cookies
- App needs native storage enabled in Median Dashboard
- Rebuild the app with native storage plugin

---

## 📚 Additional Resources

- [Median Native Storage Documentation](https://median.co/docs/native-plugins/storage/)
- [Median Dashboard](https://median.co/)
- [GoNative Native Storage API](https://gonative.io/docs/native-storage) (Median uses GoNative engine)

---

## ✨ Summary

**Without Median Native Storage:**
❌ Login → Close App → Reopen → **Logged Out**

**With Median Native Storage:**
✅ Login → Close App → Reopen → **Still Logged In**
✅ Login → Restart Device → Reopen → **Still Logged In**

The code is ready. You just need to:
1. Enable Native Storage in Median Dashboard
2. Rebuild the app
3. Install new APK
4. Test!
