#!/usr/bin/env node

/**
 * Check all WhatsApp activity logs
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n📋 All WhatsApp Activity:\n');

const { data, error } = await supabase
    .from('whatsapp_activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
}

if (!data || data.length === 0) {
    console.log('⚠️ No activity logged yet.');
    process.exit(0);
}

console.log('Raw data:\n');
data.forEach((log, i) => {
    console.log(`${i + 1}. Activity Type: ${log.activity_type}`);
    console.log(`   User ID: ${log.user_id || 'N/A'}`);
    console.log(`   Status: ${log.status}`);
    console.log(`   Details: ${JSON.stringify(log.details, null, 2)}`);
    console.log(`   Error: ${log.error_message || 'None'}`);
    console.log(`   Time: ${new Date(log.created_at).toLocaleString()}`);
    console.log('');
});

console.log('\n💡 To get group ID, you need to:');
console.log('1. Run: npm run whatsapp:listen');
console.log('2. Send a message to the bot from your WhatsApp group');
console.log('3. The group ID will appear in the logs\n');
