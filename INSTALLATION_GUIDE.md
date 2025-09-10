# Vape Shop Israel - Installation & Setup Guide

## 🛠️ Complete Setup Documentation

This guide will help you set up the complete vape shop e-commerce system with admin panel, user management, and password reset functionality.

## 📋 Prerequisites

- Node.js (v18 or higher)
- npm or yarn package manager
- Git
- VS Code (recommended)
- Gmail account for email notifications

## 🚀 Installation Steps

### 1. Clone and Setup Project

```bash
# Clone the repository
git clone <your-repo-url>
cd vapes/Upgraded

# Install dependencies
npm install

# Or with yarn
yarn install
```

### 2. Environment Configuration

Create or update `.env.local` file with the following configuration:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://wdgodtzlnbchykmyzehi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkZ29kdHpsbmJjaHlrbXl6ZWhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMzU3MDksImV4cCI6MjA2OTkxMTcwOX0.id1bLR_Gw_mXscU9PrwpMFvG2wU18gWosHKLIyPXdFg
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkZ29kdHpsbmJjaHlrbXl6ZWhpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDMzNTcwOSwiZXhwIjoyMDY5OTExNzA5fQ.Qoo6aFZ4hiJ7dVCIAgAzELfFfnn9ai3TFXKof0T9wUI

# Email Configuration (Gmail SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
GMAIL_USER=sahargen7@gmail.com
EMAIL_PASS=kojqyacsnyzyewqx
EMAIL_PASSWORD=kojqyacsnyzyewqx

# JWT Secret for authentication
JWT_SECRET=your-super-secret-jwt-key-here-change-in-production

# Next.js Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-key

# Admin Configuration
ADMIN_EMAIL=sahargen7@gmail.com

# App Configuration
APP_NAME="Vape Shop Israel"
APP_DESCRIPTION="The best vape shop in Israel"
CURRENCY=ILS
```

### 3. Gmail App Password Setup

For email functionality to work, you need to set up a Gmail App Password:

1. Go to your Google Account settings
2. Navigate to Security → 2-Step Verification
3. At the bottom, select "App passwords"
4. Select "Mail" and your device
5. Generate the 16-character password
6. Replace `kojqyacsnyzyewqx` with your generated app password in `.env.local`

### 4. Database Setup

The Supabase database is already configured with all necessary tables:

- `users` - User accounts and authentication
- `products` - Product catalog
- `orders` - Order management
- `password_reset_tokens` - Password reset functionality
- `system_settings` - Application settings

### 5. Required VS Code Extensions

Install these extensions for optimal development experience:

```bash
# Install VS Code extensions
code --install-extension ms-vscode.vscode-typescript-next
code --install-extension bradlc.vscode-tailwindcss
code --install-extension esbenp.prettier-vscode
code --install-extension ms-vscode.vscode-json
```

## 🏃‍♂️ Running the Application

### Development Mode

```bash
# Start the development server
npm run dev

# Or with yarn
yarn dev
```

The application will be available at:
- **Frontend**: `http://localhost:3000`
- **Admin Panel**: `http://localhost:3000/admin`

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## 🔧 Core Features

### Authentication System
- User registration and login
- Password reset with email notifications
- Force password change functionality
- JWT-based authentication

### Admin Panel
- Professional modern UI with Hebrew RTL support
- User management (view, edit, delete, reset passwords)
- Real-time statistics dashboard
- Email notification system
- Responsive design

### User Management
- Complete CRUD operations
- Password reset with one-time tokens
- Email notifications for password resets
- Force password change after reset

### Email System
- Professional HTML email templates
- Password reset notifications
- Hebrew RTL support in emails
- Security warnings and instructions

## 📁 Project Structure

```
src/
├── app/
│   ├── admin/                 # Admin panel
│   │   └── page.js           # Main admin interface
│   ├── auth/                 # Authentication pages
│   │   ├── login/            # Login page
│   │   ├── register/         # Registration page
│   │   └── change-password/  # Password change page
│   ├── api/                  # API routes
│   │   ├── auth/             # Authentication APIs
│   │   ├── admin/            # Admin APIs
│   │   └── email/            # Email service APIs
│   ├── shop/                 # Shop pages
│   └── styles.css            # Global styles
├── lib/
│   ├── supabase.js           # Supabase client
│   └── auth.js               # Authentication helpers
└── components/               # Reusable components
```

## 🔐 Security Features

### Password Reset Flow
1. Admin clicks "Reset Password" on user
2. One-time password generated and displayed to admin
3. Email sent to user with secure reset link
4. User clicks link → redirected to change password page
5. User enters new password → account updated
6. Force password change flag removed
7. Reset token marked as used

### Security Measures
- Bcrypt password hashing
- Time-limited reset tokens
- One-time use tokens
- Secure email templates
- HTTPS enforcement in production

## 📧 Email Configuration

The system uses Gmail SMTP for sending emails. Features include:

- Professional HTML email templates
- Hebrew language support
- Responsive email design
- Security warnings
- Change password button links

## 🎨 Styling & UI

### Modern Admin Interface
- Professional card-based layout
- Responsive design (mobile-first)
- Hebrew RTL support
- Custom CSS variables
- Tailwind CSS integration
- Modern button styles and animations

### Color Scheme
- Primary: Blue tones (#3b82f6)
- Success: Green (#10b981)
- Warning: Yellow (#f59e0b)
- Danger: Red (#ef4444)
- Neutral: Gray scale

## 🔧 Development Tools

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
```

### Development Workflow
1. Make changes to code
2. Test in development mode
3. Check for TypeScript/ESLint errors
4. Build and test production build
5. Deploy to production

## 🐛 Troubleshooting

### Common Issues

#### Email Not Sending
- Check Gmail app password is correct
- Verify email credentials in `.env.local`
- Ensure 2-step verification is enabled on Gmail
- Check server logs for email errors

#### Database Connection Issues
- Verify Supabase URL and keys
- Check network connectivity
- Ensure RLS policies are properly configured

#### Build Errors
- Clear `.next` folder and rebuild
- Check for TypeScript errors
- Verify all dependencies are installed

### Debug Mode
Enable debug mode by setting:
```bash
DEBUG=true
NODE_ENV=development
```

## 📞 Support

For technical support or questions:
- Check the logs in browser console
- Review server logs for API errors
- Verify environment variables are set correctly
- Test email functionality with a simple test

## 🚀 Deployment

### Vercel Deployment
1. Connect GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on git push

### Manual Deployment
1. Build the project: `npm run build`
2. Upload to your hosting provider
3. Set environment variables
4. Start the production server

## 📝 License

This project is proprietary software for Vape Shop Israel.

---

**Last Updated**: January 2025
**Version**: 2.0.0
**Author**: Development Team