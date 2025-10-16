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

        // For 'all' audience, get player IDs directly from OneSignal API
        // This bypasses segment issues and sends directly to all subscribed devices
        let targetingConfig = {};
        if (audience === 'all') {
            const playerIds = await this.getAllPlayerIds();
            console.log(`✅ Found ${playerIds.length} subscribed players to send to`);
            if (playerIds.length > 0) {
                targetingConfig = { include_player_ids: playerIds };
            } else {
                // Fallback to segment if no players found
                targetingConfig = { included_segments: ["All"] };
            }
        } else if (audience === 'admins_only') {
            targetingConfig = {
                filters: [{ field: 'tag', key: 'role', relation: '=', value: 'admin' }]
            };
        } else {
            targetingConfig = { include_external_user_ids: userIds };
        }

        // Build OneSignal payload  
        const payload = {
            app_id: this.appId,
            headings: { en: title, he: title }, // Add Hebrew support
            contents: { en: body, he: body }, // Add Hebrew support
            ...targetingConfig,

            // URL to open when notification is clicked
            url: url || undefined,
            
            // Images
            small_icon: icon || undefined,
            large_icon: icon || undefined,
            big_picture: image || undefined,

            // Android specific - CRITICAL FOR NOTIFICATIONS TO SHOW AND SOUND
            android_accent_color: '8B5CF6FF', // Purple color (must include alpha)
            android_visibility: 1, // Public (show on lock screen)
            android_sound: 'default', // ⚠️ Enable sound
            android_led_color: '8B5CF6FF', // LED color
            priority: 10, // ⚠️ High priority (immediate popup)
            android_channel_id: 'default', // ⚠️ Use default channel
            existing_android_channel_id: 'default', // ⚠️ Existing channel
            collapse_id: undefined, // Don't collapse notifications
            
            // Delivery settings
            ttl: 259200, // 3 days expiry
            content_available: true, // Wake app on delivery
            mutable_content: true, // Allow modification
            
            // iOS specific  
            ios_badgeType: 'Increase',
            ios_badgeCount: 1,
            ios_sound: 'default', // ⚠️ Enable sound for iOS
            ios_category: 'default',
            
            // Behavior
            delayed_option: 'immediate', // ⚠️ Send immediately, no delays
            send_after: scheduledAt ? new Date(scheduledAt).toISOString() : undefined
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
     * Get all subscribed player IDs from OneSignal
     */
    async getAllPlayerIds() {
        try {
            const isV2Key = this.apiKey.startsWith('os_v2_');
            const response = await fetch(
                `${this.apiUrl}/players?app_id=${this.appId}&limit=300`,
                {
                    headers: {
                        'Authorization': isV2Key ? `Bearer ${this.apiKey}` : `Basic ${this.apiKey}`
                    }
                }
            );

            const result = await response.json();
            
            if (result.players) {
                // Filter for subscribed players only
                const subscribedPlayers = result.players.filter(p => 
                    p.invalid_identifier === false && 
                    p.notification_types >= 0
                );
                return subscribedPlayers.map(p => p.id);
            }
            
            return [];
        } catch (error) {
            console.error('Failed to get player IDs:', error);
            return [];
        }
    }

    /**
     * Get notification delivery stats
     */
    async getNotificationStats(notificationId) {
        try {
            // Support both v1 and v2 API key formats (v2 uses Bearer)
            const isV2Key = this.apiKey && this.apiKey.startsWith && this.apiKey.startsWith('os_v2_');

            const response = await fetch(
                `${this.apiUrl}/notifications/${notificationId}?app_id=${this.appId}`,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': isV2Key ? `Bearer ${this.apiKey}` : `Basic ${this.apiKey}`
                    }
                }
            );

            const result = await response.json();

            // OneSignal may return different field names depending on API version.
            // Try to extract the best-known metrics and normalize them.
            const sent = (result.recipients != null) ? result.recipients : (result.successful != null ? result.successful : 0);
            const delivered = (result.delivered != null) ? result.delivered : (result.successful != null ? result.successful : 0);
            // 'converted' is commonly used as clicks/conversions in OneSignal responses
            const clicked = (result.converted != null) ? result.converted : (result.clicked != null ? result.clicked : 0);

            return {
                sent: sent || 0,
                delivered: delivered || 0,
                clicked: clicked || 0,
                raw: result
            };
        } catch (error) {
            console.error('Failed to get notification stats:', error);
            return null;
        }
    }
}

export default OneSignalService;
