# Production Deployment Guide - Railway Platform

This guide walks you through deploying your vape shop e-commerce system to Railway.

## 🚀 Quick Start

1. **Create Railway Account**: Visit [railway.app](https://railway.app) and sign up
2. **Install Railway CLI**: `npm install -g @railway/cli`
3. **Login**: `railway login`
4. **Deploy**: `railway deploy`

## 📋 Pre-Deployment Checklist

### ✅ Environment Security
- [ ] All sensitive data moved to environment variables
- [ ] `.env.example` created with all required variables
- [ ] `.gitignore` updated for production security
- [ ] No hardcoded credentials in codebase

### ✅ Database Setup
- [ ] Supabase project configured for production
- [ ] RLS policies enabled and tested
- [ ] Database schema deployed
- [ ] Admin user created

### ✅ Email Service
- [ ] Gmail App Password generated
- [ ] Email templates tested
- [ ] SMTP configuration verified

## 🔧 Environment Variables Setup

Copy `.env.example` to `.env` and configure:

### Required Variables
```env
# Database Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Email Configuration
GMAIL_USER=your_gmail_address
GMAIL_APP_PASSWORD=your_gmail_app_password

# Security
JWT_SECRET=your_jwt_secret_256_bit
NEXTAUTH_SECRET=your_nextauth_secret

# Application
NEXT_PUBLIC_BASE_URL=https://your-app.railway.app
NODE_ENV=production
```

### Railway Environment Setup
1. Go to your Railway dashboard
2. Select your project
3. Navigate to Variables tab
4. Add all environment variables from `.env.example`

## 🚂 Railway Deployment Steps

### 1. Initial Setup
```bash
# Clone repository
git clone <your-repo-url>
cd vapes-upgraded

# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login
```

### 2. Create Project
```bash
# Initialize Railway project
railway init

# Select "Deploy from GitHub repo" option
# Connect your GitHub repository
```

### 3. Configure Build Settings
Railway will auto-detect Next.js. Default settings:
- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Port**: 3000 (auto-configured)

### 4. Add Environment Variables
In Railway dashboard:
1. Go to Variables tab
2. Add all variables from `.env.example`
3. Set `NODE_ENV=production`

### 5. Deploy
```bash
# Deploy from CLI
railway deploy

# Or use GitHub integration for automatic deployments
```

## 🗄️ Database Configuration

### Supabase Production Setup
1. Create production Supabase project
2. Configure custom domain (optional)
3. Enable RLS policies
4. Set up database schema:

```sql
-- Run the schema files in order:
-- 1. database/supabase_schema.sql
-- 2. database/supabase_general_order_system.sql
```

### Connection Verification
Test database connection after deployment:
```bash
# Access Railway shell
railway shell

# Test database connection
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('products').select('count').then(console.log);
"
```

## 📧 Email Service Setup

### Gmail Configuration
1. Enable 2FA on Gmail account
2. Generate App Password:
   - Google Account Settings → Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
3. Use App Password in `GMAIL_APP_PASSWORD` variable

### Email Testing
Test email service after deployment:
```bash
# Test email endpoint
curl -X POST https://your-app.railway.app/api/admin/test-email \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

## 🔒 Security Configuration

### Production Security Checklist
- [ ] JWT secrets are 256-bit random strings
- [ ] Database RLS policies enabled
- [ ] CORS configured for production domain
- [ ] Rate limiting enabled
- [ ] Input validation implemented
- [ ] XSS protection enabled

### Generate Secure Secrets
```bash
# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate NextAuth secret
openssl rand -base64 32
```

## 🌐 Domain Configuration

### Custom Domain (Optional)
1. Railway dashboard → Settings → Domains
2. Add custom domain
3. Configure DNS records:
   - CNAME: `your-domain.com` → `your-app.railway.app`
4. Update `NEXT_PUBLIC_BASE_URL` environment variable

## 📊 Monitoring & Logs

### View Logs
```bash
# View live logs
railway logs

# View specific service logs
railway logs --service web
```

### Health Checks
Railway automatically monitors:
- Application uptime
- Response times
- Error rates

Access metrics in Railway dashboard → Metrics tab

## 🔄 Continuous Deployment

### GitHub Integration
1. Connect GitHub repository in Railway dashboard
2. Enable auto-deploy on push to main branch
3. Configure deployment branch (default: main)

### Manual Deployment
```bash
# Deploy specific branch
railway deploy --service web

# Deploy with custom build command
railway deploy --service web --build-cmd "npm run build:prod"
```

## 🚨 Troubleshooting

### Common Issues

#### Build Failures
```bash
# Check build logs
railway logs --service web

# Common fixes:
# 1. Verify package.json scripts
# 2. Check Node.js version compatibility
# 3. Ensure all dependencies listed
```

#### Database Connection Issues
```bash
# Verify environment variables
railway variables

# Test connection
railway shell
node -e "console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)"
```

#### Email Service Issues
```bash
# Verify Gmail configuration
railway variables | grep GMAIL

# Test SMTP connection
railway shell
node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});
transporter.verify().then(console.log).catch(console.error);
"
```

## 📞 Support

### Railway Support
- Documentation: [docs.railway.app](https://docs.railway.app)
- Discord: [Railway Discord](https://discord.gg/railway)
- Support: [help.railway.app](https://help.railway.app)

### Application Support
- Check application logs: `railway logs`
- Database issues: Verify Supabase connection
- Email issues: Verify Gmail App Password

## 🎯 Post-Deployment

### Final Steps
1. Test all application features
2. Verify email notifications work
3. Check admin panel functionality
4. Test order processing
5. Verify PDF generation
6. Monitor application performance

### Performance Optimization
- Enable Railway's CDN for static assets
- Monitor memory usage and scale if needed
- Set up database connection pooling
- Configure caching strategies

---

## 📝 Additional Notes

- Railway automatically handles SSL certificates
- Database backups are handled by Supabase
- Scale vertically by upgrading Railway plan
- Monitor costs in Railway dashboard

Your vape shop is now ready for production! 🎉