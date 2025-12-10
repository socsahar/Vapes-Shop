#!/usr/bin/env node

/**
 * WhatsApp Admin Commands Handler
 * Processes commands sent by authorized admins
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://vapes-shop.top';

/**
 * Parse command and arguments
 */
function parseCommand(text) {
    const parts = text.trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);
    
    return { command, args };
}

/**
 * Handle admin commands
 */
export async function handleCommand(commandText, senderPhone, whatsAppClient) {
    const { command, args } = parseCommand(commandText);

    console.log(`🔧 Processing command: ${command} from ${senderPhone}`);

    try {
        switch (command) {
            case '/help':
                return getHelpMessage();
            
            case '/status':
                return await getSystemStatus();
            
            case '/orders':
                return await listOrders(args);
            
            case '/users':
                return await getUsersCount();
            
            case '/stats':
                return await getStats();
            
            case '/create_order':
                return await createOrder(args);
            
            case '/close_order':
                return await closeOrder(args);
            
            case '/open_order':
                return await openOrder(args);
            
            case '/send_reminder':
                return await sendReminder(args);
            
            case '/bot_status':
                return getBotStatus(whatsAppClient);
            
            case '/config':
                return await getConfig(args);
            
            case '/set_config':
                return await setConfig(args);
            
            default:
                return `❌ פקודה לא מזוהה: ${command}\n\nשלח /help לרשימת פקודות.`;
        }
    } catch (error) {
        console.error('❌ Error handling command:', error);
        return `❌ שגיאה בביצוע הפקודה:\n${error.message}`;
    }
}

/**
 * Get help message with all commands
 */
function getHelpMessage() {
    return `🤖 *פקודות בוט WhatsApp - עזרה*

📊 *מידע ומעקב:*
/status - מצב המערכת הכללי
/orders - רשימת הזמנות קבוצתיות
/users - מספר משתמשים
/stats - סטטיסטיקות
/bot_status - מצב חיבור הבוט

⚙️ *ניהול הזמנות:*
/create_order [כותרת] [שעות עד סגירה] - יצירת הזמנה חדשה
/close_order [מזהה] - סגירת הזמנה מיידית
/open_order [מזהה] - פתיחת הזמנה מחדש
/send_reminder [מזהה] - שליחת תזכורת ידנית

🔧 *הגדרות:*
/config [מפתח] - הצגת הגדרה
/set_config [מפתח] [ערך] - שינוי הגדרה

💡 *דוגמאות:*
/create_order "הזמנה חדשה" 48
/close_order abc123
/config announcement_group_id
/set_config bot_enabled true`;
}

/**
 * Get system status
 */
async function getSystemStatus() {
    try {
        // Get active orders
        const { data: orders } = await supabase
            .from('general_orders')
            .select('*')
            .eq('status', 'open');

        // Get scheduled orders
        const { data: scheduled } = await supabase
            .from('general_orders')
            .select('*')
            .eq('status', 'scheduled');

        // Get today's orders
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const { data: todayOrders } = await supabase
            .from('orders')
            .select('total_amount')
            .gte('created_at', today.toISOString());

        const totalToday = todayOrders?.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0) || 0;

        // Get WhatsApp message stats
        const { data: messages } = await supabase
            .from('whatsapp_messages')
            .select('status')
            .gte('created_at', today.toISOString());

        const pending = messages?.filter(m => m.status === 'pending').length || 0;
        const sent = messages?.filter(m => m.status === 'sent').length || 0;

        return `📊 *מצב המערכת*

🛒 *הזמנות קבוצתיות:*
  • פעילות: ${orders?.length || 0}
  • מתוזמנות: ${scheduled?.length || 0}

📦 *הזמנות היום:*
  • כמות: ${todayOrders?.length || 0}
  • סכום: ₪${totalToday.toFixed(2)}

📱 *הודעות WhatsApp היום:*
  • ממתינות: ${pending}
  • נשלחו: ${sent}

🌐 *קישור לאתר:*
${SITE_URL}/admin

⏰ ${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}`;
    } catch (error) {
        return `❌ שגיאה בטעינת מצב המערכת: ${error.message}`;
    }
}

/**
 * List orders
 */
