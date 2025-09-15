# Auto-Close System for General Orders - Complete Documentation# מערכת סגירה אוטומטית להזמנות קבוצתיות



## Overview## סקירה כללית



This comprehensive automated system ensures that expired general orders are automatically closed without requiring manual intervention or website activity. The system runs independently using Windows Task Scheduler and directly connects to the Supabase database.מערכת הסגירה האוטומטית מאפשרת סגירה אוטומטית של הזמנות קבוצתיות שחרג תאריך הסגירה שלהן. המערכת כוללת:



## Features1. **API Endpoint** לסגירה ידנית ובדיקת הזמנות פגות תוקף

2. **כפתור בפאנל הניהול** לטריגר סגירה ידנית

- ✅ **Fully Automated**: Runs every 10 minutes without website dependency3. **סקריפטים לתזמון** לסגירה אוטומטית במרווחי זמן קבועים

- ✅ **Direct Database Access**: No need for web server to be running

- ✅ **Comprehensive Logging**: Detailed logs with automatic rotation## רכיבי המערכת

- ✅ **Error Recovery**: Automatic retry mechanisms and error handling

- ✅ **Dry Run Mode**: Test without making changes### 1. API Endpoint

- ✅ **Shop Status Management**: Automatically closes shop when needed**קובץ:** `src/app/api/admin/auto-close/route.js`

- ✅ **Email Notifications**: Queues closure and summary emails

- ✅ **Windows Integration**: Uses Task Scheduler for reliability#### GET Request - בדיקה (Dry Run)

```

## Files StructureGET /api/admin/auto-close

```

```**תשובה:**

vapes/Upgraded/```json

├── standalone-auto-close.js      # Main auto-close script (independent){

├── task-scheduler.bat            # Windows wrapper script  "expiredOrdersCount": 2,

├── auto-close-task.xml          # Task Scheduler definition  "expiredOrders": [

├── setup-auto-close.bat         # Automated setup script    {

├── auto_close_scheduler.js       # Legacy web-dependent script      "id": "123",

├── auto_close_scheduler.bat      # Legacy batch script      "title": "הזמנה קבוצתית",

└── logs/                        # Log files directory      "deadline": "2024-01-15T10:00:00Z",

    ├── auto-close-standalone.log  # Detailed auto-close logs      "status": "open",

    └── task-scheduler.log          # Task scheduler wrapper logs      "created_at": "2024-01-10T09:00:00Z"

```    }

  ],

## Installation & Setup  "currentTime": "2024-01-15T15:30:00Z",

  "message": "2 הזמנות ממתינות לסגירה אוטומטית"

### Automatic Setup (Recommended)}

```

1. **Run as Administrator** (Required for Task Scheduler):

   ```cmd#### POST Request - סגירה אקטיבית

   Right-click setup-auto-close.bat -> "Run as administrator"```

   ```POST /api/admin/auto-close

```

2. **Follow the setup wizard** - it will:**תשובה:**

   - Check Node.js installation```json

   - Verify all files are present{

   - Create the scheduled task  "message": "2 הזמנות קבוצתיות נסגרו אוטומטית",

   - Test the system  "closedOrders": [

   - Show configuration details    {

      "id": "123",

### Manual Setup      "title": "הזמנה קבוצתית",

      "deadline": "2024-01-15T10:00:00Z"

If automatic setup fails, you can set up manually:    }

  ]

1. **Create Task in Task Scheduler**:}

   ```cmd```

   schtasks /create /xml "auto-close-task.xml" /tn "VapesShop-AutoClose"

   ```### 2. ממשק הניהול

**מיקום:** פאנל הניהול > הזמנות קבוצתיות

2. **Test the task**:

   ```cmdכפתור "סגירה אוטומטית" מאפשר למנהלים:

   schtasks /run /tn "VapesShop-AutoClose"- לבדוק אילו הזמנות פגות תוקף

   ```- לסגור ידנית הזמנות פגות תוקף

