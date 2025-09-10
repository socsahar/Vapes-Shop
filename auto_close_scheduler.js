#!/usr/bin/env node

/**
 * Auto-Close Scheduler for General Orders
 * 
 * This script can be run by a cron job to automatically close expired general orders.
 * It calls the auto-close API endpoint and logs the results.
 * 
 * Usage:
 *   node auto_close_scheduler.js
 * 
 * Cron job example (run every 15 minutes):
 *   0,15,30,45 * * * * cd /path/to/project && node auto_close_scheduler.js >> logs/auto_close.log 2>&1
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const LOG_FILE = path.join(__dirname, 'logs', 'auto_close.log');

// Ensure logs directory exists
const logsDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    
    console.log(logMessage.trim());
    
    try {
        fs.appendFileSync(LOG_FILE, logMessage);
    } catch (error) {
        console.error('Failed to write to log file:', error);
    }
}

function makeRequest(options) {
    return new Promise((resolve, reject) => {
        const protocol = options.protocol === 'https:' ? https : http;
        
        const req = protocol.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(data);
                    resolve({
                        statusCode: res.statusCode,
                        data: parsedData
                    });
                } catch (error) {
                    resolve({
                        statusCode: res.statusCode,
                        data: data
                    });
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        if (options.method === 'POST' && options.body) {
            req.write(options.body);
        }
        
        req.end();
    });
}

async function checkAndCloseExpiredOrders() {
    try {
        const url = new URL(`${API_BASE_URL}/api/admin/auto-close`);
        
        log('Starting auto-close check...');
        
        // First, check which orders would be closed (dry run)
        const checkOptions = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname,
            method: 'GET',
            protocol: url.protocol,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        const checkResult = await makeRequest(checkOptions);
        
        if (checkResult.statusCode === 200) {
            const expiredCount = checkResult.data.expiredOrdersCount || 0;
            log(`Found ${expiredCount} expired orders`);
            
            if (expiredCount > 0) {
                // Trigger actual closure
                const closeOptions = {
                    ...checkOptions,
                    method: 'POST'
                };
                
                const closeResult = await makeRequest(closeOptions);
                
                if (closeResult.statusCode === 200) {
                    const closedCount = closeResult.data.closedOrders?.length || 0;
                    log(`Successfully closed ${closedCount} expired orders`);
                    
                    if (closeResult.data.closedOrders) {
                        closeResult.data.closedOrders.forEach(order => {
                            log(`  - Closed order: ${order.title} (ID: ${order.id})`);
                        });
                    }
                } else {
                    log(`Error closing orders: ${closeResult.statusCode} - ${JSON.stringify(closeResult.data)}`);
                }
            } else {
                log('No expired orders to close');
            }
        } else {
            log(`Error checking orders: ${checkResult.statusCode} - ${JSON.stringify(checkResult.data)}`);
        }
        
    } catch (error) {
        log(`Exception in auto-close: ${error.message}`);
        console.error(error);
    }
}

// Main execution
if (require.main === module) {
    log('='.repeat(50));
    log('Auto-close scheduler started');
    
    checkAndCloseExpiredOrders()
        .then(() => {
            log('Auto-close scheduler completed');
            log('='.repeat(50));
        })
        .catch((error) => {
            log(`Auto-close scheduler failed: ${error.message}`);
            log('='.repeat(50));
            process.exit(1);
        });
}

module.exports = { checkAndCloseExpiredOrders };