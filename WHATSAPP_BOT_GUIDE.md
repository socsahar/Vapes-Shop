# 🤖 WhatsApp Bot - Complete Setup Guide

## 📋 Table of Contents
1. [Overview](#overview)
2. [Features](#features)
3. [Prerequisites](#prerequisites)
4. [Installation](#installation)
5. [Configuration](#configuration)
6. [Setup Steps](#setup-steps)
7. [Admin Commands](#admin-commands)
8. [Troubleshooting](#troubleshooting)
9. [Architecture](#architecture)

---

## Overview

The WhatsApp Bot system integrates seamlessly with your vape shop to provide automated notifications via WhatsApp using the Baileys library. The bot sends group announcements and private order confirmations, and accepts admin commands.

### Key Capabilities
- ✅ **Group Announcements** - Broadcasts to designated WhatsApp group
- ✅ **Private Order Confirmations** - Sends personalized order details
- ✅ **Automated Reminders** - 1 hour and 30 minutes before order closing
- ✅ **Admin Commands** - Control system via WhatsApp messages
- ✅ **Dual Phone Support** - Works with both Israeli formats (+972 and 05)
- ✅ **Message Queue** - Reliable delivery with retry logic
- ✅ **Activity Logging** - Complete audit trail in database

---

## Features

### 📢 Automated Announcements

#### 1. Order Opened
When a new general order opens:
```
🎉 *הזמנה קבוצתית חדשה נפתחה!*

📦 *[Order Title]*

📝 [Description]

⏰ *תאריך סגירה:* [Date/Time]

🛒 להזמנה היכנסו לאתר:
https://vapes-shop.top/shop

⚡ אל תפספסו - מלאי מוגבל!
```

#### 2. 1 Hour Reminder
```
⏰ *תזכורת - ההזמנה נסגרת בעוד שעה!*

📦 *[Order Title]*

⚠️ זה הזמן האחרון להזמין!
```

#### 3. 30 Minutes Reminder
```
🚨 *תזכורת אחרונה - נותרו 30 דקות!*

📦 *[Order Title]*

⚠️ *ההזמנה נסגרת בעוד חצי שעה!*
```

#### 4. Order Closed
```
🔒 *ההזמנה הקבוצתית נסגרה*

📦 *[Order Title]*

✅ ההזמנה נסגרה בהצלחה
👥 [X] משתתפים

תודה לכל המשתתפים! 🙏
```

### 📱 Private Order Confirmations

When a user places an order:
```
✅ *הזמנתך התקבלה בהצלחה!*

שלום [Name] 👋

📦 *הזמנה קבוצתית:* [Order Title]

🛍️ *פריטים שהזמנת:*
  • [Product] x[Qty] - ₪[Price]
  • [Product] x[Qty] - ₪[Price]

💰 *סה"כ לתשלום:* ₪[Total]

תודה שבחרת בנו! ❤️
```

### 🔧 Admin Commands

Send commands from registered admin phone numbers:

| Command | Description |
|---------|-------------|
| `/help` | Show all available commands |
| `/status` | Get system status overview |
| `/orders [status]` | List orders (open/closed/scheduled) |
| `/users` | Get user statistics |
| `/stats` | Get 7-day statistics |
| `/create_order [title] [hours]` | Create new order |
| `/close_order [id]` | Close order manually |
| `/open_order [id]` | Reopen closed order |
| `/send_reminder [id]` | Send manual reminder |
| `/bot_status` | Check bot connection |
| `/config [key]` | View configuration |
| `/set_config [key] [value]` | Update configuration |

---

## Prerequisites

### 1. WhatsApp Number
- A phone number for the bot (can be your existing business number)
- The phone must have WhatsApp installed
- You'll need access to this phone to scan QR code

### 2. System Requirements
- Node.js 18+
- npm 9+
- Active Supabase project
- Railway deployment (optional but recommended)

### 3. WhatsApp Group
- Create a WhatsApp group for announcements
- Add your customers to this group
- You'll need the group ID (we'll show you how to get it)

---

## Installation

### Step 1: Install Dependencies

```bash
npm install
```

This will install:
- `@whiskeysockets/baileys` - WhatsApp client library
- `@hapi/boom` - Error handling
- `qrcode-terminal` - QR code display in terminal
- `pino` - Logging framework
- `pino-pretty` - Pretty log formatting

### Step 2: Database Setup

1. Open your Supabase dashboard
2. Go to **SQL Editor**
3. Copy content from `database/whatsapp_schema.sql`
4. Run the SQL script

This creates:
- `whatsapp_admins` - Admin phone numbers
- `whatsapp_config` - Bot configuration
- `whatsapp_messages` - Message queue
- `whatsapp_activity_log` - Activity tracking
- `whatsapp_session` - Connection state

---

## Configuration

### Step 1: Add Admin Phone Numbers

Add your admin phone numbers to the database:

```sql
INSERT INTO whatsapp_admins (phone, full_name, is_active)
VALUES 
    ('972501234567', 'Admin Name', true),
    ('972507654321', 'Another Admin', true);
```

**Phone Format:** 
- Remove all non-digits
- Start with 972 (Israel country code)
- Example: 050-123-4567 → 972501234567

### Step 2: Configure Settings

Key settings in `whatsapp_config` table:

| Setting | Description | Default |
|---------|-------------|---------|
| `announcement_group_id` | WhatsApp group ID for announcements | (empty) |
| `bot_enabled` | Enable/disable bot | `true` |
| `send_order_confirmations` | Send private order confirmations | `true` |
| `send_group_announcements` | Send group announcements | `true` |
| `send_reminders` | Send reminder messages | `true` |
| `reminder_1h_enabled` | Enable 1-hour reminders | `true` |
| `reminder_30m_enabled` | Enable 30-minute reminders | `true` |
| `message_delay_ms` | Delay between messages | `1000` |

### Step 3: Get WhatsApp Group ID

After authenticating (next step), send a message to your announcement group, then check `whatsapp_activity_log` table to find the group ID. It will look like: `120363XXX@g.us`

Update the config:
```sql
UPDATE whatsapp_config 
SET value = '120363XXX@g.us' 
WHERE key = 'announcement_group_id';
```

---

## Setup Steps

### Step 1: Test Database Schema

```bash
npm run test:whatsapp
```

This verifies:
- ✅ All tables exist
- ✅ Configuration is loaded
- ✅ Phone formatting works
- ✅ Message queueing works

### Step 2: Authenticate WhatsApp

```bash
npm run whatsapp:auth
```

1. A QR code will appear in your terminal
2. Open WhatsApp on your phone
3. Go to: **Menu (⋮) > Linked Devices > Link a Device**
4. Scan the QR code
5. Wait for "Connected successfully!" message
6. Press Ctrl+C to exit

**Session Storage:**
- Auth data saved in `BotVapes/auth_info/`
- Session persists across restarts
- Re-authenticate if disconnected

### Step 3: Start the Bot

**Option A: Standalone Bot**
```bash
npm run whatsapp:listen
```
Runs the WhatsApp bot as a separate service.

**Option B: Integrated with Cron (Recommended)**
```bash
npm run cron
```
Runs the full automation system including WhatsApp.

**For Production (Railway):**
Add to your Railway cron configuration:
```bash
# Every 2 minutes
*/2 * * * * npm run cron
```

### Step 4: Verify Everything Works

1. **Check Connection:**
   ```bash
   npm run test:whatsapp
   ```

2. **Test with Admin Command:**
   Send `/status` from your admin phone

3. **Create Test Order:**
   - Go to admin panel
   - Create a new general order
   - Check WhatsApp group for announcement

4. **Place Test Order:**
   - Order something from the shop
   - Check for private confirmation message

---

## Admin Commands Reference

### System Information

#### `/status`
Get current system status:
- Active orders count
- Today's revenue
- WhatsApp message stats
- Link to admin panel

#### `/bot_status`
Check WhatsApp connection:
- Connection state
- Bot phone number
- Reconnection attempts

#### `/stats`
7-day statistics:
- Orders count and revenue
- WhatsApp messages sent/failed
- Success rate

### Order Management

#### `/orders [status]`
List orders by status:
```
/orders open        # Active orders
/orders closed      # Completed orders
/orders scheduled   # Scheduled orders
```

#### `/create_order [title] [hours]`
Create new order:
```
/create_order "Weekly Special" 48
```
Creates an order closing in 48 hours.

#### `/close_order [id]`
Close order manually:
```
/close_order abc123-def456-...
```

#### `/open_order [id]`
Reopen a closed order:
```
/open_order abc123-def456-...
```

#### `/send_reminder [id]`
Send reminder manually:
```
/send_reminder abc123-def456-...
```

### User Information

#### `/users`
Get user statistics:
- Total users
- Active users  
- Admin count
- Users with phone numbers

### Configuration

#### `/config`
View all settings:
```
/config
```

#### `/config [key]`
View specific setting:
```
/config bot_enabled
```

#### `/set_config [key] [value]`
Update setting:
```
/set_config bot_enabled false
/set_config message_delay_ms 2000
```

---

## Troubleshooting

### Bot Not Connecting

**Problem:** QR code not appearing or connection fails

**Solutions:**
1. Check internet connection
2. Ensure Supabase credentials in `.env.local` are correct
3. Delete `BotVapes/auth_info/` folder and re-authenticate
4. Check firewall settings (ports 443, 80 must be open)

### Messages Not Sending

**Problem:** Messages stuck in queue

**Solutions:**
1. Check bot connection: `npm run test:whatsapp`
2. Verify group ID is correct in config
3. Check `whatsapp_messages` table for errors
4. Ensure bot is running: `npm run whatsapp:listen`
5. Check `whatsapp_activity_log` for error details

### Admin Commands Not Working

**Problem:** Bot doesn't respond to commands

**Solutions:**
1. Verify your phone is in `whatsapp_admins` table
2. Check phone format (972XXXXXXXXX)
3. Ensure `is_active = true` in admins table
4. Commands must start with `/`
5. Bot must be connected

### Phone Number Format Issues

**Supported Formats:**
- ✅ `0501234567`
- ✅ `972501234567`
- ✅ `+972501234567`
- ✅ `050-123-4567`
- ❌ `05-01-234567` (not supported)

All formats are automatically converted to `972501234567`.

### No Order Confirmations Sent

**Problem:** Users don't receive order confirmations

**Solutions:**
1. Check users have phone numbers in database
2. Verify `send_order_confirmations` = `true` in config
3. Check `whatsapp_messages` table for queued messages
4. Ensure bot is processing queue
5. Check for errors in `whatsapp_activity_log`

### Railway Deployment Issues

**Problem:** Bot disconnects frequently on Railway

**Solutions:**
1. Use persistent storage for `BotVapes/auth_info/`
2. Add health check endpoint
3. Increase memory allocation
4. Use Railway's built-in cron instead of standalone bot

---

## Architecture

### File Structure

```
BotVapes/
├── whatsappClient.js       # WhatsApp connection and client
├── whatsappMessages.js     # Message templates and queue
├── whatsappCommands.js     # Admin command handlers
└── auth_info/             # Session storage (git-ignored)

Root:
├── whatsapp-auth.js        # Authentication script
├── whatsapp-listener.js    # Standalone bot runner
├── test-whatsapp.js        # Test suite
└── cron-general-orders.js  # Integrated with cron

Database:
└── database/
    └── whatsapp_schema.sql # Database schema
```

### Message Flow

```
1. Event Triggers (order created, reminder time, etc.)
   ↓
2. Queue Message (queueWhatsAppMessage)
   ↓
3. Store in Database (whatsapp_messages table)
   ↓
4. WhatsApp Client Processes Queue
   ↓
5. Send via Baileys Library
   ↓
6. Update Status (sent/failed)
   ↓
7. Log Activity (whatsapp_activity_log)
```

### Integration Points

1. **Cron System (`cron-general-orders.js`)**
   - Calls WhatsApp functions alongside email/push
   - Handles order opening, closing, reminders

2. **Order API (`/api/general-orders/participate/route.js`)**
   - Queues order confirmation after purchase
   - Non-blocking to avoid slowing down orders

3. **Admin Panel (Future)**
   - View message history
   - Manage admins
   - Configure settings
   - Monitor connection status

---

## Best Practices

### 1. Phone Number Management
- ✅ Always collect phone numbers during registration
- ✅ Validate format before saving
- ✅ Support both formats (05 and +972)
- ✅ Allow users to update their phone

### 2. Message Scheduling
- ✅ Use the queue system, not direct sending
- ✅ Set appropriate priorities
- ✅ Add delays between messages (anti-spam)
- ✅ Respect WhatsApp rate limits

### 3. Error Handling
- ✅ All errors logged to database
- ✅ Automatic retry for failed messages
- ✅ Non-blocking integration (orders still work if WhatsApp fails)
- ✅ Admin notifications for critical errors

### 4. Security
- ✅ Only registered admins can use commands
- ✅ Phone verification for admin access
- ✅ Session stored locally (not in database)
- ✅ All activity logged for audit

### 5. Monitoring
- ✅ Check `whatsapp_session` for connection status
- ✅ Monitor `whatsapp_activity_log` for errors
- ✅ Review message stats regularly
- ✅ Test commands periodically

---

## Support & Updates

### Get Group ID
After authentication, send a test message to your group, then:
```sql
SELECT * FROM whatsapp_activity_log 
WHERE activity_type = 'message_received' 
ORDER BY created_at DESC 
LIMIT 10;
```

Look for entries with group format (`XXXXXX@g.us`).

### Update Admin List
```sql
-- Add new admin
INSERT INTO whatsapp_admins (phone, full_name, is_active)
VALUES ('972501234567', 'New Admin', true);

-- Disable admin
UPDATE whatsapp_admins 
SET is_active = false 
WHERE phone = '972501234567';

-- List all admins
SELECT * FROM whatsapp_admins ORDER BY created_at DESC;
```

### Clear Message Queue
If messages are stuck:
```sql
-- Delete failed messages
DELETE FROM whatsapp_messages WHERE status = 'failed';

-- Reset pending to retry
UPDATE whatsapp_messages 
SET status = 'pending', retry_count = 0 
WHERE status = 'failed';
```

### View Activity Logs
```sql
-- Recent activity
SELECT * FROM whatsapp_activity_log 
ORDER BY created_at DESC 
LIMIT 50;

-- Errors only
SELECT * FROM whatsapp_activity_log 
WHERE status = 'failed' 
ORDER BY created_at DESC;
```

---

## 📞 Need Help?

If you encounter issues:

1. ✅ Run test script: `npm run test:whatsapp`
2. ✅ Check logs: `whatsapp_activity_log` table
3. ✅ Verify configuration: `/config` command
4. ✅ Test connection: `/bot_status` command
5. ✅ Review this guide's Troubleshooting section

Happy messaging! 🚀
