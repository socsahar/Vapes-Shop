/**
 * OneSignal Push Notification Integration for Median App
 * 
 * Setup Instructions:
 * 1. Create account at https://onesignal.com
 * 2. Create new app in OneSignal dashboard
 * 3. Get your App ID and REST API Key
 * 4. Add to .env.local:
 *    ONESIGNAL_APP_ID=your_app_id_here
 *    ONESIGNAL_REST_API_KEY=your_rest_api_key_here
 * 5. In Median dashboard:
 *    - Go to Push Notifications
 *    - Enable OneSignal
 *    - Enter your OneSignal App ID
 * 6. Rebuild your Median app
 */

class OneSignalService {
    constructor() {
        this.appId = process.env.ONESIGNAL_APP_ID;
        this.apiKey = process.env.ONESIGNAL_REST_API_KEY;
        this.apiUrl = 'https://onesignal.com/api/v1';
    }

    /**
     * Send push notification via OneSignal
     * @param {Object} notification - Notification data
     * @returns {Promise<Object>} - OneSignal response
     */
    async sendNotification(notification) {
        const {
            title,
            body,
            url,
            icon,
            image,
            audience,
            userIds = [],
            scheduledAt = null
        } = notification;

        // Build OneSignal payload
        const payload = {
            app_id: this.appId,
            headings: { en: title },
            contents: { en: body },
            
            // Target audience - use 'Active Users' or 'Engaged Users' for all subscribers
            ...(audience === 'all' ? {
                included_segments: ['Active Users', 'Engaged Users']
            } : audience === 'admins_only' ? {
                filters: [{ field: 'tag', key: 'role', relation: '=', value: 'admin' }]
            } : {
                include_external_user_ids: userIds // For specific users
            }),

            // URL to open when notification is clicked
            url: url || undefined,
            
            // Images
            small_icon: icon || undefined,
            large_icon: icon || undefined,
            big_picture: image || undefined,

            // Android specific
            android_accent_color: '8B5CF6', // Purple color for your brand
            android_visibility: 1, // Public
            
            // iOS specific  
            ios_badgeType: 'Increase',
            ios_badgeCount: 1,

            // Schedule if needed
            ...(scheduledAt ? {
                send_after: new Date(scheduledAt).toISOString()
            } : {})
        };

        try {
            // Check if using v2 API key format
            const isV2Key = this.apiKey.startsWith('os_v2_');
            
            const response = await fetch(`${this.apiUrl}/notifications`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // v2 keys use Bearer, v1 keys use Basic
                    'Authorization': isV2Key ? `Bearer ${this.apiKey}` : `Basic ${this.apiKey}`
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            console.log('OneSignal API Response:', JSON.stringify(result, null, 2));

            if (!response.ok) {
                console.error('OneSignal API Error Response:', JSON.stringify(result, null, 2));
                console.error('OneSignal Payload Sent:', JSON.stringify(payload, null, 2));
                throw new Error(result.errors?.[0] || 'Failed to send notification');
            }

            // OneSignal returns 'recipients' field with number of devices notified
            const recipientCount = result.recipients || 0;
            
            console.log(`✅ OneSignal sent successfully!`);
            console.log(`   Recipients: ${recipientCount}`);
            console.log(`   Notification ID: ${result.id}`);

            return {
                success: true,
                id: result.id,
                recipients: recipientCount,
                externalId: result.external_id
            };
        } catch (error) {
            console.error('OneSignal API Error:', error);
            throw error;
        }
    }

    /**
     * Send to specific user by external ID
     */
    async sendToUser(userId, notification) {
        return this.sendNotification({
            ...notification,
            audience: 'specific_users',
            userIds: [userId]
        });
    }

    /**
     * Send to all users
     */
    async sendToAll(notification) {
        return this.sendNotification({
            ...notification,
            audience: 'all'
        });
    }

    /**
     * Get notification delivery stats
     */
    async getNotificationStats(notificationId) {
        try {
            const response = await fetch(
                `${this.apiUrl}/notifications/${notificationId}?app_id=${this.appId}`,
                {
                    headers: {
                        'Authorization': `Basic ${this.apiKey}`
                    }
                }
            );

            const result = await response.json();
            
            return {
                sent: result.successful || 0,
                failed: result.failed || 0,
                converted: result.converted || 0,
                remaining: result.remaining || 0
            };
        } catch (error) {
            console.error('Failed to get notification stats:', error);
            return null;
        }
    }
}

export default OneSignalService;
