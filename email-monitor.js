#!/usr/bin/env node

/**
 * EMAIL MONITORING SYSTEM
 * 
 * This script provides comprehensive monitoring of your email system:
 * - Real-time email queue status
 * - Delivery rate tracking
 * - Failure analysis
 * - Performance metrics
 * - Rate limit monitoring
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class EmailMonitor {
  constructor() {
    this.refreshInterval = 30000; // 30 seconds
    this.isMonitoring = false;
  }

  async getEmailStats() {
    try {
      // Get queue statistics
      const { data: queueStats } = await supabase
        .from('email_queue')
        .select('status, created_at, attempts, error_message')
        .order('created_at', { ascending: false });

      const { data: logStats } = await supabase
        .from('email_logs')
        .select('status, created_at, error_message')
        .order('created_at', { ascending: false });

      return this.analyzeStats(queueStats || [], logStats || []);
      
    } catch (error) {
      console.error('Error fetching email stats:', error);
      return null;
    }
  }

  analyzeStats(queueEmails, logEmails) {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const stats = {
      queue: {
        total: queueEmails.length,
        pending: queueEmails.filter(e => e.status === 'pending').length,
        sent: queueEmails.filter(e => e.status === 'sent').length,
        failed: queueEmails.filter(e => e.status === 'failed').length,
        processing: queueEmails.filter(e => e.status === 'processing').length
      },
      logs: {
        total: logEmails.length,
        sent: logEmails.filter(e => e.status === 'sent').length,
        failed: logEmails.filter(e => e.status === 'failed').length
      },
      recent: {
        lastHour: {
          queue: queueEmails.filter(e => new Date(e.created_at) > oneHourAgo).length,
          logs: logEmails.filter(e => new Date(e.created_at) > oneHourAgo).length
        },
        lastDay: {
          queue: queueEmails.filter(e => new Date(e.created_at) > oneDayAgo).length,
          logs: logEmails.filter(e => new Date(e.created_at) > oneDayAgo).length
        }
      },
      performance: {
        totalEmails: queueEmails.length + logEmails.length,
        totalSent: queueEmails.filter(e => e.status === 'sent').length + logEmails.filter(e => e.status === 'sent').length,
        totalFailed: queueEmails.filter(e => e.status === 'failed').length + logEmails.filter(e => e.status === 'failed').length,
        successRate: 0,
        pendingBacklog: queueEmails.filter(e => e.status === 'pending').length
      },
      errors: {
        rateLimitErrors: [...queueEmails, ...logEmails]
          .filter(e => e.error_message && e.error_message.includes('Too many requests'))
          .length,
        recentErrors: [...queueEmails, ...logEmails]
          .filter(e => e.error_message && new Date(e.created_at) > oneHourAgo)
          .map(e => e.error_message)
          .slice(0, 5)
      }
    };

    // Calculate success rate
    const totalProcessed = stats.performance.totalSent + stats.performance.totalFailed;
    if (totalProcessed > 0) {
      stats.performance.successRate = ((stats.performance.totalSent / totalProcessed) * 100).toFixed(1);
    }

    return stats;
  }

  displayStats(stats) {
    const timestamp = new Date().toLocaleString();
    
    console.clear();
    console.log('📧 EMAIL SYSTEM MONITORING DASHBOARD');
    console.log('====================================');
    console.log(`🕐 Last updated: ${timestamp}\n`);

    // Queue Status
    console.log('📤 EMAIL QUEUE STATUS');
    console.log('--------------------');
    console.log(`📋 Total in queue: ${stats.queue.total}`);
    console.log(`⏳ Pending: ${stats.queue.pending} ${stats.queue.pending > 0 ? '⚠️' : '✅'}`);
    console.log(`✅ Sent: ${stats.queue.sent}`);
    console.log(`❌ Failed: ${stats.queue.failed} ${stats.queue.failed > 0 ? '⚠️' : ''}`);
    console.log(`🔄 Processing: ${stats.queue.processing}`);

    // Performance Metrics
    console.log('\n📊 PERFORMANCE METRICS');
    console.log('---------------------');
    console.log(`📧 Total emails: ${stats.performance.totalEmails}`);
    console.log(`✅ Success rate: ${stats.performance.successRate}%`);
    console.log(`🎯 Emails sent: ${stats.performance.totalSent}`);
    console.log(`💔 Emails failed: ${stats.performance.totalFailed}`);
    console.log(`📋 Pending backlog: ${stats.performance.pendingBacklog} ${stats.performance.pendingBacklog > 10 ? '⚠️ HIGH' : ''}`);

    // Recent Activity
    console.log('\n⏰ RECENT ACTIVITY');
    console.log('-----------------');
    console.log(`🕐 Last hour: ${stats.recent.lastHour.queue + stats.recent.lastHour.logs} emails`);
    console.log(`📅 Last 24h: ${stats.recent.lastDay.queue + stats.recent.lastDay.logs} emails`);

    // Rate Limiting & Errors
    console.log('\n🚨 ERROR ANALYSIS');
    console.log('-----------------');
    console.log(`⚡ Rate limit errors: ${stats.errors.rateLimitErrors} ${stats.errors.rateLimitErrors > 0 ? '⚠️' : '✅'}`);
    
    if (stats.errors.recentErrors.length > 0) {
      console.log('🔍 Recent errors:');
      stats.errors.recentErrors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error.substring(0, 60)}${error.length > 60 ? '...' : ''}`);
      });
    } else {
      console.log('✅ No recent errors');
    }

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS');
    console.log('------------------');
    
    if (stats.performance.pendingBacklog > 10) {
      console.log('⚠️  High pending backlog - run automated processor');
    }
    
    if (stats.errors.rateLimitErrors > 5) {
      console.log('⚠️  Many rate limit errors - consider upgrading Resend plan');
    }
    
    if (parseFloat(stats.performance.successRate) < 90 && stats.performance.totalEmails > 0) {
      console.log('⚠️  Low success rate - check email configuration');
    }
    
    if (stats.performance.pendingBacklog === 0 && stats.performance.totalFailed === 0) {
      console.log('✅ Email system running smoothly!');
    }

    console.log('\n🔄 Auto-refreshing every 30 seconds... (Ctrl+C to stop)');
  }

  async startMonitoring() {
    console.log('🚀 Starting email monitoring...\n');
    this.isMonitoring = true;

    while (this.isMonitoring) {
      const stats = await this.getEmailStats();
      if (stats) {
        this.displayStats(stats);
      } else {
        console.log('❌ Failed to fetch email statistics');
      }

      await new Promise(resolve => setTimeout(resolve, this.refreshInterval));
    }
  }

  stopMonitoring() {
    this.isMonitoring = false;
    console.log('\n👋 Email monitoring stopped');
  }

  async quickStats() {
    console.log('📧 EMAIL SYSTEM QUICK STATS');
    console.log('===========================');
    
    const stats = await this.getEmailStats();
    if (stats) {
      console.log(`📋 Queue: ${stats.queue.pending} pending, ${stats.queue.sent} sent, ${stats.queue.failed} failed`);
      console.log(`📊 Success rate: ${stats.performance.successRate}%`);
      console.log(`⚡ Rate limit errors: ${stats.errors.rateLimitErrors}`);
      console.log(`📈 Last 24h: ${stats.recent.lastDay.queue + stats.recent.lastDay.logs} emails\n`);
      
      if (stats.performance.pendingBacklog > 0) {
        console.log(`💡 Tip: Run "node automated-email-processor.js" to process ${stats.performance.pendingBacklog} pending emails`);
      }
    }
  }
}

// CLI Support
if (import.meta.url === `file://${process.argv[1]}`) {
  const monitor = new EmailMonitor();
  
  // Handle command line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--quick') || args.includes('-q')) {
    monitor.quickStats();
  } else {
    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
      monitor.stopMonitoring();
      process.exit(0);
    });
    
    monitor.startMonitoring();
  }
}

export { EmailMonitor };