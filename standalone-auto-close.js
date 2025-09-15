#!/usr/bin/env node

/**
 * Comprehensive Auto-Management Script for General Orders
 * 
 * This script runs independently of the web server and directly connects to
 * the Supabase database to automatically manage general orders:
 * - Opens scheduled orders when their opening time arrives
 * - Closes expired orders when their deadline passes
 * 
 * Features:
 * - Direct database connection (no web server dependency)
 * - Comprehensive logging with rotation
 * - Email notification queueing
 * - Shop status management
 * - Error handling and recovery
 * - Production-ready for hosting environments
 * - Configurable via environment variables
 * 
 * Usage:
 *   node standalone-auto-manager.js
 * 
 * Environment Variables:
 *   NEXT_PUBLIC_SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key for admin access
 *   AUTO_MANAGE_LOG_LEVEL - debug, info, warn, error (default: info)
 *   AUTO_MANAGE_DRY_RUN - true/false (default: false)
 *   NEXT_PUBLIC_SITE_URL - Site URL for email links
 *   NODE_ENV - production/development environment
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local if exists
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.trim().split('=');
        if (key && valueParts.length > 0) {
            const value = valueParts.join('=').replace(/^["']|["']$/g, '');
            if (!process.env[key]) {
                process.env[key] = value;
            }
        }
    });
}

// Configuration
const CONFIG = {
    DRY_RUN: process.env.AUTO_MANAGE_DRY_RUN === 'true' || process.env.AUTO_CLOSE_DRY_RUN === 'true',
    LOG_LEVEL: process.env.AUTO_MANAGE_LOG_LEVEL || process.env.AUTO_CLOSE_LOG_LEVEL || 'info',
    SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    LOG_DIR: path.join(__dirname, 'logs'),
    LOG_FILE: path.join(__dirname, 'logs', 'auto-manager.log'),
    MAX_LOG_SIZE: 5 * 1024 * 1024, // 5MB
    MAX_LOG_FILES: 10,
    IS_PRODUCTION: process.env.NODE_ENV === 'production'
};

// Ensure logs directory exists
if (!fs.existsSync(CONFIG.LOG_DIR)) {
    fs.mkdirSync(CONFIG.LOG_DIR, { recursive: true });
}

// Initialize Supabase client
let supabase;
try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Missing Supabase environment variables');
    }
    
    supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
} catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    process.exit(1);
}

// Logging utilities
const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

function shouldLog(level) {
    return LOG_LEVELS[level] >= LOG_LEVELS[CONFIG.LOG_LEVEL];
}

function rotateLogFile() {
    try {
        if (fs.existsSync(CONFIG.LOG_FILE)) {
            const stats = fs.statSync(CONFIG.LOG_FILE);
            if (stats.size > CONFIG.MAX_LOG_SIZE) {
                // Rotate logs
                for (let i = CONFIG.MAX_LOG_FILES - 1; i > 0; i--) {
                    const oldFile = `${CONFIG.LOG_FILE}.${i}`;
                    const newFile = `${CONFIG.LOG_FILE}.${i + 1}`;
                    if (fs.existsSync(oldFile)) {
                        if (i === CONFIG.MAX_LOG_FILES - 1) {
                            fs.unlinkSync(oldFile);
                        } else {
                            fs.renameSync(oldFile, newFile);
                        }
                    }
                }
                fs.renameSync(CONFIG.LOG_FILE, `${CONFIG.LOG_FILE}.1`);
            }
        }
    } catch (error) {
        console.error('Log rotation failed:', error);
    }
}

function log(level, message, data = null) {
    if (!shouldLog(level)) return;
    
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    console.log(logMessage);
    if (data) {
        console.log(JSON.stringify(data, null, 2));
    }
    
    try {
        rotateLogFile();
        const fileMessage = data 
            ? `${logMessage}\n${JSON.stringify(data, null, 2)}\n`
            : `${logMessage}\n`;
        fs.appendFileSync(CONFIG.LOG_FILE, fileMessage);
    } catch (error) {
        console.error('Failed to write to log file:', error);
    }
}

// Database operations for expired orders for scheduled orders
async function getScheduledOrders() {
    try {
        log('debug', 'Fetching scheduled general orders ready to open...');
        
        const { data: scheduledOrders, error } = await supabase
            .from('general_orders')
            .select('id, title, opening_time, status, created_at, updated_at')
            .eq('status', 'scheduled')
            .not('opening_time', 'is', null)
            .lte('opening_time', new Date().toISOString());

        if (error) {
            throw new Error(`Database query failed: ${error.message}`);
        }

        log('debug', `Found ${scheduledOrders?.length || 0} scheduled orders ready to open`);
        return scheduledOrders || [];

    } catch (error) {
        log('error', 'Failed to fetch scheduled orders', { error: error.message });
        throw error;
    }
}

async function openScheduledOrders(orders) {
    if (!orders || orders.length === 0) {
        return [];
    }

    try {
        log('info', `Opening ${orders.length} scheduled orders`, { 
            orders: orders.map(o => ({ id: o.id, title: o.title, opening_time: o.opening_time }))
        });

        if (CONFIG.DRY_RUN) {
            log('info', 'DRY RUN: Would open scheduled orders but not executing', { orders });
            return orders;
        }

        const { data: openedOrders, error } = await supabase
            .from('general_orders')
            .update({
                status: 'open',
                updated_at: new Date().toISOString()
            })
            .in('id', orders.map(order => order.id))
            .select();

        if (error) {
            throw new Error(`Failed to open scheduled orders: ${error.message}`);
        }

        log('info', `Successfully opened ${openedOrders?.length || 0} orders`);
        return openedOrders || [];

    } catch (error) {
        log('error', 'Failed to open scheduled orders', { error: error.message, orders });
        throw error;
    }
}

async function manageShopForOpenedOrders(openedOrders) {
    for (const order of openedOrders) {
        try {
            // Check if there's already an active order in the shop
            const { data: shopStatus, error: shopError } = await supabase
                .from('shop_status')
                .select('id, current_general_order_id, is_open')
                .single();

            if (shopError) {
                log('warn', 'Could not fetch shop status', { error: shopError.message });
                continue;
            }

            // If shop doesn't have an active order, make this the active order
            if (!shopStatus?.current_general_order_id || !shopStatus.is_open) {
                log('info', `Setting shop to newly opened order: ${order.title}`, { orderId: order.id });

                if (!CONFIG.DRY_RUN) {
                    const { error: updateShopError } = await supabase
                        .from('shop_status')
                        .update({
                            is_open: true,
                            current_general_order_id: order.id,
                            message: `הזמנה קבוצתית פתוחה: ${order.title}`,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', shopStatus.id);

                    if (updateShopError) {
                        log('error', 'Failed to update shop for opened order', { error: updateShopError.message, orderId: order.id });
                    } else {
                        log('info', `Shop updated successfully for order: ${order.title}`);
                    }
                } else {
                    log('info', 'DRY RUN: Would update shop status');
                }
                
                // Only set the first order as active if multiple orders open simultaneously
                break;
            }

        } catch (error) {
            log('error', 'Error managing shop status for opened order', { error: error.message, orderId: order.id });
        }
    }
}

async function queueOpeningNotificationEmails(openedOrders) {
    for (const order of openedOrders) {
        try {
            log('debug', `Queueing opening notification emails for order: ${order.title}`);

            if (CONFIG.DRY_RUN) {
                log('info', 'DRY RUN: Would queue opening notification emails', { orderId: order.id });
                continue;
            }

            // Queue general order opened notification
            const { error: openingEmailError } = await supabase
                .from('email_logs')
                .insert([{
                    recipient_email: 'SYSTEM_ORDER_OPENED',
                    subject: `הזמנה קבוצתית נפתחה - ${order.title}`,
                    body: `GENERAL_ORDER_OPENED:${order.id}:SCHEDULED_AUTO`,
                    status: 'failed', // 'failed' status is used as queue
                    created_at: new Date().toISOString()
                }]);

            if (openingEmailError) {
                log('error', 'Failed to queue opening notification email', { 
                    error: openingEmailError.message, 
                    orderId: order.id 
                });
            } else {
                log('debug', 'Queued opening notification email');
            }

        } catch (error) {
            log('error', 'Error queueing opening notification emails', { 
                error: error.message, 
                orderId: order.id 
            });
        }
    }
}
async function getExpiredOrders() {
    try {
        log('debug', 'Fetching expired general orders...');
        
        const { data: expiredOrders, error } = await supabase
            .from('general_orders')
            .select('id, title, deadline, status, created_at, updated_at')
            .eq('status', 'open')
            .lt('deadline', new Date().toISOString());

        if (error) {
            throw new Error(`Database query failed: ${error.message}`);
        }

        log('debug', `Found ${expiredOrders?.length || 0} expired orders`);
        return expiredOrders || [];

    } catch (error) {
        log('error', 'Failed to fetch expired orders', { error: error.message });
        throw error;
    }
}

async function closeExpiredOrders(orders) {
    if (!orders || orders.length === 0) {
        return [];
    }

    try {
        log('info', `Closing ${orders.length} expired orders`, { 
            orders: orders.map(o => ({ id: o.id, title: o.title, deadline: o.deadline }))
        });

        if (CONFIG.DRY_RUN) {
            log('info', 'DRY RUN: Would close orders but not executing', { orders });
            return orders;
        }

        const { data: closedOrders, error } = await supabase
            .from('general_orders')
            .update({
                status: 'closed',
                updated_at: new Date().toISOString()
            })
            .in('id', orders.map(order => order.id))
            .select();

        if (error) {
            throw new Error(`Failed to close orders: ${error.message}`);
        }

        log('info', `Successfully closed ${closedOrders?.length || 0} orders`);
        return closedOrders || [];

    } catch (error) {
        log('error', 'Failed to close expired orders', { error: error.message, orders });
        throw error;
    }
}

async function manageShopStatus(closedOrders) {
    for (const order of closedOrders) {
        try {
            // Check if this was the current shop order
            const { data: shopStatus, error: shopError } = await supabase
                .from('shop_status')
                .select('id, current_general_order_id, is_open')
                .single();

            if (shopError) {
                log('warn', 'Could not fetch shop status', { error: shopError.message });
                continue;
            }

            if (shopStatus?.current_general_order_id === order.id) {
                log('info', `Closing shop for expired order: ${order.title}`, { orderId: order.id });

                if (!CONFIG.DRY_RUN) {
                    const { error: closeShopError } = await supabase
                        .from('shop_status')
                        .update({
                            is_open: false,
                            current_general_order_id: null,
                            message: 'החנות סגורה - ההזמנה הקבוצתית הסתיימה',
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', shopStatus.id);

                    if (closeShopError) {
                        log('error', 'Failed to close shop', { error: closeShopError.message, orderId: order.id });
                    } else {
                        log('info', `Shop closed successfully for order: ${order.title}`);
                    }
                } else {
                    log('info', 'DRY RUN: Would close shop');
                }
            }

        } catch (error) {
            log('error', 'Error managing shop status', { error: error.message, orderId: order.id });
        }
    }
}

async function queueNotificationEmails(closedOrders) {
    for (const order of closedOrders) {
        try {
            log('debug', `Queueing notification emails for order: ${order.title}`);

            if (CONFIG.DRY_RUN) {
                log('info', 'DRY RUN: Would queue notification emails', { orderId: order.id });
                continue;
            }

            // Queue closure notification email
            const { error: closureEmailError } = await supabase
                .from('email_logs')
                .insert([{
                    recipient_email: 'SYSTEM_ORDER_CLOSED',
                    subject: `הזמנה קבוצתית נסגרה אוטומטית - ${order.title}`,
                    body: `GENERAL_ORDER_CLOSED:${order.id}:EXPIRED_AUTO`,
                    status: 'failed', // 'failed' status is used as queue
                    created_at: new Date().toISOString()
                }]);

            if (closureEmailError) {
                log('error', 'Failed to queue closure notification email', { 
                    error: closureEmailError.message, 
                    orderId: order.id 
                });
            } else {
                log('debug', 'Queued closure notification email');
            }

            // Queue general order summary email for admins
            const { error: summaryEmailError } = await supabase
                .from('email_logs')
                .insert([{
                    recipient_email: 'SYSTEM_GENERAL_ORDER_SUMMARY',
                    subject: `סיכום הזמנה קבוצתית - ${order.title}`,
                    body: `GENERAL_ORDER_SUMMARY:${order.id}:AUTO_CLOSED`,
                    status: 'failed', // 'failed' status is used as queue
                    created_at: new Date().toISOString()
                }]);

            if (summaryEmailError) {
                log('error', 'Failed to queue summary email', { 
                    error: summaryEmailError.message, 
                    orderId: order.id 
                });
            } else {
                log('debug', 'Queued general order summary email');
            }

        } catch (error) {
            log('error', 'Error queueing notification emails', { 
                error: error.message, 
                orderId: order.id 
            });
        }
    }
}

async function testDatabaseConnection() {
    try {
        log('debug', 'Testing database connection...');
        
        const { data, error } = await supabase
            .from('general_orders')
            .select('id')
            .limit(1);

        if (error) {
            throw new Error(`Database connection test failed: ${error.message}`);
        }

        log('debug', 'Database connection successful');
        return true;

    } catch (error) {
        log('error', 'Database connection failed', { error: error.message });
        return false;
    }
}

// Main execution function
async function runAutoManager() {
    const startTime = new Date();
    
    log('info', '='.repeat(80));
    log('info', 'Auto-Manager Script Started (Open + Close)', {
        timestamp: startTime.toISOString(),
        dryRun: CONFIG.DRY_RUN,
        logLevel: CONFIG.LOG_LEVEL,
        environment: CONFIG.IS_PRODUCTION ? 'production' : 'development'
    });

    try {
        // Test database connection
        const dbConnected = await testDatabaseConnection();
        if (!dbConnected) {
            throw new Error('Database connection failed');
        }

        let totalProcessed = 0;
        const results = {
            opened: [],
            closed: [],
            errors: []
        };

        // 1. Process scheduled orders that should open
        try {
            const scheduledOrders = await getScheduledOrders();
            
            if (scheduledOrders.length > 0) {
                const openedOrders = await openScheduledOrders(scheduledOrders);
                await manageShopForOpenedOrders(openedOrders);
                await queueOpeningNotificationEmails(openedOrders);
                
                results.opened = openedOrders;
                totalProcessed += openedOrders.length;
                
                log('info', `Opened ${openedOrders.length} scheduled orders`);
            } else {
                log('info', 'No scheduled orders ready to open');
            }
        } catch (error) {
            log('error', 'Error in scheduled orders processing', { error: error.message });
            results.errors.push({ type: 'open', error: error.message });
        }

        // 2. Process expired orders that should close
        try {
            const expiredOrders = await getExpiredOrders();
            
            if (expiredOrders.length > 0) {
                const closedOrders = await closeExpiredOrders(expiredOrders);
                await manageShopStatus(closedOrders);
                await queueNotificationEmails(closedOrders);
                
                results.closed = closedOrders;
                totalProcessed += closedOrders.length;
                
                log('info', `Closed ${closedOrders.length} expired orders`);
            } else {
                log('info', 'No expired orders to close');
            }
        } catch (error) {
            log('error', 'Error in expired orders processing', { error: error.message });
            results.errors.push({ type: 'close', error: error.message });
        }

        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();

        if (totalProcessed === 0 && results.errors.length === 0) {
            log('info', 'No orders required processing - system healthy');
        }

        log('info', 'Auto-manager process completed', {
            totalProcessed,
            opened: results.opened.length,
            closed: results.closed.length,
            errors: results.errors.length,
            duration: `${duration}ms`,
            summary: {
                openedOrders: results.opened.map(o => ({
                    id: o.id,
                    title: o.title,
                    opening_time: o.opening_time
                })),
                closedOrders: results.closed.map(o => ({
                    id: o.id,
                    title: o.title,
                    deadline: o.deadline
                }))
            }
        });

        return {
            success: true,
            totalProcessed,
            opened: results.opened.length,
            closed: results.closed.length,
            errors: results.errors,
            duration
        };

    } catch (error) {
        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();

        log('error', 'Auto-manager process failed', {
            error: error.message,
            stack: error.stack,
            duration: `${duration}ms`
        });

        return {
            success: false,
            error: error.message,
            duration
        };

    } finally {
        log('info', 'Auto-Manager Script Completed');
        log('info', '='.repeat(80));
    }
}

// Execute if run directly
if (require.main === module) {
    runAutoManager()
        .then((result) => {
            if (result.success) {
                console.log(`✅ Auto-manager completed: ${result.totalProcessed} orders processed (${result.opened} opened, ${result.closed} closed)`);
                process.exit(0);
            } else {
                console.error(`❌ Auto-manager failed: ${result.error}`);
                process.exit(1);
            }
        })
        .catch((error) => {
            console.error('❌ Unexpected error:', error);
            process.exit(1);
        });
}

module.exports = { runAutoManager, runAutoClose: runAutoManager };