# 🤖 AI Development Instructions - Vape Shop Project

## 📋 **Project Overview**
This is a sophisticated **group ordering vape shop system** built with Next.js 15.5.2, custom CSS framework, and Supabase database. The core concept is **group ordering** where the shop is closed until admin opens general orders with deadlines.

## 🎯 **Core Business Model**
- **Shop is CLOSED by default** - customers cannot place individual orders
- **Admin opens "General Orders"** with specific deadlines
- **Customers join group orders** during open periods
- **Automatic email reminders** at 24h, 1h, and closure
- **Automatic order closure** when deadline reached
- **PDF reports** generated for admin and suppliers
- **Order archival system** for historical tracking

## 📁 **Architecture Overview**

### **Technology Stack**
- **Frontend**: Next.js 15.5.2 + React 19
- **Styling**: Custom CSS framework (NO Tailwind)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Custom JWT with localStorage
- **Email**: Nodemailer with template system
- **Language**: Hebrew RTL support

### **Database Schema**
```sql
-- Core Tables
users              # User management with roles
products           # Product catalog
general_orders     # Group orders with deadlines
order_items        # Individual items in orders
email_logs         # Email notification tracking
user_logs          # System activity tracking
```

## 🔄 **Current System Status**

### ✅ **What's Working**
- **Admin Panel**: Full user/product/general order management
- **Database Schema**: Complete with RLS policies
- **Email System**: Template system with automatic reminders
- **Authentication**: JWT-based with role management
- **Shop Interface**: Basic cart functionality

### ⚠️ **Critical Issues Discovered**
1. **API Mismatch**: Group ordering APIs were deleted but database exists
2. **Business Logic Gap**: Shop allows individual orders vs. group-only model
3. **Feature Inconsistency**: UI references group orders but APIs missing

### 🚧 **Missing Components**
- Group order participation APIs
- Email reminder scheduling
- PDF report generation
- Automatic order closure system

## 🎨 **Design System**

### **CSS Framework**
- **NO Tailwind** - Uses custom CSS utility classes
- **RTL Support** - Hebrew language support built-in
- **Glass Morphism** - Modern UI with backdrop blur effects
- **Responsive Design** - Mobile-first approach

### **Color Palette**
```css
--primary: rgb(139, 69, 19)    /* Brown */
--secondary: rgb(75, 0, 130)   /* Purple */
--accent: rgb(255, 140, 0)     /* Orange */
--success: rgb(34, 197, 94)    /* Green */
--warning: rgb(251, 191, 36)   /* Yellow */
--danger: rgb(239, 68, 68)     /* Red */
```

### **Key CSS Classes**
```css
.btn, .btn-primary, .btn-secondary
.card, .badge, .gradient-text
.glass-nav, .animate-fadeIn, .animate-glow
.admin-*, .auth-*, .shop-*
```

## 🛠️ **Development Guidelines**

### **🚨 CRITICAL RULE: ALWAYS GET APPROVAL FIRST**
**NEVER make changes without explicit user approval**:
1. **Explain what you plan to do** in detail
2. **List all files that will be modified/created**
3. **Describe the expected outcome**
4. **Wait for user confirmation** before proceeding
5. **No exceptions** - even for small changes

### **File Structure Rules**
- Use `src/app/` directory structure (App Router)
- API routes in `src/app/api/`
- Pages as `page.js` files
- Utility functions in `src/lib/`
- Database schema in `database/`

### **Coding Standards**
- **JavaScript Only** - No TypeScript
- **Functional Components** - Use hooks
- **Server Components** when possible
- **Hebrew Comments** for UI text
- **English Comments** for logic

### **Database Interaction**
- Always use Supabase client from `src/lib/supabase.js`
- Implement Row Level Security (RLS)
- Use prepared statements for security
- Handle errors gracefully

### **Authentication Pattern**
```javascript
// Always check auth first
const user = getCurrentUser();
if (!user) {
    router.push('/auth/login');
    return;
}
```

## 📧 **Email System Architecture**

### **Email Types**
1. **Registration Confirmation**
2. **Password Reset** 
3. **General Order Opening**
4. **24h Reminder**
5. **1h Reminder** 
6. **Order Closure Notification**
7. **PDF Report Delivery**

