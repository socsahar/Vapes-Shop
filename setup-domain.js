#!/usr/bin/env node
/**
 * 🔧 Quick Domain Setup Script
 * Updates environment variables for production deployment
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('🔧 Quick Production Domain Setup');
console.log('=================================\n');

console.log('This script will help you update your environment variables for production.\n');

// Prompt for domain
rl.question('Enter your production domain (e.g., https://yourdomain.com): ', (domain) => {
    if (!domain.startsWith('http')) {
        domain = `https://${domain}`;
    }
    
    // Remove trailing slash if present
    domain = domain.replace(/\/$/, '');
    
    console.log(`\n📝 Updating environment variables with domain: ${domain}\n`);
    
    try {
        // Read current .env.local
        let envContent = '';
        if (fs.existsSync(path.join(__dirname, '.env.local'))) {
            envContent = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
        } else {
            console.log('📋 Creating new .env.local from template...');
            envContent = fs.readFileSync(path.join(__dirname, '.env.production'), 'utf8');
        }
        
        // Update domain-related variables
        envContent = envContent.replace(
            /NEXT_PUBLIC_BASE_URL=.*/g,
            `NEXT_PUBLIC_BASE_URL=${domain}`
        );
        
        envContent = envContent.replace(
            /NEXT_PUBLIC_SITE_URL=.*/g,
            `NEXT_PUBLIC_SITE_URL=${domain}`
        );
        
        envContent = envContent.replace(
            /NEXTAUTH_URL=.*/g,
            `NEXTAUTH_URL=${domain}`
        );
        
        // Remove localhost references
        envContent = envContent.replace(/localhost:3000/g, domain.replace('https://', ''));
        envContent = envContent.replace(/http:\/\/localhost:3000/g, domain);
        
        // Write updated .env.local
        fs.writeFileSync(path.join(__dirname, '.env.local'), envContent);
        
        console.log('✅ Environment variables updated successfully!');
        console.log('\n📋 Updated variables:');
        console.log(`   NEXT_PUBLIC_BASE_URL=${domain}`);
        console.log(`   NEXT_PUBLIC_SITE_URL=${domain}`);
        console.log(`   NEXTAUTH_URL=${domain}`);
        
        console.log('\n⚠️  Remember to also update:');
        console.log('   - GMAIL_USER (your business email)');
        console.log('   - GMAIL_APP_PASSWORD (Gmail app password)');
        console.log('   - Supabase credentials');
        console.log('   - JWT and NEXTAUTH secrets');
        console.log('   - Admin email and password');
        
        console.log('\n🚀 Ready for production!');
        console.log('   Run: npm run build && npm run start');
        
    } catch (error) {
        console.error('❌ Error updating environment variables:', error.message);
    }
    
    rl.close();
});

rl.on('SIGINT', () => {
    console.log('\n\n👋 Setup cancelled. Run this script again when ready!');
    process.exit(0);
});