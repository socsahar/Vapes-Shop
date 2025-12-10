#!/usr/bin/env node

/**
 * WhatsApp Bot Client using Baileys
 * Handles WhatsApp connection, authentication, and message sending
 */

import makeWASocket, { 
    DisconnectReason, 
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    Browsers
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Logger configuration
const logger = pino({ 
    level: process.env.LOG_LEVEL || 'info',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
        }
    }
});

const AUTH_DIR = path.join(__dirname, 'auth_info');

class WhatsAppClient {
    constructor() {
        this.sock = null;
        this.qrCode = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.messageQueue = [];
        this.isProcessingQueue = false;
        
        // Initialize Supabase client
        this.supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );
    }

    /**
     * Initialize WhatsApp connection
     */
    async connect() {
        try {
            logger.info('🔄 Initializing WhatsApp connection...');

            // Ensure auth directory exists
            if (!fs.existsSync(AUTH_DIR)) {
                fs.mkdirSync(AUTH_DIR, { recursive: true });
            }

            // Load auth state
            const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
            
            // Get latest Baileys version
            const { version } = await fetchLatestBaileysVersion();

            // Create WhatsApp socket
            this.sock = makeWASocket({
                version,
                logger,
                printQRInTerminal: true,
                auth: state,
                browser: Browsers.ubuntu('Chrome'),
                syncFullHistory: false,
                generateHighQualityLinkPreview: true,
                markOnlineOnConnect: true,
                getMessage: async (key) => {
                    // getMessage implementation without store
                    return undefined;
                }
            });

            // Handle connection updates
            this.sock.ev.on('connection.update', async (update) => {
                await this.handleConnectionUpdate(update);
            });

            // Handle credentials update
            this.sock.ev.on('creds.update', saveCreds);

            // Handle messages
            this.sock.ev.on('messages.upsert', async ({ messages }) => {
                await this.handleIncomingMessages(messages);
            });

            logger.info('✅ WhatsApp client initialized');

        } catch (error) {
            logger.error('❌ Error initializing WhatsApp:', error);
            await this.logActivity('error', 'Failed to initialize WhatsApp', null, false, { error: error.message });
            throw error;
        }
    }

    /**
     * Handle connection updates
     */
    async handleConnectionUpdate(update) {
        const { connection, lastDisconnect, qr } = update;

        // Handle QR code
        if (qr) {
            this.qrCode = qr;
            logger.info('📱 QR Code received - scan with WhatsApp');
            await this.updateSessionState({
                is_connected: false,
                qr_code: qr,
                connection_status: 'connecting'
            });
        }

        // Handle connection state
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom) 
                ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
                : true;

            logger.warn('⚠️ Connection closed. Reconnect?', shouldReconnect);

            await this.updateSessionState({
                is_connected: false,
                connection_status: 'disconnected',
                last_disconnection: new Date().toISOString(),
                error_message: lastDisconnect?.error?.message || 'Unknown error'
            });

            this.isConnected = false;

            if (shouldReconnect) {
                this.reconnectAttempts++;
                // Exponential backoff: 5s, 10s, 20s, 30s, then stay at 30s
                const delay = Math.min(5000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
                logger.info(`🔄 Reconnecting in ${delay/1000}s... (Attempt ${this.reconnectAttempts})`);
                setTimeout(() => this.connect(), delay);
            } else {
                logger.error('❌ Logged out - please re-authenticate');
                await this.logActivity('error', 'WhatsApp logged out - re-authentication required', null, false);
            }
        } else if (connection === 'open') {
            logger.info('✅ WhatsApp connected successfully!');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.qrCode = null;

            // Get phone number
            const phoneNumber = this.sock.user?.id?.split(':')[0] || null;

            await this.updateSessionState({
                is_connected: true,
                qr_code: null,
                connection_status: 'connected',
                phone_number: phoneNumber,
                last_connection: new Date().toISOString(),
                error_message: null
            });

            await this.logActivity('connection', 'WhatsApp connected successfully', phoneNumber, false);

            // Start processing message queue
            this.startQueueProcessor();
        }
    }

    /**
     * Handle incoming messages
     */
    async handleIncomingMessages(messages) {
        for (const msg of messages) {
            if (!msg.message || msg.key.fromMe) continue;

            const messageText = msg.message.conversation || 
                               msg.message.extendedTextMessage?.text || 
                               '';
            
            // Extract sender phone - try participant first (for groups), then remoteJid
            let senderPhone = msg.key.participant?.split('@')[0] || msg.key.remoteJid?.split('@')[0];
            
            // If it's a LID format (starts with numbers but not like phone), use remoteJid for personal chats
            if (!msg.key.participant && msg.key.remoteJid?.includes('@s.whatsapp.net')) {
                senderPhone = msg.key.remoteJid.split('@')[0];
            }
            
            logger.info(`📨 Received message from ${senderPhone}: ${messageText}`);
            logger.info(`   Full JID: ${msg.key.remoteJid}, Participant: ${msg.key.participant || 'N/A'}`);

            // Check if sender is admin
            const { data: isAdmin } = await this.supabase
                .rpc('is_whatsapp_admin', { p_phone: senderPhone });

            await this.logActivity(
                'message_received',
                `Received: ${messageText}`,
                senderPhone,
                isAdmin || false,
                { message_id: msg.key.id }
            );

            // If admin and starts with /, process as command
            if (isAdmin && messageText.startsWith('/')) {
                await this.handleAdminCommand(msg, messageText, senderPhone);
            }
        }
    }

    /**
     * Handle admin commands
     */
    async handleAdminCommand(msg, command, senderPhone) {
        logger.info(`🔧 Processing admin command: ${command}`);
        
        try {
            // Import command handler dynamically to avoid circular dependency
            const { handleCommand } = await import('./whatsappCommands.js');
            const response = await handleCommand(command, senderPhone, this.sock);
            
            if (response) {
                await this.sendMessage(msg.key.remoteJid, response);
            }
        } catch (error) {
            logger.error('❌ Error processing command:', error);
            await this.sendMessage(
                msg.key.remoteJid, 
                `❌ שגיאה בביצוע הפקודה: ${error.message}`
            );
        }
    }

    /**
     * Send text message
     */
    async sendMessage(jid, text, options = {}) {
        if (!this.isConnected) {
            throw new Error('WhatsApp not connected');
        }

        try {
            const sent = await this.sock.sendMessage(jid, { 
                text,
                ...options
            });
            
            logger.info(`✅ Message sent to ${jid}`);
            return sent;
        } catch (error) {
            logger.error(`❌ Failed to send message to ${jid}:`, error);
            throw error;
        }
    }

    /**
     * Send message to phone number
     */
    async sendToPhone(phone, message) {
        // Format phone number for WhatsApp (add @s.whatsapp.net)
        const formattedPhone = phone.replace(/[^\d]/g, ''); // Remove non-digits
        const jid = `${formattedPhone}@s.whatsapp.net`;
        
        return await this.sendMessage(jid, message);
    }

    /**
     * Send message to group
     */
    async sendToGroup(groupId, message) {
        // Format group ID (add @g.us if not present)
        const jid = groupId.includes('@g.us') ? groupId : `${groupId}@g.us`;
        
        return await this.sendMessage(jid, message);
    }

    /**
     * Start queue processor
     */
    startQueueProcessor() {
        if (this.isProcessingQueue) return;
        
        this.isProcessingQueue = true;
        logger.info('🔄 Starting message queue processor...');
        
        setInterval(async () => {
            await this.processMessageQueue();
        }, 5000); // Process every 5 seconds
    }

    /**
     * Process message queue from database
     */
    async processMessageQueue() {
        if (!this.isConnected) return;

        try {
            // Get pending messages from database
            const { data: messages, error } = await this.supabase
                .rpc('get_pending_whatsapp_messages', { p_limit: 5 });

            if (error || !messages || messages.length === 0) {
                return;
            }

            logger.info(`📬 Processing ${messages.length} pending messages...`);

            for (const msg of messages) {
                try {
                    // Send message
                    if (msg.is_group && msg.group_id) {
                        await this.sendToGroup(msg.group_id, msg.message);
                    } else if (msg.recipient_phone) {
                        await this.sendToPhone(msg.recipient_phone, msg.message);
                    }

                    // Update status to sent
                    await this.supabase.rpc('update_whatsapp_message_status', {
                        p_message_id: msg.id,
                        p_status: 'sent'
                    });

                    await this.logActivity(
                        'message_sent',
                        `Sent ${msg.message_type} message`,
                        msg.recipient_phone,
                        false,
                        { message_id: msg.id, type: msg.message_type }
                    );

                    // Delay between messages
                    const { data: config } = await this.supabase
                        .from('whatsapp_config')
                        .select('value')
                        .eq('key', 'message_delay_ms')
                        .single();

                    const delay = parseInt(config?.value || '1000');
                    await new Promise(resolve => setTimeout(resolve, delay));

                } catch (error) {
                    logger.error(`❌ Failed to send message ${msg.id}:`, error);
                    
                    // Update status to failed
                    await this.supabase.rpc('update_whatsapp_message_status', {
                        p_message_id: msg.id,
                        p_status: 'failed',
                        p_error_message: error.message
                    });

                    await this.logActivity(
                        'error',
                        `Failed to send message: ${error.message}`,
                        msg.recipient_phone,
                        false,
                        { message_id: msg.id, error: error.message }
                    );
                }
            }

        } catch (error) {
            logger.error('❌ Error processing message queue:', error);
        }
    }

    /**
     * Update session state in database
     */
    async updateSessionState(data) {
        try {
            // Check if session exists
            const { data: existing } = await this.supabase
                .from('whatsapp_session')
                .select('id')
                .limit(1)
                .single();

            if (existing) {
                await this.supabase
                    .from('whatsapp_session')
                    .update({
                        ...data,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);
            } else {
                await this.supabase
                    .from('whatsapp_session')
                    .insert(data);
            }
        } catch (error) {
            logger.error('❌ Error updating session state:', error);
        }
    }

    /**
     * Log activity to database
     */
    async logActivity(type, description, phone = null, isAdmin = false, metadata = null) {
        try {
            await this.supabase.rpc('log_whatsapp_activity', {
                p_activity_type: type,
                p_description: description,
                p_phone: phone,
                p_is_admin: isAdmin,
                p_metadata: metadata
            });
        } catch (error) {
            logger.error('❌ Error logging activity:', error);
        }
    }

    /**
     * Get connection status
     */
    getStatus() {
        return {
            isConnected: this.isConnected,
            qrCode: this.qrCode,
            reconnectAttempts: this.reconnectAttempts,
            phoneNumber: this.sock?.user?.id?.split(':')[0] || null
        };
    }

    /**
     * Disconnect
     */
    async disconnect() {
        if (this.sock) {
            await this.sock.logout();
            this.isConnected = false;
            logger.info('🔌 WhatsApp disconnected');
            await this.updateSessionState({
                is_connected: false,
                connection_status: 'disconnected'
            });
        }
    }
}

// Singleton instance
let clientInstance = null;

export function getWhatsAppClient() {
    if (!clientInstance) {
        clientInstance = new WhatsAppClient();
    }
    return clientInstance;
}

export default WhatsAppClient;