- לקבל משוב מיידי על הפעולה

## Configuration

### 3. לוגיקת הסגירה

### Environment Variables

כאשר הזמנה נסגרת אוטומטית:

The system reads from your existing `.env.local` file:

1. **עדכון סטטוס ההזמנה** - מ-`open` ל-`closed`

```bash2. **סגירת החנות** (אם ההזמנה הפעילה הנוכחית)

NEXT_PUBLIC_SUPABASE_URL=your_supabase_url   - `is_open = false`

SUPABASE_SERVICE_ROLE_KEY=your_service_key   - `current_general_order_id = null`

NEXT_PUBLIC_SITE_URL=your_website_url   - הודעה: "החנות סגורה - ההזמנה הקבוצתית הסתיימה"

```3. **שליחת התראות דוא"ל** - הודעה על סגירת ההזמנה

4. **רישום לוגים** - תיעוד הפעולה

### Optional Configuration

## תזמון אוטומטי

You can add these to `.env.local` for fine-tuning:

### סקריפט Node.js

```bash**קובץ:** `auto_close_scheduler.js`

# Logging level: debug, info, warn, error (default: info)

AUTO_CLOSE_LOG_LEVEL=info```bash

# הרצה ידנית

# Dry run mode - test without making changes (default: false)node auto_close_scheduler.js

AUTO_CLOSE_DRY_RUN=false

```# הגדרת Cron Job (לינוקס/מק)

# כל 15 דקות

## How It Works0,15,30,45 * * * * cd /path/to/project && node auto_close_scheduler.js >> logs/auto_close.log 2>&1

```

### 1. Schedule

- **Frequency**: Every 10 minutes### סקריפט Windows

- **Startup**: Also runs 2 minutes after system boot**קובץ:** `auto_close_scheduler.bat`

- **Network**: Only runs when network is available

- **Failures**: Retries 3 times with 5-minute intervals```batch

# הרצה ידנית

### 2. Process Flowauto_close_scheduler.bat

1. **Database Connection Test**: Verifies Supabase connectivity

2. **Find Expired Orders**: Queries `general_orders` where `status = 'open'` and `deadline < now()`# תזמון דרך Windows Task Scheduler

3. **Close Orders**: Updates status to `'closed'` with timestamp# פתח Task Scheduler -> Create Basic Task -> Browse לקובץ .bat

4. **Shop Management**: Closes shop if the expired order was current```

5. **Email Queuing**: Adds closure and summary notifications to email queue

6. **Logging**: Records all actions with detailed timestamps#### הגדרת Task Scheduler ב-Windows:

1. פתח `Task Scheduler` (מתזמן המשימות)

### 3. Database Operations2. לחץ `Create Basic Task` (צור משימה בסיסית)

```sql3. שם: "Auto Close General Orders"

-- Find expired orders4. תדירות: "Daily" (יומי)

SELECT id, title, deadline, status, created_at, updated_at 5. זמן: כל 15 דקות (או לפי הצורך)

FROM general_orders 6. Action: "Start a program" (הפעל תוכנית)

WHERE status = 'open' AND deadline < NOW()7. Program: נתיב מלא ל-`auto_close_scheduler.bat`



-- Close expired orders## בדיקות ותיקוף

UPDATE general_orders 

SET status = 'closed', updated_at = NOW() ### יצירת הזמנה לבדיקה

WHERE id IN (...)**קובץ:** `create_test_expired_order.sql`



-- Close shop if needed```sql

UPDATE shop_status -- יוצר הזמנה שפג תוקפה לבדיקה

