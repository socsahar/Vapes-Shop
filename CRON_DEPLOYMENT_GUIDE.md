# 🤖 Railway Cron Setup Guide (Auto-Detection Method)

## ✅ **Railway Auto-Detects Cron Jobs!**

You're absolutely right! Railway is smart enough to detect cron jobs automatically. Here's the **much simpler** setup:

### 🚀 **Super Simple Setup:**

#### **Step 1: Your Package.json is Ready**
I just added a `cron` script to your `package.json`:
```json
{
  "scripts": {
    "cron": "node cron-general-orders.js"
  }
}
```

#### **Step 2: Railway Will Auto-Detect**
When you deploy, Railway should automatically:
- ✅ Detect the `cron` script
- ✅ Show the cron schedule option
- ✅ Use your existing environment variables
- ✅ Use your existing dependencies

#### **Step 3: Just Set the Timing**
In Railway's interface (the one you showed):
- **Cron Schedule**: `*/5 * * * *` (every 5 minutes)
- Railway will automatically run `npm run cron`

#### **Step 4: Deploy**
Push your code to GitHub, and Railway will:
- Build your project
- Detect the cron script
- Run it on your specified schedule

### 🎯 **What Railway Will Do:**
- **Detect**: `npm run cron` exists
- **Schedule**: Run it every 5 minutes (or whatever you set)
- **Execute**: `node cron-general-orders.js`
- **Environment**: Use your existing env vars
- **Dependencies**: Already installed from main project

### ✅ **Result:**
No separate projects needed! Railway runs the cron job as part of your existing deployment.

---

## 🧪 **Test First:**

Try this locally to make sure it works:
```bash
npm run cron
```

You should see: `🤖 Starting General Order Automation Cron...`

---

## 📋 **Final Steps:**

1. **Push to GitHub** (cron script is ready)
2. **Go to Railway** → Your project
3. **Set Cron Schedule**: `*/5 * * * *`
4. **Deploy and monitor logs**

**That's it! Much simpler than I initially thought!** 🚀

### ⚙️ **Cron Schedule Options**:

Choose based on how responsive you want the automation:

- **Every minute**: `* * * * *` (most responsive)
- **Every 5 minutes**: `*/5 * * * *` (recommended)
- **Every 10 minutes**: `*/10 * * * *` (less resource usage)

### 📊 **What Will Happen Automatically**:

✅ **Auto-Open Orders**: Scheduled orders open at their `opening_time`
✅ **Auto-Close Orders**: Orders close automatically at deadline  
✅ **Summary Emails**: Sent to all admins with PDF reports
✅ **Reminder Emails**: 1 hour & 10 minutes before deadline
✅ **Shop Management**: Opens/closes shop automatically
✅ **Email Processing**: Processes all queued emails

### 🔍 **Monitoring**:

- Check Railway logs to see: `🤖 Starting General Order Automation Cron...`
- Success: `✅ All automation tasks completed successfully`
- Errors: `❌ Error in cron job:`

### 🧪 **Testing** (Optional):

Run locally to verify setup:
```bash
node test-railway-cron.js
```

---

## 🎯 **The Complete Automation Flow**:

1. **Admin creates order** with future `opening_time` → Status: 'scheduled'
2. **Cron opens order** at scheduled time → Status: 'open', Shop opens
3. **Users participate** in the order
4. **Cron sends reminders** at 1 hour & 10 minutes before deadline
5. **Cron closes order** when deadline reached → Status: 'closed', Shop closes
6. **Summary emails** automatically sent to all admins with PDF reports

**Everything runs automatically - no manual intervention needed!** 🚀

---

## 📝 **Final Setup Summary**:

**Railway Dashboard → Your Project → "Cron Schedule"**
- Schedule: `*/5 * * * *`
- Command: `node cron-general-orders.js` 
- Save → Done! ✅

The system will handle everything else automatically!

## 🔧 Local Testing

### Test the cron job locally:
```bash
# Install dependencies
npm install node-cron @supabase/supabase-js dotenv

# Test single run
node cron-general-orders.js

# Run scheduler (Ctrl+C to stop)  
node cron-scheduler.js
```

## ⚙️ How It Works

### Auto-Opening Orders
- Checks for orders with status 'future' or 'scheduled'
- Opens orders when `opening_time` <= current time
- Updates order status to 'open'
- Opens the shop with the new order
- Sends opening notification emails

### Auto-Closing Orders  
- Checks for orders with status 'open'
- Closes orders when `deadline` <= current time
- Updates order status to 'closed'
- Closes the shop
- Queues closure and summary emails
- Processes email queue automatically

### Reminder System
- 1-hour reminder: Sent when deadline is 1 hour away
- 10-minute reminder: Sent when deadline is 10 minutes away
- Uses `reminder_1h_sent` and `reminder_10m_sent` flags to prevent duplicates
- Automatically processes queued reminder emails

### Email Processing
- All emails are queued in the `email_logs` table
- Cron job calls `/api/admin/email-service` to process queue
- Supports summary emails with PDF attachments
- Individual emails sent to all admin users

## 📊 Scheduling Future Orders

### Database Fields
- `opening_time`: TIMESTAMP - When to auto-open the order
- `status`: 'future' or 'scheduled' - Orders waiting to be opened
- `reminder_1h_sent`: BOOLEAN - 1-hour reminder tracking
- `reminder_10m_sent`: BOOLEAN - 10-minute reminder tracking

### Admin Panel Interface
The admin can schedule orders by:
1. Creating a general order with `opening_time` set in the future
2. Status will automatically be set to 'scheduled'
3. Order will open automatically at the scheduled time

## 🔍 Monitoring

### Logs to Watch
- Railway cron service logs show automation activity
- Look for: `✅ All automation tasks completed successfully`
- Errors will show: `❌ Error in cron job:`

### Database Monitoring
```sql
-- Check scheduled orders
SELECT id, title, status, opening_time, deadline 
FROM general_orders 
WHERE status IN ('scheduled', 'future', 'open')
ORDER BY opening_time;

-- Check email queue
SELECT id, recipient_email, subject, status, created_at
FROM email_logs 
WHERE status = 'failed' 
ORDER BY created_at DESC;
```

## 🚨 Troubleshooting

### Common Issues
1. **Environment Variables**: Make sure all env vars are set in Railway
2. **Database Connection**: Verify Supabase credentials are correct  
3. **Email Service**: Check RESEND_API_KEY is valid
4. **Site URL**: Ensure NEXT_PUBLIC_SITE_URL points to your deployed site

### Debugging
- Check Railway cron service logs
- Test individual script: `node cron-general-orders.js`
- Verify database schema has required fields
- Test email service endpoint manually

## 📈 Performance
- Runs every minute (lightweight operations)
- Only processes orders that need action
- Automatic email batching for efficiency
- Database queries are optimized with filters
- Error handling prevents service crashes

---

## 🎯 Next Steps After Deployment

1. **Deploy the cron service to Railway**
2. **Test with a scheduled order**
3. **Monitor logs for first 24 hours**
4. **Set up alerts for failures** (optional)
5. **Add admin panel scheduling UI** (optional enhancement)

The system is now fully automated and will handle all general order lifecycle management without any manual intervention! 🚀