### **Template System**
- HTML templates with placeholders
- Arabic/Hebrew RTL support
- Responsive email design
- Automatic unsubscribe links

## 🔐 **Security Considerations**

### **Authentication**
- JWT tokens stored in localStorage
- Role-based access control (admin/user)
- Password reset with email verification
- Session timeout handling

### **Data Protection**
- Input sanitization
- SQL injection prevention
- XSS protection
- CORS configuration

## 📊 **Group Order Workflow**

### **Admin Workflow**
1. Create general order with deadline
2. Optionally schedule opening time
3. Monitor participation in real-time
4. Receive automated closure notifications
5. Download PDF reports
6. Archive completed orders

### **Customer Workflow**
1. Receive email when general order opens
2. Join group order before deadline
3. Receive reminder emails (24h, 1h)
4. Get notified when order closes
5. Track order status until delivery

### **Automatic System**
1. Send opening notifications
2. Schedule reminder emails
3. Auto-close at deadline
4. Generate PDF reports
5. Archive order data
6. Update shop status

## 🚀 **Development Priorities**

### **Phase 1: Restore Group Ordering (URGENT)**
1. Restore deleted APIs: `/api/general-orders/`, `/api/group-orders/`
2. Implement participation system
3. Fix shop logic to enforce group-only ordering
4. Test admin panel integration

### **Phase 2: Email & Automation**
1. Email reminder scheduling
2. Automatic order closure
3. PDF report generation
4. Notification system

### **Phase 3: Enhanced Features**
1. Real-time updates
2. Advanced reporting
3. Mobile optimization
4. Performance optimization

## ⚡ **Quick Commands**

### **Development Server**
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
```

### **Database Operations**
```bash
# Run schema updates
node setup-database.js

# Check database status
node check-database.cjs

# Fix database issues
node fix-database.js
```

## 🐛 **Common Issues & Solutions**

### **Authentication Loops**
- Check localStorage token validity
- Verify role-based redirects
- Clear storage if corrupted

### **CSS Conflicts**
- No Tailwind classes should remain
- Use custom utilities only
- Check RTL direction settings

### **API Errors**
- Verify Supabase connection
- Check RLS policies
- Validate request format

## 📝 **Documentation Standards**

### **Code Comments**
```javascript
// English for logic explanations
// Hebrew for UI-related content: רק עבור תוכן ממשק המשתמש
```

### **API Documentation**
- Document all endpoints
- Include request/response examples
- Specify error codes
- Note authentication requirements

### **Database Changes**
- Document schema migrations
- Explain business logic
- Include rollback procedures
- Test with sample data

## 🎭 **Business Rules**

### **Core Constraints**
1. **No individual orders** - only group orders allowed
2. **Admin controls timing** - shop opens/closes per general orders
3. **Email notifications required** - all participants must be notified
4. **Deadline enforcement** - automatic closure at specified time
5. **PDF reporting** - admin gets detailed reports
6. **Historical tracking** - all orders archived

### **User Permissions**
- **Admin**: Full system control, order management, user management
- **User**: Join group orders, view order history, update profile

### **Shop Status Logic**
- **Closed**: No active general orders
- **Open**: At least one active general order
- **Scheduled**: General order scheduled for future opening

## 🔍 **Testing Guidelines**

### **Manual Testing Checklist**
- [ ] User registration/login flow
- [ ] Admin panel functionality
- [ ] Group order creation/participation
- [ ] Email notifications
- [ ] PDF generation
- [ ] Automatic closure

### **Database Testing**
- [ ] RLS policies enforce security
- [ ] Foreign key constraints work
- [ ] Triggers execute properly
- [ ] Data integrity maintained

## 🚀 **Deployment Notes**

### **Environment Variables**
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
```

### **Production Checklist**
- [ ] Environment variables set
- [ ] Database migrations applied
- [ ] Email service configured
- [ ] PDF generation working
- [ ] Security headers configured
- [ ] Performance optimized

---

## 🎯 **Key Success Metrics**
- Group order participation rate
- Email delivery success
- System uptime during order periods
- User satisfaction with notification timing
- Admin efficiency in order management

**Remember**: This is a **group ordering system**, not a traditional e-commerce shop. The entire business model revolves around time-limited group orders with automated email notifications and PDF reporting.