# Inactive Users Cleanup System

## Overview
Automatically removes users who haven't logged in for 3 months (90 days). This helps maintain database cleanliness and complies with data retention policies.

## Features
- ✅ Automatic cleanup of users inactive for 90+ days
- ✅ Preserves admin accounts (never deleted)
- ✅ Preserves order history (nullifies user_id instead of deleting)
- ✅ Manual API endpoints for admin control
- ✅ Dry-run mode to preview deletions
- ✅ Comprehensive logging

## Setup

### 1. Database Migration
First, add the `last_login` field to your users table:

```bash
# Run this SQL in your Supabase SQL Editor
```

Execute the SQL file: `database/add_last_login_field.sql`

This will:
- Add `last_login` column to users table
- Set existing users' last_login to their created_at date
- Create an index for better performance

### 2. Automated Cleanup (Cron Job)

#### Option A: Railway Cron (Recommended for Production)
Add this to your Railway service environment variables:
```
CRON_CLEANUP_INACTIVE_USERS=0 2 * * *
```

Then create a Railway cron service that runs:
```bash
node cleanup-inactive-users.js
```

Schedule: Daily at 2 AM (adjust as needed)

#### Option B: Manual Execution
Run manually when needed:
```bash
node cleanup-inactive-users.js
```

#### Option C: Using node-cron (if you have a running server)
The script can be integrated into your existing cron service (`cron-service.js`).

### 3. API Endpoints

The system provides REST APIs for manual control:

#### Get Inactive Users (Preview)
```http
GET /api/admin/cleanup-inactive?days=90
```

**Response:**
```json
{
  "success": true,
  "count": 5,
  "cutoffDays": 90,
  "cutoffDate": "2024-09-25T00:00:00.000Z",
  "users": [
    {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "username": "johndoe",
      "lastLogin": "2024-08-15T10:30:00.000Z",
      "daysSinceLogin": 132
    }
  ]
}
```

#### Dry Run (Preview Deletions)
```http
POST /api/admin/cleanup-inactive
Content-Type: application/json

{
  "dryRun": true
}
```

**Response:**
```json
{
  "success": true,
  "dryRun": true,
  "message": "Found 5 inactive user(s) to delete",
  "count": 5,
  "users": [...]
}
```

#### Execute Cleanup
```http
POST /api/admin/cleanup-inactive
Content-Type: application/json

{
  "dryRun": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Cleanup completed. Deleted 5 user(s)",
  "deleted": 5,
  "failed": 0,
  "users": [...],
  "failures": []
}
```

## How It Works

### 1. Identification
Users are marked as inactive if:
- Their `last_login` is older than 90 days, OR
- Their `last_login` is NULL (never logged in after migration)
- **Exception:** Admin users are NEVER deleted

### 2. Cleanup Process
For each inactive user:
1. **Delete activity logs** - Removes user activity history
2. **Delete admin activity logs** - Removes admin actions by user
3. **Nullify WhatsApp data** - Keeps conversation history but removes user link
4. **Preserve orders** - Sets `user_id` to NULL instead of deleting (for business records)
5. **Delete cart items** - Removes shopping cart
6. **Delete password reset tokens** - Removes any pending password resets
7. **Nullify visitor tracking** - Keeps analytics but removes user link
8. **Delete user account** - Finally removes the user record

### 3. Last Login Tracking
The `last_login` field is automatically updated in the login API:
- Location: `src/app/api/auth/login/route.js`
- Updates on every successful login
- Used to determine inactivity period

## Configuration

### Change Inactivity Period
Edit `INACTIVE_DAYS` constant in:
- `cleanup-inactive-users.js` (line 6)
- `src/app/api/admin/cleanup-inactive/route.js` (line 4)

```javascript
const INACTIVE_DAYS = 90; // Change to desired number of days
```

### Exclude Additional Roles
To exclude specific roles from deletion:

```javascript
.neq('role', 'admin')
.neq('role', 'moderator') // Add more exclusions
```

## Testing

### Test Dry Run
```bash
# Using curl
curl -X POST https://your-domain.com/api/admin/cleanup-inactive \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'

# Using fetch in browser console
fetch('/api/admin/cleanup-inactive', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ dryRun: true })
}).then(r => r.json()).then(console.log);
```

### Test Script Locally
```bash
node cleanup-inactive-users.js
```

## Monitoring

### Script Output
The cleanup script provides detailed console output:
- 📊 Count of inactive users found
- 🗑️ Each user being processed
- ✅ Success confirmations
- ❌ Error details
- 📋 Summary statistics

### Logs to Check
- Check Railway logs for automated runs
- Check your application logs for API calls
- Monitor Supabase logs for database operations

## Safety Features

1. **Admin Protection** - Admins are never deleted
2. **Order Preservation** - Business records are kept
3. **Dry Run Mode** - Preview before deletion
4. **Comprehensive Logging** - Track all operations
5. **Error Handling** - Continues on individual failures
6. **Initial Protection** - Existing users get last_login set to created_at

## Troubleshooting

### Users Not Being Deleted
1. Check if `last_login` field exists in database
2. Verify the cutoff date calculation
3. Check if users have admin role
4. Review error logs

### Foreign Key Errors
If you get foreign key constraint errors:
1. Check for tables not handled in the cleanup process
2. Add handling for the new table
3. Consider adding `ON DELETE CASCADE` or `ON DELETE SET NULL` to foreign keys

### Performance Issues
For large user bases:
1. Add appropriate indexes (already included)
2. Process in batches
3. Run during off-peak hours

## Best Practices

1. **Always test in staging first**
2. **Run dry-run before actual cleanup**
3. **Schedule during low-traffic hours**
4. **Keep backups before first run**
5. **Monitor logs regularly**
6. **Notify users before deletion** (optional - add email notifications)

## Integration with Admin Panel

To add a UI for this feature in your admin panel:

```javascript
// In your admin panel component
const handleCleanupInactive = async (dryRun = true) => {
  try {
    const response = await fetch('/api/admin/cleanup-inactive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun })
    });
    
    const result = await response.json();
    
    if (result.success) {
      alert(`${dryRun ? 'Preview: ' : ''}${result.message}`);
      console.log('Users:', result.users);
    }
  } catch (error) {
    console.error('Cleanup error:', error);
    alert('Failed to cleanup inactive users');
  }
};

// Add buttons in your admin UI
<button onClick={() => handleCleanupInactive(true)}>
  Preview Inactive Users
</button>
<button onClick={() => handleCleanupInactive(false)}>
  Delete Inactive Users
</button>
```

## Future Enhancements

Consider adding:
- [ ] Email notifications to users before deletion (7-day warning)
- [ ] Configurable inactivity period via admin settings
- [ ] Export inactive users to CSV before deletion
- [ ] Restore deleted users within 30 days (soft delete)
- [ ] Different inactivity periods for different user types
- [ ] Statistics dashboard for user activity

## Support

For issues or questions:
1. Check the logs for error messages
2. Verify database schema is up to date
3. Test with dry-run first
4. Review this documentation

---

**Last Updated:** December 25, 2025
**Version:** 1.0.0