async function listOrders(args) {
    try {
        const status = args[0] || 'open';
        
        const { data: orders, error } = await supabase
            .from('general_orders')
            .select('*')
            .eq('status', status)
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) throw error;

        if (!orders || orders.length === 0) {
            return `📭 אין הזמנות בסטטוס "${status}"`;
        }

        let message = `📦 *הזמנות קבוצתיות - ${status}*\n\n`;

        orders.forEach((order, index) => {
            const deadline = new Date(order.deadline).toLocaleString('he-IL', {
                timeZone: 'Asia/Jerusalem',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            message += `${index + 1}. *${order.title}*\n`;
            message += `   ID: \`${order.id}\`\n`;
            message += `   סגירה: ${deadline}\n`;
            if (order.opening_time) {
                const opening = new Date(order.opening_time).toLocaleString('he-IL', {
                    timeZone: 'Asia/Jerusalem',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                message += `   פתיחה: ${opening}\n`;
            }
            message += '\n';
        });

        message += `\n💡 להצגת סטטוס אחר: /orders [${['open', 'closed', 'scheduled'].filter(s => s !== status).join('|')}]`;

        return message;
    } catch (error) {
        return `❌ שגיאה בטעינת הזמנות: ${error.message}`;
    }
}

/**
 * Get users count
 */
async function getUsersCount() {
    try {
        const { count: totalUsers } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true });

        const { count: activeUsers } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);

        const { count: admins } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'admin');

        const { count: withPhone } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .not('phone', 'is', null);

        return `👥 *סטטיסטיקת משתמשים*

📊 סה"כ משתמשים: ${totalUsers || 0}
✅ פעילים: ${activeUsers || 0}
👨‍💼 מנהלים: ${admins || 0}
📱 עם טלפון: ${withPhone || 0}

💡 ${Math.round((withPhone / totalUsers) * 100)}% מהמשתמשים ניתנים להודעות WhatsApp`;
    } catch (error) {
        return `❌ שגיאה בטעינת נתוני משתמשים: ${error.message}`;
    }
}

/**
 * Get statistics
 */
async function getStats() {
    try {
        // Last 7 days
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const { data: orders } = await supabase
            .from('orders')
            .select('total_amount, created_at')
            .gte('created_at', weekAgo.toISOString());

        const { data: messages } = await supabase
            .from('whatsapp_messages')
            .select('status, message_type')
            .gte('created_at', weekAgo.toISOString());

        const totalRevenue = orders?.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0) || 0;
        const avgOrder = orders?.length > 0 ? totalRevenue / orders.length : 0;

        const sentMessages = messages?.filter(m => m.status === 'sent').length || 0;
        const failedMessages = messages?.filter(m => m.status === 'failed').length || 0;
        const successRate = messages?.length > 0 
            ? Math.round((sentMessages / messages.length) * 100) 
            : 0;

        return `📈 *סטטיסטיקות - 7 ימים אחרונים*

💰 *הזמנות:*
  • כמות: ${orders?.length || 0}
  • סה"כ הכנסות: ₪${totalRevenue.toFixed(2)}
  • ממוצע הזמנה: ₪${avgOrder.toFixed(2)}

📱 *הודעות WhatsApp:*
  • נשלחו: ${sentMessages}
  • נכשלו: ${failedMessages}
  • אחוז הצלחה: ${successRate}%

⏰ ${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}`;
    } catch (error) {
        return `❌ שגיאה בטעינת סטטיסטיקות: ${error.message}`;
    }
}

/**
 * Create new order
 */
