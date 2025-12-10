#!/usr/bin/env node

/**
 * Check admin phone numbers
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n👥 Checking Admin Status...\n');

// Get all admins
const { data: admins } = await supabase
    .from('whatsapp_admins')
    .select('*')
    .eq('is_active', true);

console.log('Active Admins:');
admins.forEach(admin => {
    console.log(`  • ${admin.full_name}: ${admin.phone}`);
});

// Check if specific number is admin
const testPhone = '972526063243';
const { data: isAdmin } = await supabase
    .rpc('is_whatsapp_admin', { p_phone: testPhone });

console.log(`\n✅ Is ${testPhone} an admin? ${isAdmin ? 'YES' : 'NO'}`);

// Also try with the @s.whatsapp.net format
const testPhone2 = '972526063243@s.whatsapp.net';
console.log(`\n🔍 Testing with full JID: ${testPhone2}`);
const phoneOnly = testPhone2.split('@')[0];
console.log(`   Extracted phone: ${phoneOnly}`);

const { data: isAdmin2 } = await supabase
    .rpc('is_whatsapp_admin', { p_phone: phoneOnly });
console.log(`   Is admin? ${isAdmin2 ? 'YES' : 'NO'}\n`);
