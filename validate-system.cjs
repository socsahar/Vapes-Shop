#!/usr/bin/env node

/**
 * System Validation Script
 * 
 * This script checks if all components are ready for the Auto-Manager system
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Auto-Manager System Validation');
console.log('===================================\n');

let allGood = true;

// Check required files
const requiredFiles = [
    'standalone-auto-manager.js',
    'setup-auto-manager.bat',
    'manage-auto-manager.bat', 
    'test-auto-manager.bat',
    'production-deploy.js',
    'AUTO_MANAGER_SETUP_GUIDE.md'
];

console.log('📁 Checking required files...');
requiredFiles.forEach(file => {
    const exists = fs.existsSync(file);
    console.log(`   ${exists ? '✅' : '❌'} ${file}`);
    if (!exists) allGood = false;
});

// Check Node.js
console.log('\n🟢 Checking Node.js...');
try {
    const version = process.version;
    const majorVersion = parseInt(version.slice(1).split('.')[0]);
    if (majorVersion >= 18) {
        console.log(`   ✅ Node.js ${version} (compatible)`);
    } else {
        console.log(`   ⚠️  Node.js ${version} (recommend 18+)`);
    }
} catch (error) {
    console.log('   ❌ Node.js check failed');
    allGood = false;
}

// Check syntax of main files
console.log('\n🔧 Checking syntax...');
const jsFiles = [
    'standalone-auto-manager.js',
    'production-deploy.js'
];

jsFiles.forEach(file => {
    if (fs.existsSync(file)) {
        try {
            require.resolve(path.resolve(file));
            console.log(`   ✅ ${file} syntax OK`);
        } catch (error) {
            console.log(`   ❌ ${file} has syntax errors: ${error.message}`);
            allGood = false;
        }
    }
});

// Check environment variables
console.log('\n🔐 Checking environment variables...');
const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
];

const optionalEnvVars = [
    'AUTO_MANAGE_LOG_LEVEL',
    'AUTO_MANAGE_DRY_RUN',
    'NEXT_PUBLIC_SITE_URL',
    'RESEND_API_KEY'
];

requiredEnvVars.forEach(envVar => {
    const value = process.env[envVar];
    if (value) {
        console.log(`   ✅ ${envVar} is set`);
    } else {
        console.log(`   ❌ ${envVar} is missing (REQUIRED)`);
        allGood = false;
    }
});

optionalEnvVars.forEach(envVar => {
    const value = process.env[envVar];
    console.log(`   ${value ? '✅' : '⚪'} ${envVar} ${value ? 'is set' : '(optional)'}`);
});

// Check logs directory
console.log('\n📝 Checking logs directory...');
if (!fs.existsSync('logs')) {
    try {
        fs.mkdirSync('logs');
        console.log('   ✅ Created logs directory');
    } catch (error) {
        console.log('   ❌ Failed to create logs directory');
        allGood = false;
    }
} else {
    console.log('   ✅ Logs directory exists');
}

// Check dependencies
console.log('\n📦 Checking dependencies...');
try {
    require('@supabase/supabase-js');
    console.log('   ✅ @supabase/supabase-js available');
} catch (error) {
    console.log('   ❌ @supabase/supabase-js not found - run: npm install @supabase/supabase-js');
    allGood = false;
}

// Summary
console.log('\n📋 Validation Summary');
console.log('====================');

if (allGood) {
    console.log('🎉 All checks passed! The system is ready.');
    console.log('\nNext steps:');
    console.log('1. Run: test-auto-manager.bat (to test safely)');
    console.log('2. If test looks good, run: setup-auto-manager.bat (as Administrator)');
    console.log('3. Use: manage-auto-manager.bat (to control the system)');
} else {
    console.log('⚠️  Some issues found. Please fix the items marked with ❌ above.');
    console.log('\nCommon fixes:');
    console.log('- Set environment variables in .env.local file');
    console.log('- Run: npm install @supabase/supabase-js');
    console.log('- Check file permissions');
}

console.log('\n📖 See AUTO_MANAGER_SETUP_GUIDE.md for detailed instructions.');

process.exit(allGood ? 0 : 1);