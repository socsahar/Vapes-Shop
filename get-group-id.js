#!/usr/bin/env node

/**
 * Quick script to get your WhatsApp group ID from recent messages
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n📋 Recent WhatsApp Activity:\n');

const { data, error } = await supabase
    .from('whatsapp_activity_log')
    .select('*')
    .eq('activity_type', 'message_received')
    .order('created_at', { ascending: false })
    .limit(10);

if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
}

if (!data || data.length === 0) {
    console.log('⚠️ No messages received yet.');
    console.log('\n💡 Send a message to your WhatsApp bot from the group to see it here.\n');
    process.exit(0);
}

console.log('Recent messages:\n');
data.forEach((log, i) => {
    let details = log.details;
    if (typeof details === 'string') {
        try {
            details = JSON.parse(details);
        } catch (e) {
            details = {};
        }
    }
    details = details || {};
    
    console.log(`${i + 1}. From: ${details.from || log.user_id || 'Unknown'}`);
    console.log(`   Message: ${details.message || details.text || 'N/A'}`);
    console.log(`   Time: ${new Date(log.created_at).toLocaleString()}`);
    if (details.from && details.from.includes('@g.us')) {
        console.log(`   ✅ GROUP ID: ${details.from}`);
    }
    console.log('');
});

console.log('\n📝 Group IDs end with "@g.us"');
console.log('📝 Copy the group ID and use it in the next step!\n');
