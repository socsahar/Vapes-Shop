# Visitor Tracking System

## Overview
The visitor tracking system counts and displays website visitor statistics in the admin panel dashboard.

## Features
- **Total Visitors**: All-time visitor count
- **Daily Stats**: Visitors today
- **Weekly Stats**: Visitors in the last 7 days
- **Monthly Stats**: Visitors this month
- **Real-time Tracking**: Automatic visitor tracking on each page visit
- **Session Management**: Uses session IDs to avoid duplicate counts per session

## Setup Instructions

### 1. Database Setup
Run the SQL migration in your Supabase SQL Editor:
```sql
-- File: database/add_visitor_tracking.sql
```
This creates the `visitor_tracking` table with proper indexes.

### 2. How It Works

#### Tracking Visitors
- When a user visits `/shop`, the system automatically tracks the visit
- Each visitor gets a unique session ID stored in `sessionStorage`
- The following data is captured:
  - IP address (from headers)
  - User agent (browser/device info)
  - Page URL
  - Referrer (where they came from)
  - Session ID
  - Timestamp

#### Viewing Statistics
- Go to Admin Panel → Dashboard
- View the "👁️ ביקורים באתר" card for total visitors
- Scroll down to see the detailed visitor statistics section with:
  - 📅 Today's visitors
  - 📆 This week's visitors
  - 📊 This month's visitors
  - 🌐 Total all-time visitors

### 3. API Endpoints

#### Track Visit (Public)
```
POST /api/track-visit
Body: {
  sessionId: string,
  pageUrl: string,
  referrer: string
}
```

#### Get Visitor Stats (Admin Only)
```
GET /api/admin/visitor-stats
Response: {
  total: number,
  today: number,
  thisWeek: number,
  thisMonth: number
}
```

## Privacy Considerations
- IP addresses are stored for analytics but can be anonymized if needed
- Session IDs prevent counting the same visitor multiple times in one session
- User agents help understand which devices/browsers are used
- No personally identifiable information (PII) is stored

## Future Enhancements
- Add daily/weekly/monthly charts
- Add geographical tracking (country/city)
- Add page-specific analytics
- Add bounce rate and session duration tracking
- Export visitor data to CSV/Excel
