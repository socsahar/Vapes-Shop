import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const format = searchParams.get('format') || 'sql'; // Default to SQL format

        console.log('🗄️ Starting database backup...');

        if (format === 'sql') {
            return await generateSQLBackup();
        } else {
            return await generateJSONBackup();
        }

    } catch (error) {
        console.error('❌ Database backup error:', error);
        return NextResponse.json(
            { error: 'שגיאה ביצירת גיבוי מסד נתונים' },
            { status: 500 }
        );
    }
}

async function generateSQLBackup() {
    const sqlStatements = [];
    
    sqlStatements.push('-- Vape Shop Database Backup');
    sqlStatements.push(`-- Generated: ${new Date().toISOString()}`);
    sqlStatements.push('-- This SQL file can be run directly in Supabase SQL Editor\n');
    sqlStatements.push('-- WARNING: This will DELETE all existing data and restore from backup!\n');
    
    // List of tables in dependency order (important for foreign keys)
    const tables = [
        'users',
        'products',
        'general_orders',
        'orders',
        'order_items',
        'email_logs',
        'system_settings',
        'password_reset_tokens',
        'push_subscriptions',
        'push_notifications'
    ];

    for (const table of tables) {
        try {
            const { data, error } = await supabaseAdmin
                .from(table)
                .select('*');

            if (error) {
                console.warn(`⚠️ Could not backup table ${table}:`, error.message);
                sqlStatements.push(`\n-- ⚠️ Error backing up ${table}: ${error.message}`);
                continue;
            }

            if (!data || data.length === 0) {
                console.log(`ℹ️ Table ${table} is empty`);
                sqlStatements.push(`\n-- Table ${table} is empty`);
                continue;
            }

            console.log(`✅ Backing up ${data.length} records from ${table}`);
            
            sqlStatements.push(`\n-- ================================================`);
            sqlStatements.push(`-- Backup table: ${table} (${data.length} records)`);
            sqlStatements.push(`-- ================================================`);
            sqlStatements.push(`\n-- Clear existing data`);
            sqlStatements.push(`DELETE FROM ${table};`);
            sqlStatements.push(`\n-- Insert backed up data`);

            // Generate INSERT statements
            for (const row of data) {
                const columns = Object.keys(row);
                const values = columns.map(col => {
                    const value = row[col];
                    
                    if (value === null) return 'NULL';
                    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
                    if (typeof value === 'number') return value;
                    if (typeof value === 'string') {
                        // Escape single quotes for SQL
                        return `'${value.replace(/'/g, "''")}'`;
                    }
                    if (value instanceof Date) {
                        return `'${value.toISOString()}'`;
                    }
                    if (typeof value === 'object') {
                        // Handle JSON columns
                        return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
                    }
                    
                    return `'${String(value).replace(/'/g, "''")}'`;
                });

                sqlStatements.push(
                    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')});`
                );
            }

        } catch (tableError) {
            console.warn(`⚠️ Error backing up ${table}:`, tableError);
            sqlStatements.push(`\n-- ⚠️ Error backing up ${table}: ${tableError.message}`);
        }
    }

    // Add footer
    sqlStatements.push('\n-- ================================================');
    sqlStatements.push('-- Backup completed successfully!');
    sqlStatements.push('-- ================================================');
    sqlStatements.push(`-- Total tables backed up: ${tables.length}`);
    sqlStatements.push(`-- Restore: Copy and paste this entire file into Supabase SQL Editor and run it`);

    const sqlContent = sqlStatements.join('\n');
    const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `vape-shop-backup-${date}.sql`;

    return new NextResponse(sqlContent, {
        status: 200,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-cache'
        }
    });
}

async function generateJSONBackup() {
    const backup = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        data: {}
    };

    const tables = [
        'users',
        'products',
        'orders',
        'order_items',
        'general_orders',
        'email_logs',
        'system_settings',
        'password_reset_tokens',
        'push_subscriptions',
        'push_notifications'
    ];

    for (const table of tables) {
        try {
            const { data, error } = await supabaseAdmin
                .from(table)
                .select('*');

            if (error) {
                console.warn(`⚠️ Could not backup table ${table}:`, error.message);
                backup.data[table] = { error: error.message, records: [] };
            } else {
                backup.data[table] = data || [];
                console.log(`✅ Backed up ${data?.length || 0} records from ${table}`);
            }
        } catch (tableError) {
            console.warn(`⚠️ Error backing up ${table}:`, tableError);
            backup.data[table] = { error: tableError.message, records: [] };
        }
    }

    const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `vape-shop-backup-${date}.json`;

    return new NextResponse(JSON.stringify(backup, null, 2), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-cache'
        }
    });
}