SET is_open = false, current_general_order_id = null, -- הרץ בקובץ SQL או דרך phpMyAdmin/Supabase

    message = 'החנות סגורה - ההזמנה הקבוצתית הסתיימה'```

WHERE current_general_order_id = expired_order_id

### בדיקה ידנית

-- Queue notification emails**קובץ:** `test_auto_close.bat`

INSERT INTO email_logs (recipient_email, subject, body, status) 

VALUES ('SYSTEM_ORDER_CLOSED', '...', 'GENERAL_ORDER_CLOSED:...', 'failed')```batch

```# בדיקה מהירה של ה-API

test_auto_close.bat

## API Endpoints (Legacy/Manual)```



### GET /api/admin/auto-close - Check Expired Orders## לוגים ומעקב

```json

{### מיקום הלוגים

  "expiredOrdersCount": 2,```

  "expiredOrders": [logs/auto_close.log

    {```

      "id": "123",

      "title": "הזמנה קבוצתית",### דוגמה ללוג

      "deadline": "2024-01-15T10:00:00Z",```

      "status": "open"[2024-01-15T15:30:00.000Z] Starting auto-close check...

    }[2024-01-15T15:30:01.234Z] Found 2 expired orders

  ],[2024-01-15T15:30:02.456Z] Successfully closed 2 expired orders

  "currentTime": "2024-01-15T15:30:00Z",[2024-01-15T15:30:02.457Z]   - Closed order: הזמנה קבוצתית ינואר (ID: 123)

  "message": "2 הזמנות ממתינות לסגירה אוטומטית"[2024-01-15T15:30:02.458Z]   - Closed order: הזמנה קבוצתית פברואר (ID: 124)

}[2024-01-15T15:30:02.500Z] Auto-close scheduler completed

``````



### POST /api/admin/auto-close - Close Expired Orders## אבטחה ושגיאות

```json

{### הגנות

  "message": "2 הזמנות קבוצתיות נסגרו אוטומטית",- רק מנהלים יכולים לגשת ל-API

  "closedOrders": [- וולידציה של תאריכים

    {- טיפול בשגיאות והודעות ברורות

      "id": "123",

      "title": "הזמנה קבוצתית",### שגיאות נפוצות

      "deadline": "2024-01-15T10:00:00Z"1. **שגיאת חיבור למסד נתונים** - בדוק הגדרות Supabase

    }2. **אין הרשאות** - ודא שהמשתמש הוא מנהל

  ]3. **שגיאת CORS** - בדוק הגדרות ה-API

}

```## הרחבות עתידיות



## Monitoring & Management### תכונות מוצעות:

1. **התראות מקדימות** - דוא"ל לפני סגירה

### View Logs2. **הארכה אוטומטית** - בתנאים מסוימים

```cmd3. **סטטיסטיקות** - דוח על הזמנות שנסגרו

# View latest auto-close activity4. **אינטגרציה עם WhatsApp** - התראות נוספות

type logs\auto-close-standalone.log

### הגדרות מתקדמות:

# View task scheduler activity  ```javascript

type logs\task-scheduler.log// בעתיד - קובץ הגדרות

