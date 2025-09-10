#!/usr/bin/env node

/**
 * Production Preparation Script
 * Prepares the vape shop codebase for production deployment
 */

import fs from 'fs';
import path from 'path';

console.log('🚀 Preparing Vape Shop for Production...\n');

// Check if required files exist
const requiredFiles = [
  '.env.example',
  'DEPLOYMENT.md', 
  'PRODUCTION_CHECKLIST.md',
  'package.json',
  '.gitignore'
];

console.log('✅ Checking required files...');
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`   ✓ ${file}`);
  } else {
    console.log(`   ❌ ${file} (missing)`);
  }
});

// Check environment template
console.log('\n📋 Environment Configuration...');
if (fs.existsSync('.env.example')) {
  const envExample = fs.readFileSync('.env.example', 'utf8');
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY', 
    'GMAIL_USER',
    'GMAIL_APP_PASSWORD',
    'JWT_SECRET',
    'NEXTAUTH_SECRET'
  ];
  
  requiredVars.forEach(envVar => {
    if (envExample.includes(envVar)) {
      console.log(`   ✓ ${envVar}`);
    } else {
      console.log(`   ❌ ${envVar} (missing from .env.example)`);
    }
  });
} else {
  console.log('   ❌ .env.example not found');
}

// Check for development files that should be excluded
console.log('\n🧹 Development Files Check...');
const devFiles = [
  'debug_orderitems.js',
  'quick_debug.js', 
  'test-connection.js',
  'test-orders.js',
  'auto_close_scheduler.bat',
  'test_auto_close.bat'
];

devFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`   ⚠️  ${file} (will be excluded by .gitignore)`);
  } else {
    console.log(`   ✓ ${file} (not present)`);
  }
});

// Check package.json for production readiness
console.log('\n📦 Package Configuration...');
if (fs.existsSync('package.json')) {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  const requiredScripts = ['build', 'start', 'dev'];
  requiredScripts.forEach(script => {
    if (pkg.scripts && pkg.scripts[script]) {
      console.log(`   ✓ npm run ${script}`);
    } else {
      console.log(`   ❌ npm run ${script} (missing)`);
    }
  });
  
  // Check for production dependencies
  const prodDeps = [
    'next',
    '@supabase/supabase-js',
    'nodemailer',
    'bcryptjs',
    'react',
    'react-dom'
  ];
  
  console.log('\n   Dependencies:');
  prodDeps.forEach(dep => {
    if (pkg.dependencies && pkg.dependencies[dep]) {
      console.log(`   ✓ ${dep}`);
    } else {
      console.log(`   ❌ ${dep} (missing)`);
    }
  });
}

// Final recommendations
console.log('\n🎯 Production Deployment Steps:');
console.log('   1. Create production Supabase project');
console.log('   2. Generate Gmail App Password');
console.log('   3. Create Railway account');
console.log('   4. Install Railway CLI: npm install -g @railway/cli');
console.log('   5. Deploy: railway login && railway init && railway deploy');
console.log('   6. Configure environment variables in Railway dashboard');
console.log('   7. Test all functionality in production');

console.log('\n📚 Documentation:');
console.log('   • DEPLOYMENT.md - Complete deployment guide');
console.log('   • PRODUCTION_CHECKLIST.md - Pre-launch checklist');
console.log('   • README.md - Production overview');

console.log('\n🎉 Ready for Production Deployment!');
console.log('\nNext step: Follow DEPLOYMENT.md for Railway deployment\n');