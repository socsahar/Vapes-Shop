# Auto-Manager System - Complete Setup Guide

## Overview
The Auto-Manager system automatically handles:
- **Auto-Opening**: Scheduled general orders when their `opening_time` arrives
- **Auto-Closing**: Expired general orders after 15 minutes (configurable)

## 🚀 Quick Start (Windows)

### Prerequisites
1. **Node.js 18+** installed
2. **Administrator privileges** for Task Scheduler setup
3. **Supabase credentials** configured in your environment

### Environment Variables Required
Create a `.env.local` file or set system environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NODE_ENV=production

# Optional
AUTO_MANAGE_LOG_LEVEL=info          # debug, info, warn, error
AUTO_MANAGE_DRY_RUN=false          # true for testing without changes
NEXT_PUBLIC_SITE_URL=your_website_url
RESEND_API_KEY=your_resend_api_key  # for email notifications
```

### Step-by-Step Setup

#### 1. Install Dependencies
```bash
npm install @supabase/supabase-js
```

#### 2. Test the System (SAFE - No Changes Made)
```bash
# Double-click this file or run in terminal:
test-auto-manager.bat
```

This will show you what the system would do without making any actual changes.

#### 3. Set up Automatic Scheduling
```bash
# Right-click and "Run as Administrator":
setup-auto-manager.bat
```

This creates a Windows Task Scheduler job that runs every 10 minutes.

#### 4. Manage the System
```bash
# Use the control panel:
manage-auto-manager.bat
```

## 📁 Important Files

| File | Purpose |
|------|---------|
| `standalone-auto-manager.js` | Main automation script |
| `setup-auto-manager.bat` | Creates Windows scheduled task |
| `manage-auto-manager.bat` | Control panel for the system |
| `test-auto-manager.bat` | Safe testing (no real changes) |
| `production-deploy.js` | Production deployment helper |
| `logs/auto-manager.log` | System logs |

## 🔧 Configuration Options

### Environment Variables

- `AUTO_MANAGE_DRY_RUN=true` - Test mode (no actual changes)
- `AUTO_MANAGE_LOG_LEVEL=debug` - Verbose logging
- `AUTO_MANAGE_LOG_LEVEL=info` - Standard logging (recommended)
- `AUTO_MANAGE_LOG_LEVEL=warn` - Warnings and errors only
- `AUTO_MANAGE_LOG_LEVEL=error` - Errors only

### Database Configuration

The system works with your existing `general_orders` table and expects:

- `opening_time` column (timestamp) - when to auto-open scheduled orders
- `status` column - order status ('scheduled', 'active', 'closed')
- `created_at` column - for calculating expiry time

## 📊 Monitoring

### View Logs
- Check `logs/auto-manager.log` for detailed activity
- Use `manage-auto-manager.bat` → Option 2 for recent logs

### Task Status
- Use `manage-auto-manager.bat` → Option 1 for task status
- Windows Task Scheduler: Search "Task Scheduler" → "VapeShop_AutoManager"

### Health Check
```bash
node health-check.js
```

## 🚨 Safety Features

1. **Dry Run Mode**: Test without making changes
2. **Detailed Logging**: Track all actions
3. **Error Recovery**: Continues running even if individual operations fail
4. **Database Validation**: Checks connections before processing

## ⚠️ Important Notes

### Before First Use
1. **ALWAYS test first** using `test-auto-manager.bat`
2. **Check your database** has the required columns
3. **Verify environment variables** are set correctly
4. **Review the logs** after testing

### Safety Considerations
- The system only processes orders that meet specific criteria
- Auto-close only affects orders older than the configured time limit
- All actions are logged for audit purposes
- You can disable the system anytime using the control panel

## 🔄 How It Works

### Auto-Opening Process
1. Finds orders with `status = 'scheduled'`
2. Checks if `opening_time <= now()`
3. Changes status to `active`
4. Logs the action

### Auto-Closing Process
1. Finds orders with `status = 'active'`
2. Checks if `created_at + 15 minutes <= now()`
3. Changes status to `closed`
4. Logs the action

### Scheduling
- Runs every 10 minutes automatically
- Uses Windows Task Scheduler
- Runs as SYSTEM user for reliability
- Continues running even if you log out

## 🛠️ Troubleshooting

### Common Issues

**Task not running:**
- Check if you ran setup as Administrator
- Verify Task Scheduler has the task "VapeShop_AutoManager"
- Check Windows Event Logs for errors

**Database connection failed:**
- Verify Supabase URL and service key
- Check internet connection
- Ensure service key has proper permissions

**No orders being processed:**
- Check log files for details
- Verify orders meet the criteria (status, timing)
- Run in debug mode: `AUTO_MANAGE_LOG_LEVEL=debug`

**Permission errors:**
- Ensure you have write access to the project directory
- Check the logs directory exists and is writable

### Debug Commands
```bash
# Test database connection
node -e "require('./standalone-auto-manager.js').testConnection()"

# Run single execution with debug logging
set AUTO_MANAGE_LOG_LEVEL=debug && node standalone-auto-manager.js

# Check system health
node health-check.js
```

## 🌐 Production Deployment

For hosting on cloud platforms (Railway, Vercel, Heroku):

```bash
node production-deploy.js
```

This will create platform-specific configuration files and deployment instructions.

## 📞 Support

If you encounter issues:

1. Check the logs: `logs/auto-manager.log`
2. Run in debug mode for detailed output
3. Test with dry run mode first
4. Verify environment variables
5. Check database connectivity

---

**Ready to start?**

1. Run `test-auto-manager.bat` to test safely
2. If test looks good, run `setup-auto-manager.bat` as Administrator
3. Use `manage-auto-manager.bat` to monitor and control the system

The system will then automatically manage your orders every 10 minutes! 🎉