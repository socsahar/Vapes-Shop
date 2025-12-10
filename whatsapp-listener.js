#!/usr/bin/env node

/**
 * WhatsApp Bot Listener Service
 * Keeps WhatsApp bot connected and listening for messages
 * Usage: npm run whatsapp:listen
 */

import { config } from 'dotenv';
import { getWhatsAppClient } from './BotVapes/whatsappClient.js';

// Load environment variables
config({ path: '.env.local' });

console.log('');
console.log('═══════════════════════════════════════════════════════');
console.log('  🤖 WhatsApp Bot - Listener Service');
console.log('═══════════════════════════════════════════════════════');
console.log('');
console.log(`⏰ Started: ${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}`);
console.log('');

async function main() {
    try {
        const client = getWhatsAppClient();
        
        console.log('🔄 Initializing WhatsApp client...');
        await client.connect();
        
        console.log('');
        console.log('✅ WhatsApp Bot is now running!');
        console.log('');
        console.log('📋 Features enabled:');
        console.log('  ✅ Message queue processing');
        console.log('  ✅ Admin command handling');
        console.log('  ✅ Auto-reconnection');
        console.log('  ✅ Activity logging');
        console.log('');
        console.log('💡 Send /help from admin phone to see available commands');
        console.log('');
        console.log('🔄 Press Ctrl+C to stop');
        console.log('');

        // Keep process alive and show periodic status
        setInterval(() => {
            const status = client.getStatus();
            const time = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
            
            if (status.isConnected) {
                console.log(`✅ [${time}] Bot active and processing messages...`);
            } else {
                console.log(`⚠️ [${time}] Bot disconnected - attempting reconnection...`);
            }
        }, 60000); // Every minute

    } catch (error) {
        console.error('');
        console.error('═══════════════════════════════════════════════════════');
        console.error('  ❌ LISTENER FAILED TO START');
        console.error('═══════════════════════════════════════════════════════');
        console.error('');
        console.error('Error:', error.message);
        console.error('');
        console.error('Possible solutions:');
        console.error('1. Run authentication first: npm run whatsapp:auth');
        console.error('2. Check .env.local configuration');
        console.error('3. Ensure Supabase credentials are correct');
        console.error('4. Check internet connection');
        console.error('');
        process.exit(1);
    }
}

// Handle graceful shutdown
async function shutdown() {
    console.log('');
    console.log('🛑 Shutting down WhatsApp Bot...');
    
    try {
        const client = getWhatsAppClient();
        await client.disconnect();
        console.log('✅ Disconnected successfully');
    } catch (error) {
        console.error('⚠️ Error during shutdown:', error.message);
    }
    
    console.log('👋 Goodbye!');
    console.log('');
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('');
    console.error('❌ Uncaught Exception:', error);
    console.error('');
    shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('');
    console.error('❌ Unhandled Rejection at:', promise);
    console.error('Reason:', reason);
    console.error('');
});

main();