async function createOrder(args) {
    try {
        if (args.length < 2) {
            return `❌ שימוש: /create_order [כותרת] [שעות עד סגירה]\n\nדוגמה: /create_order "הזמנה חדשה" 48`;
        }

        const hours = parseInt(args[args.length - 1]);
        if (isNaN(hours)) {
            return `❌ מספר השעות חייב להיות מספר`;
        }

        const title = args.slice(0, -1).join(' ').replace(/['"]/g, '');
        const deadline = new Date(Date.now() + hours * 60 * 60 * 1000);

        // Get first admin user
        const { data: admin } = await supabase
            .from('users')
            .select('id')
            .eq('role', 'admin')
            .limit(1)
            .single();

        const { data: order, error } = await supabase
            .from('general_orders')
            .insert([{
                title,
                description: `הזמנה שנוצרה דרך WhatsApp Bot`,
                deadline: deadline.toISOString(),
                status: 'open',
                created_by: admin?.id
            }])
            .select()
            .single();

        if (error) throw error;

        return `✅ *הזמנה נוצרה בהצלחה!*

📦 *${order.title}*
🆔 ID: \`${order.id}\`
⏰ סגירה: ${deadline.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}

🔔 הודעה תישלח לקבוצה אוטומטית.`;
    } catch (error) {
        return `❌ שגיאה ביצירת הזמנה: ${error.message}`;
    }
}

/**
 * Close order manually
 */
async function closeOrder(args) {
    try {
        if (args.length === 0) {
            return `❌ שימוש: /close_order [מזהה הזמנה]\n\nדוגמה: /close_order abc123`;
        }

        const orderId = args[0];

        const { data: order, error } = await supabase
            .from('general_orders')
            .update({ status: 'closed' })
            .eq('id', orderId)
            .select()
            .single();

        if (error) throw error;

        return `✅ *ההזמנה נסגרה בהצלחה!*

📦 *${order.title}*
🆔 ID: \`${order.id}\`

🔔 מיילים ו-WhatsApp יישלחו למשתתפים.`;
    } catch (error) {
        return `❌ שגיאה בסגירת הזמנה: ${error.message}`;
    }
}

/**
 * Open order manually
 */
async function openOrder(args) {
    try {
        if (args.length === 0) {
            return `❌ שימוש: /open_order [מזהה הזמנה]`;
        }

        const orderId = args[0];

        const { data: order, error } = await supabase
            .from('general_orders')
            .update({ status: 'open' })
            .eq('id', orderId)
            .select()
            .single();

        if (error) throw error;

        return `✅ *ההזמנה נפתחה מחדש!*

📦 *${order.title}*
🆔 ID: \`${order.id}\``;
    } catch (error) {
        return `❌ שגיאה בפתיחת הזמנה: ${error.message}`;
    }
}

/**
 * Send reminder manually
 */
async function sendReminder(args) {
    try {
        if (args.length === 0) {
            return `❌ שימוש: /send_reminder [מזהה הזמנה]`;
        }

        const orderId = args[0];

        const { data: order } = await supabase
            .from('general_orders')
            .select('*')
            .eq('id', orderId)
            .single();

        if (!order) {
            return `❌ הזמנה לא נמצאה`;
        }

        // Queue reminder via message system
        const { queueReminderAnnouncement } = await import('./whatsappMessages.js');
        await queueReminderAnnouncement(order, '1h');

        return `✅ *תזכורת נשלחה!*

📦 ${order.title}
🔔 הודעת תזכורת נוספה לתור.`;
    } catch (error) {
        return `❌ שגיאה בשליחת תזכורת: ${error.message}`;
    }
}

/**
 * Get bot status
 */
function getBotStatus(whatsAppClient) {
    const status = whatsAppClient.getStatus();

    return `🤖 *מצב בוט WhatsApp*

📱 חיבור: ${status.isConnected ? '✅ מחובר' : '❌ מנותק'}
${status.phoneNumber ? `📞 מספר: ${status.phoneNumber}` : ''}
${status.reconnectAttempts > 0 ? `🔄 ניסיונות חיבור: ${status.reconnectAttempts}/${whatsAppClient.maxReconnectAttempts}` : ''}

${status.isConnected ? '✅ הבוט פועל ומעבד הודעות' : '⚠️ הבוט מנותק - יש לסרוק QR מחדש'}`;
}

/**
 * Get configuration value
 */
async function getConfig(args) {
    try {
        if (args.length === 0) {
            // Show all config
            const { data: configs } = await supabase
                .from('whatsapp_config')
                .select('*')
                .order('key');

            if (!configs || configs.length === 0) {
                return `📋 אין הגדרות`;
            }

            let message = `⚙️ *הגדרות WhatsApp Bot*\n\n`;
            configs.forEach(c => {
                message += `• \`${c.key}\`: ${c.value}\n`;
                if (c.description) {
                    message += `  ${c.description}\n`;
                }
            });

            return message;
        }

        const key = args[0];
        const { data: config } = await supabase
            .from('whatsapp_config')
            .select('*')
            .eq('key', key)
            .single();

        if (!config) {
            return `❌ הגדרה לא נמצאה: ${key}`;
        }

        return `⚙️ *${config.key}*\n\n📝 ${config.value}\n\n${config.description || ''}`;
    } catch (error) {
        return `❌ שגיאה בטעינת הגדרות: ${error.message}`;
    }
}

/**
 * Set configuration value
 */
async function setConfig(args) {
    try {
        if (args.length < 2) {
            return `❌ שימוש: /set_config [מפתח] [ערך]\n\nדוגמה: /set_config bot_enabled true`;
        }

        const key = args[0];
        const value = args.slice(1).join(' ');

        const { data: config, error } = await supabase
            .from('whatsapp_config')
            .upsert([{
                key,
                value,
                updated_at: new Date().toISOString()
            }], {
                onConflict: 'key'
            })
            .select()
            .single();

        if (error) throw error;

        return `✅ *הגדרה עודכנה!*

⚙️ \`${config.key}\`
📝 ${config.value}`;
    } catch (error) {
        return `❌ שגיאה בעדכון הגדרה: ${error.message}`;
    }
}

export default {
    handleCommand,
    parseCommand
};
