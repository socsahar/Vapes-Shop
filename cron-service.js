#!/usr/bin/env node

/**
 * Railway Cron Service
 * Runs every 5 minutes to process scheduled orders
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '.env.local') });

async function runCronJob() {
    console.log(`🕐 [${new Date().toISOString()}] Starting scheduled cron job...`);
    
    try {
        // Import the actual cron logic
        const { default: cronFunction } = await import('./cron-general-orders.js');
        
        // Run the cron job
        await cronFunction();
        
        console.log(`✅ [${new Date().toISOString()}] Cron job completed successfully`);
    } catch (error) {
        console.error(`❌ [${new Date().toISOString()}] Cron job failed:`, error);
        process.exit(1);
    }
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runCronJob();
}

export default runCronJob;