const AUTO_CLOSE_CONFIG = {

# Monitor in real-time (PowerShell)  checkInterval: 15, // דקות

Get-Content logs\auto-close-standalone.log -Wait  warningBefore: 30, // דקות לפני סגירה

```  autoExtend: false, // הארכה אוטומטית

  notifyUsers: true // התראה למשתמשים

### Task Management};

```cmd```

# Check task status

schtasks /query /tn "VapesShop-AutoClose" /v## תחזוקה



# Run manually### בדיקות תקופתיות:

schtasks /run /tn "VapesShop-AutoClose"- ודא שהלוגים נכתבים

- בדוק שההזמנות נסגרות בזמן

# Disable task- וודא שהדוא"ל נשלח

schtasks /change /tn "VapesShop-AutoClose" /disable

### גיבוי:

# Enable task- גבה את מסד הנתונים לפני שינויים

schtasks /change /tn "VapesShop-AutoClose" /enable- שמור עותק של קבצי הקונפיגורציה



# Remove task---

schtasks /delete /tn "VapesShop-AutoClose" /f

```**הערה:** מערכת זו מתואמת לאזור הזמן של ירושלים ותומכת בעברית מלאה.

### Test Manually
```cmd
# Run script directly
node standalone-auto-close.js

# Run in dry-run mode
set AUTO_CLOSE_DRY_RUN=true && node standalone-auto-close.js
```

## Logging Details

### Log Levels
- **DEBUG**: Detailed operations, database queries
- **INFO**: Normal operations, order closures, status changes
- **WARN**: Non-critical issues, missing shop status
- **ERROR**: Failures, database errors, connectivity issues

### Sample Log Entry
```
[2025-09-14T10:30:00.123Z] [INFO] Closing 2 expired orders
{
  "orders": [
    {"id": "123", "title": "הזמנה קבוצתית 1", "deadline": "2025-09-14T10:00:00Z"},
    {"id": "456", "title": "הזמנה קבוצתית 2", "deadline": "2025-09-14T09:30:00Z"}
  ]
}
[2025-09-14T10:30:01.456Z] [INFO] Successfully closed 2 orders
[2025-09-14T10:30:02.789Z] [INFO] Shop closed successfully for order: הזמנה קבוצתית 1
```

## Troubleshooting

### Common Issues

1. **Task Not Running**
   ```cmd
   # Check if task exists
   schtasks /query /tn "VapesShop-AutoClose"
   
   # Check task history in Task Scheduler GUI
   taskschd.msc
   ```

2. **Database Connection Errors**
   - Verify `.env.local` has correct Supabase credentials
   - Check network connectivity
   - Ensure service role key has admin privileges

3. **Node.js Not Found**
   ```cmd
   # Check Node.js installation
   node --version
   
   # Add to PATH if needed
   # Reinstall Node.js from https://nodejs.org/
   ```

### Debug Mode
```cmd
set AUTO_CLOSE_LOG_LEVEL=debug
node standalone-auto-close.js
```

### Dry Run Testing
```cmd
set AUTO_CLOSE_DRY_RUN=true
node standalone-auto-close.js
```

## Integration with Email System

The auto-close system integrates with your existing email processing:

1. **Queues Emails**: Adds notifications to `email_logs` table with `status = 'failed'` (queue status)
2. **Email Types**: 
   - `GENERAL_ORDER_CLOSED`: Customer notifications
   - `GENERAL_ORDER_SUMMARY`: Admin summary reports
3. **Processing**: Your existing email service will process these automatically

## Security & Performance

### Security
- **Service Role Key**: Stored in `.env.local` (not in repository)
- **Least Privilege**: Task runs with minimal Windows privileges
- **Network Dependency**: Only runs when network is available
- **Timeout Protection**: 10-minute execution limit prevents hanging

### Performance
- **CPU Usage**: Minimal - runs for ~1-5 seconds every 10 minutes
- **Memory**: ~50MB during execution
- **Network**: Only Supabase API calls
- **Disk**: Log files (auto-rotated, ~50MB total max)

## Legacy Components

### auto_close_scheduler.js (Web-dependent)
- Calls the web API endpoints
- Requires website to be running
- Suitable for environments where web server is always active

### auto_close_scheduler.bat (Windows batch)
- Basic curl-based approach
- Minimal logging
- Good for simple setups

## Migration from Legacy

If you're currently using the web-dependent scripts:
1. Run `setup-auto-close.bat` to install the new system
2. Disable old cron jobs/scheduled tasks
3. The new system is backward compatible and more reliable

## Quick Start Guide

1. **Install**: Run `setup-auto-close.bat` as Administrator
2. **Verify**: Check logs in `logs/auto-close-standalone.log`
3. **Monitor**: Use Task Scheduler GUI (`taskschd.msc`) to view task history
4. **Test**: Run `node standalone-auto-close.js` manually to test

The system will automatically handle all expired general orders every 10 minutes!