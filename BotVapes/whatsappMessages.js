#!/usr/bin/env node

/**
 * WhatsApp Message Templates and Queue Management
 * Handles message formatting and queueing for WhatsApp bot
 */

import { createClient } from '@supabase/supabase-js';

let supabase = null;

// Lazy initialization of Supabase client
function getSupabase() {
    if (!supabase) {
        supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );
    }
    return supabase;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://vapes-shop.top';

/**
 * Format phone number (supports both Israeli formats)
 * Accepts: +972501234567, 972501234567, 0501234567
 * Returns: 972501234567
 */
export function formatPhoneNumber(phone) {
    if (!phone) return null;
    
    // Remove all non-digit characters
    let cleaned = phone.replace(/[^\d]/g, '');
    
    // If starts with 0, replace with 972
    if (cleaned.startsWith('0')) {
        cleaned = '972' + cleaned.substring(1);
    }
    
    // Ensure it starts with 972
    if (!cleaned.startsWith('972')) {
        cleaned = '972' + cleaned;
    }
    
    return cleaned;
}

/**
 * Message Templates
 */
export const MessageTemplates = {
    
    /**
     * General Order Opened Announcement
     */
    orderOpened: (order) => {
        const deadline = new Date(order.deadline);
        const deadlineStr = deadline.toLocaleString('he-IL', {
            timeZone: 'Asia/Jerusalem',
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `🎉 *הזמנה קבוצתית חדשה נפתחה!*

📦 *${order.title}*

${order.description ? `📝 ${order.description}\n\n` : ''}⏰ *תאריך סגירה:* ${deadlineStr}

🛒 להזמנה היכנסו לאתר:
${SITE_URL}/shop

⚡ אל תפספסו - מלאי מוגבל!`;
    },

    /**
     * Order Closing Soon Reminder (1 hour)
     */
    reminder1Hour: (order) => {
        return `⏰ *תזכורת - ההזמנה נסגרת בעוד שעה!*

📦 *${order.title}*

⚠️ זה הזמן האחרון להזמין!

🛒 להזמנה:
${SITE_URL}/shop

⏱️ ההזמנה תיסגר בעוד 60 דקות!`;
    },

    /**
     * Order Closing Soon Reminder (30 minutes)
     */
    reminder30Minutes: (order) => {
        return `🚨 *תזכורת אחרונה - נותרו 30 דקות!*

📦 *${order.title}*

⚠️ *ההזמנה נסגרת בעוד חצי שעה!*

🛒 להזמנה אחרונה:
${SITE_URL}/shop

⏱️ זו ההזדמנות האחרונה שלכם!`;
    },

    /**
     * Order Closed Announcement
     */
    orderClosed: (order, participantCount = 0) => {
        return `🔒 *ההזמנה הקבוצתית נסגרה*

📦 *${order.title}*

✅ ההזמנה נסגרה בהצלחה
👥 ${participantCount} משתתפים

תודה לכל המשתתפים! 🙏
נעדכן אתכם בהמשך על מועד האיסוף.

📧 נשלח אליכם מייל עם סיכום ההזמנה.`;
    },

    /**
     * Personal Order Confirmation
     */
    orderConfirmation: (user, order, items, totalAmount) => {
        const itemsList = items.map(item => 
            `  • ${item.products?.name || 'מוצר'} x${item.quantity} - ₪${item.total_price?.toFixed(2) || '0.00'}`
        ).join('\n');

        return `✅ *הזמנתך התקבלה בהצלחה!*

שלום ${user.full_name || 'לקוח יקר'} 👋

📦 *הזמנה קבוצתית:* ${order.title}

🛍️ *פריט שהזמנת:*
${itemsList}

💰 *סה"כ לתשלום:* ₪${totalAmount.toFixed(2)}

📧 נשלח אליך מייל עם פרטי ההזמנה.

🔔 נעדכן אותך כשההזמנה תגיע!

תודה שבחרת בנו! ❤️`;
    },

    /**
     * Order Status Update
     */
    orderStatusUpdate: (user, order, newStatus) => {
        const statusEmoji = {
            'confirmed': '✅',
            'completed': '🎉',
            'ready': '📦',
            'cancelled': '❌'
        };

        const statusText = {
            'confirmed': 'אושרה',
            'completed': 'הושלמה',
            'ready': 'מוכנה לאיסוף',
            'cancelled': 'בוטלה'
        };

        return `${statusEmoji[newStatus] || '📢'} *עדכון סטטוס הזמנה*

שלום ${user.full_name || 'לקוח יקר'},

ההזמנה שלך בהזמנה קבוצתית *${order.title}* ${statusText[newStatus] || 'עודכנה'}.

${newStatus === 'ready' ? '🏪 ניתן לאסוף את ההזמנה במשרדינו.\n\nכתובת: [הכנס כתובת]\nשעות פתיחה: [הכנס שעות]' : ''}

לשאלות: ${process.env.ADMIN_EMAIL || 'support@vapes-shop.top'}`;
    },

    /**
     * Welcome Message (for new users)
     */
    welcome: (user) => {
        return `👋 *שלום ${user.full_name}!*

ברוכים הבאים לבוט הוואטסאפ של Vape Shop! 🎉

כאן תקבלו:
✨ הודעות על הזמנות קבוצתיות חדשות
⏰ תזכורות לפני סגירת הזמנות
✅ אישורי הזמנות אוטומטיים
📦 עדכוני סטטוס

🛒 להזמנה: ${SITE_URL}

נתראה בהזמנה הבאה! 🚀`;
    }
};

/**
 * Queue a WhatsApp message
 */
export async function queueWhatsAppMessage({
    recipientPhone = null,
    recipientName = null,
    isGroup = false,
    groupId = null,
    message,
    messageType = 'text',
    priority = 5,
    userId = null,
    generalOrderId = null,
    orderId = null,
    scheduledFor = null
}) {
    try {
        // Format phone if provided
        const formattedPhone = recipientPhone ? formatPhoneNumber(recipientPhone) : null;

        const { data, error } = await getSupabase()
            .from('whatsapp_messages')
            .insert([{
                recipient_phone: formattedPhone,
                recipient_name: recipientName,
                is_group: isGroup,
                group_id: groupId,
                message,
                message_type: messageType,
                priority,
                status: 'pending',
                user_id: userId,
                general_order_id: generalOrderId,
                order_id: orderId,
                scheduled_for: scheduledFor
            }])
            .select()
            .single();

        if (error) {
            console.error('❌ Error queueing WhatsApp message:', error);
            return { success: false, error };
        }

        console.log(`✅ WhatsApp message queued: ${messageType} to ${recipientName || formattedPhone || groupId}`);
        return { success: true, data };

    } catch (error) {
        console.error('❌ Error queueing WhatsApp message:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Queue order opened announcement to group
 */
export async function queueOrderOpenedAnnouncement(order) {
    try {
        // Get group ID from config
        const { data: config } = await getSupabase()
            .from('whatsapp_config')
            .select('value')
            .eq('key', 'announcement_group_id')
            .single();

        if (!config?.value) {
            console.log('⚠️ No announcement group configured');
            return { success: false, error: 'No group configured' };
        }

        // Check if announcements are enabled
        const { data: enabled } = await getSupabase()
            .from('whatsapp_config')
            .select('value')
            .eq('key', 'send_group_announcements')
            .single();

        if (enabled?.value !== 'true') {
            console.log('⚠️ Group announcements disabled');
            return { success: false, error: 'Announcements disabled' };
        }

        const message = MessageTemplates.orderOpened(order);

        return await queueWhatsAppMessage({
            isGroup: true,
            groupId: config.value,
            message,
            messageType: 'order_opened',
            priority: 1,
            generalOrderId: order.id
        });

    } catch (error) {
        console.error('❌ Error queueing order opened announcement:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Queue reminder messages to group
 */
export async function queueReminderAnnouncement(order, reminderType = '1h') {
    try {
        // Get group ID from config
        const { data: config } = await getSupabase()
            .from('whatsapp_config')
            .select('value')
            .eq('key', 'announcement_group_id')
            .single();

        if (!config?.value) {
            console.log('⚠️ No announcement group configured');
            return { success: false, error: 'No group configured' };
        }

        // Check if reminders are enabled
        const reminderKey = reminderType === '1h' ? 'reminder_1h_enabled' : 'reminder_30m_enabled';
        const { data: enabled } = await getSupabase()
            .from('whatsapp_config')
            .select('value')
            .eq('key', reminderKey)
            .single();

        if (enabled?.value !== 'true') {
            console.log(`⚠️ ${reminderType} reminders disabled`);
            return { success: false, error: 'Reminders disabled' };
        }

        const message = reminderType === '1h' 
            ? MessageTemplates.reminder1Hour(order)
            : MessageTemplates.reminder30Minutes(order);

        return await queueWhatsAppMessage({
            isGroup: true,
            groupId: config.value,
            message,
            messageType: `reminder_${reminderType}`,
            priority: 2,
            generalOrderId: order.id
        });

    } catch (error) {
        console.error('❌ Error queueing reminder announcement:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Queue order closed announcement to group
 */
export async function queueOrderClosedAnnouncement(order, participantCount = 0) {
    try {
        // Get group ID from config
        const { data: config } = await getSupabase()
            .from('whatsapp_config')
            .select('value')
            .eq('key', 'announcement_group_id')
            .single();

        if (!config?.value) {
            console.log('⚠️ No announcement group configured');
            return { success: false, error: 'No group configured' };
        }

        const message = MessageTemplates.orderClosed(order, participantCount);

        return await queueWhatsAppMessage({
            isGroup: true,
            groupId: config.value,
            message,
            messageType: 'order_closed',
            priority: 1,
            generalOrderId: order.id
        });

    } catch (error) {
        console.error('❌ Error queueing order closed announcement:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Queue personal order confirmation
 */
export async function queueOrderConfirmation(user, order, items, totalAmount) {
    try {
        // Check if order confirmations are enabled
        const { data: enabled } = await getSupabase()
            .from('whatsapp_config')
            .select('value')
            .eq('key', 'send_order_confirmations')
            .single();

        if (enabled?.value !== 'true') {
            console.log('⚠️ Order confirmations disabled');
            return { success: false, error: 'Confirmations disabled' };
        }

        if (!user.phone) {
            console.log(`⚠️ User ${user.email} has no phone number`);
            return { success: false, error: 'No phone number' };
        }

        const message = MessageTemplates.orderConfirmation(user, order, items, totalAmount);

        return await queueWhatsAppMessage({
            recipientPhone: user.phone,
            recipientName: user.full_name,
            message,
            messageType: 'order_confirmation',
            priority: 3,
            userId: user.id,
            generalOrderId: order.id
        });

    } catch (error) {
        console.error('❌ Error queueing order confirmation:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Send immediate message (bypass queue)
 */
export async function sendImmediateMessage(whatsAppClient, recipientPhone, message) {
    try {
        const formattedPhone = formatPhoneNumber(recipientPhone);
        await whatsAppClient.sendToPhone(formattedPhone, message);
        
        console.log(`✅ Immediate message sent to ${formattedPhone}`);
        return { success: true };

    } catch (error) {
        console.error('❌ Error sending immediate message:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get message statistics
 */
export async function getMessageStats() {
    try {
        const { data: stats, error } = await getSupabase()
            .from('whatsapp_messages')
            .select('status, message_type')
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        if (error) throw error;

        const result = {
            total: stats.length,
            pending: stats.filter(s => s.status === 'pending').length,
            sent: stats.filter(s => s.status === 'sent').length,
            failed: stats.filter(s => s.status === 'failed').length,
            byType: {}
        };

        stats.forEach(s => {
            if (!result.byType[s.message_type]) {
                result.byType[s.message_type] = 0;
            }
            result.byType[s.message_type]++;
        });

        return result;

    } catch (error) {
        console.error('❌ Error getting message stats:', error);
        return null;
    }
}

export default {
    MessageTemplates,
    formatPhoneNumber,
    queueWhatsAppMessage,
    queueOrderOpenedAnnouncement,
    queueReminderAnnouncement,
    queueOrderClosedAnnouncement,
    queueOrderConfirmation,
    sendImmediateMessage,
    getMessageStats
};

