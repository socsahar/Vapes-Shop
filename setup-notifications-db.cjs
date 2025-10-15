/**
 * Setup Push Notifications Database Table
 * Run this once to create the push_notifications table in Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
    try {
        console.log('🚀 Setting up push notifications database...\n');

        // Read SQL file
        const sqlPath = path.join(__dirname, 'database', 'push_notifications.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('📄 SQL file loaded successfully');
        console.log('📝 Executing SQL commands...\n');

        // Split SQL into individual statements
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            console.log(`Executing statement ${i + 1}/${statements.length}...`);
            
            try {
                const { error } = await supabase.rpc('exec_sql', { 
                    sql_query: statement + ';' 
                });
                
                if (error) {
                    // Try direct execution if rpc fails
                    console.log('  ⚠️  RPC method not available, trying direct execution...');
                    console.log('  ℹ️  Please run this SQL manually in Supabase SQL Editor:');
                    console.log('     https://supabase.com/dashboard/project/' + supabaseUrl.split('.')[0].split('//')[1] + '/editor');
                    console.log('\n' + sql + '\n');
                    break;
                }
                
                console.log('  ✅ Success');
            } catch (err) {
                console.log('  ⚠️  Statement failed (may already exist):', err.message);
            }
        }

        // Test if table was created
        console.log('\n🧪 Testing table creation...');
        const { data, error } = await supabase
            .from('push_notifications')
            .select('count')
            .limit(1);

        if (error) {
            console.log('\n⚠️  Table not found. Please create it manually:');
            console.log('\n1. Go to Supabase Dashboard → SQL Editor');
            console.log('2. Copy and paste this file: database/push_notifications.sql');
            console.log('3. Click "Run"\n');
        } else {
            console.log('✅ Table exists and is accessible!\n');
            console.log('🎉 Push notifications database setup complete!');
            console.log('\n📱 Next steps:');
            console.log('1. Rebuild your Median app with OneSignal enabled');
            console.log('2. Test sending a notification from admin panel');
            console.log('3. Check OneSignal dashboard for delivery stats\n');
        }

    } catch (error) {
        console.error('\n❌ Error setting up database:', error);
        console.log('\n💡 Manual Setup Required:');
        console.log('1. Go to: https://supabase.com/dashboard');
        console.log('2. Select your project');
        console.log('3. Go to SQL Editor');
        console.log('4. Copy/paste contents of: database/push_notifications.sql');
        console.log('5. Click "Run"\n');
    }
}

setupDatabase();
