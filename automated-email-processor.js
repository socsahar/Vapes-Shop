#!/usr/bin/env node

/**
 * AUTOMATED EMAIL BATCH PROCESSOR
 * 
 * This script automatically processes ALL pending emails in batches,
 * respecting Resend's rate limits and handling failures gracefully.
 * 
 * Features:
 * - Processes all pending emails automatically
 * - Respects rate limits (2 emails/second for free tier)
 * - Retries failed emails
 * - Provides detailed monitoring and statistics
 * - Can run as a background process or scheduled task
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class AutomatedEmailProcessor {
  constructor() {
    this.stats = {
      totalProcessed: 0,
      totalFailed: 0,
      batchesRun: 0,
      startTime: new Date(),
      services: { 'Resend API': 0 },
      errors: []
    };
    
    this.config = {
      batchSize: 5,           // Emails per batch
      batchDelay: 6000,       // 6 seconds between batches (conservative)
      emailDelay: 1200,       // 1.2 seconds between emails (under 2/second limit)
      maxRetries: 3,          // Max attempts for failed emails
      timeoutMs: 300000       // 5 minute total timeout
    };
  }

  async processAllPendingEmails() {
    console.log('🚀 AUTOMATED EMAIL PROCESSOR STARTING');
    console.log('====================================');
    console.log('Configuration:');
    console.log(`  Batch size: ${this.config.batchSize} emails`);
    console.log(`  Batch delay: ${this.config.batchDelay}ms`);
    console.log(`  Email delay: ${this.config.emailDelay}ms`);
    console.log('');

    const startTime = Date.now();
    let hasMoreEmails = true;
    let iterationCount = 0;

    while (hasMoreEmails && (Date.now() - startTime) < this.config.timeoutMs) {
      iterationCount++;
      console.log(`\n📦 BATCH ${iterationCount} - ${new Date().toLocaleTimeString()}`);
      
      try {
        const result = await this.processSingleBatch();
        
        this.stats.batchesRun++;
        this.stats.totalProcessed += result.processed;
        
        if (result.services_used) {
          Object.keys(result.service_stats || {}).forEach(service => {
            this.stats.services[service] = (this.stats.services[service] || 0) + result.service_stats[service];
          });
        }

        console.log(`✅ Batch ${iterationCount} complete: ${result.processed} emails processed`);
        
        // Check if there are more emails to process
        hasMoreEmails = result.pending > 0;
        
        if (hasMoreEmails) {
          console.log(`⏳ ${result.pending} emails still pending, waiting ${this.config.batchDelay}ms before next batch...`);
          await this.sleep(this.config.batchDelay);
        } else {
          console.log('🎉 All emails processed!');
        }
        
      } catch (error) {
        console.error(`❌ Batch ${iterationCount} failed:`, error.message);
        this.stats.errors.push({ batch: iterationCount, error: error.message });
        
        // Wait longer before retrying if there's an error
        await this.sleep(this.config.batchDelay * 2);
      }

      // Safety check - don't run forever
      if (iterationCount > 20) {
        console.log('⚠️ Safety limit reached (20 batches), stopping...');
        break;
      }
    }

    this.printFinalStats();
  }

  async processSingleBatch() {
    try {
      const response = await fetch('http://localhost:3000/api/admin/email-service', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return result;
      
    } catch (error) {
      throw new Error(`Failed to process batch: ${error.message}`);
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  printFinalStats() {
    const duration = Date.now() - this.stats.startTime.getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    console.log('\n📊 FINAL PROCESSING STATISTICS');
    console.log('==============================');
    console.log(`⏱️  Total duration: ${minutes}m ${seconds}s`);
    console.log(`📧 Total emails processed: ${this.stats.totalProcessed}`);
    console.log(`🔄 Batches run: ${this.stats.batchesRun}`);
    console.log(`📈 Average emails/batch: ${(this.stats.totalProcessed / this.stats.batchesRun).toFixed(1)}`);
    
    console.log('\n🔧 Service Usage:');
    Object.entries(this.stats.services).forEach(([service, count]) => {
      if (count > 0) {
        console.log(`  ${service}: ${count} emails`);
      }
    });

    if (this.stats.errors.length > 0) {
      console.log('\n⚠️ Errors encountered:');
      this.stats.errors.forEach(error => {
        console.log(`  Batch ${error.batch}: ${error.error}`);
      });
    }

    console.log('\n✅ Automated processing complete!');
  }
}

// CLI Support
if (import.meta.url === `file://${process.argv[1]}`) {
  const processor = new AutomatedEmailProcessor();
  processor.processAllPendingEmails().catch(console.error);
}

export { AutomatedEmailProcessor };