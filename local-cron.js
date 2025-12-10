#!/usr/bin/env node

/**
 * Local Development Cron Service
 * Runs continuously, checking every 2 minutes for order updates
 */

import { config } from 'dotenv';
import { default as cronFunction } from './cron-general-orders.js';

config({ path: '.env.local' });

console.log('\n═══════════════════════════════════════════════════════');
console.log('  🕐 Local Cron Service - Running');
console.log('═══════════════════════════════════════════════════════\n');
console.log('⏰ Checking every 2 minutes for:');
console.log('  • Orders to open');
console.log('  • Reminders to send (1h & 30m)');
console.log('  • Orders to close');
console.log('  • WhatsApp notifications\n');
console.log('🔄 Press Ctrl+C to stop\n');

let isRunning = false;

async function runCron() {
    if (isRunning) {
        console.log('⏭️  Previous cron still running, skipping...');
        return;
    }

    isRunning = true;
    const startTime = new Date();
    
    try {
        console.log(`🔄 [${startTime.toLocaleString('he-IL')}] Running cron check...`);
        await cronFunction();
        
        const duration = Date.now() - startTime.getTime();
        console.log(`✅ [${new Date().toLocaleString('he-IL')}] Cron completed in ${duration}ms\n`);
    } catch (error) {
        console.error(`❌ [${new Date().toLocaleString('he-IL')}] Cron failed:`, error.message);
        console.error('Stack:', error.stack);
    } finally {
        isRunning = false;
    }
}

// Run immediately on start
runCron();

// Then run every 2 minutes (120000ms)
const interval = setInterval(runCron, 120000);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n⏹️  Stopping cron service...');
    clearInterval(interval);
    console.log('✅ Cron service stopped\n');
    process.exit(0);
});

process.on('SIGTERM', () => {
    clearInterval(interval);
    process.exit(0);
});

// Keep the process alive
process.stdin.resume();
