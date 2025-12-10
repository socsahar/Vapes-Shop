#!/usr/bin/env node

/**
 * WhatsApp Bot Authentication Script
 * Run this to authenticate WhatsApp bot with QR code
 * Usage: npm run whatsapp:auth
 */

import { config } from 'dotenv';
import qrcode from 'qrcode-terminal';
import WhatsAppClient from './BotVapes/whatsappClient.js';

// Load environment variables
config({ path: '.env.local' });

console.log('');
console.log('═══════════════════════════════════════════════════════');
console.log('  🤖 WhatsApp Bot - Authentication');
console.log('═══════════════════════════════════════════════════════');
console.log('');

async function main() {
    try {
        console.log('📱 Starting WhatsApp authentication...\n');
        console.log('⏳ Please wait while we initialize the connection...\n');

        const client = new WhatsAppClient();
        
        // Override QR display to use terminal
        const originalHandleUpdate = client.handleConnectionUpdate.bind(client);
        client.handleConnectionUpdate = async function(update) {
            const { qr, connection } = update;
            
            if (qr) {
                console.log('');
                console.log('═══════════════════════════════════════════════════════');
                console.log('  📱 SCAN THIS QR CODE WITH WHATSAPP');
                console.log('═══════════════════════════════════════════════════════');
                console.log('');
                qrcode.generate(qr, { small: true });
                console.log('');
                console.log('Instructions:');
                console.log('1. Open WhatsApp on your phone');
                console.log('2. Tap Menu (⋮) > Linked Devices');
                console.log('3. Tap "Link a Device"');
                console.log('4. Point your phone at this screen to scan the QR code');
                console.log('');
                console.log('⏳ Waiting for scan...');
                console.log('');
            }
            
            if (connection === 'open') {
                console.log('');
                console.log('═══════════════════════════════════════════════════════');
                console.log('  ✅ WHATSAPP CONNECTED SUCCESSFULLY!');
                console.log('═══════════════════════════════════════════════════════');
                console.log('');
                console.log(`📞 Phone Number: ${client.sock.user?.id?.split(':')[0] || 'Unknown'}`);
                console.log(`👤 Name: ${client.sock.user?.name || 'Unknown'}`);
                console.log('');
                console.log('✅ Authentication saved! You can now close this window.');
                console.log('');
                console.log('Next steps:');
                console.log('1. Start the listener: npm run whatsapp:listen');
                console.log('2. Or integrate with cron: npm run cron');
                console.log('');
                console.log('💡 The bot will now automatically reconnect when needed.');
                console.log('');
                
                // Keep running for a bit to ensure session is saved
                setTimeout(() => {
                    console.log('✅ Session saved. You can press Ctrl+C to exit.');
                    console.log('');
                }, 3000);
            }
            
            // Call original handler
            await originalHandleUpdate(update);
        };

        await client.connect();

        // Keep process alive
        console.log('🔄 Process running... Press Ctrl+C to exit after authentication.\n');

    } catch (error) {
        console.error('');
        console.error('═══════════════════════════════════════════════════════');
        console.error('  ❌ AUTHENTICATION FAILED');
        console.error('═══════════════════════════════════════════════════════');
        console.error('');
        console.error('Error:', error.message);
        console.error('');
        console.error('Troubleshooting:');
        console.error('1. Make sure your internet connection is stable');
        console.error('2. Check that ports are not blocked by firewall');
        console.error('3. Try running the script again');
        console.error('4. Check .env.local file has correct Supabase credentials');
        console.error('');
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('');
    console.log('👋 Shutting down gracefully...');
    console.log('');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('');
    console.log('👋 Shutting down gracefully...');
    console.log('');
    process.exit(0);
});

main();
