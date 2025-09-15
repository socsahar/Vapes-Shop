-- Simple Scheduled Orders System Database Schema Fix
-- This is a minimal version that avoids problematic operations

-- 1. Check if we can access the general_orders table
DO $$ 
BEGIN
    -- Test basic table access
    IF EXISTS (SELECT 1 FROM general_orders LIMIT 1) THEN
        RAISE NOTICE 'general_orders table is accessible';
    ELSE
        RAISE NOTICE 'general_orders table exists but is empty';
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        RAISE EXCEPTION 'general_orders table does not exist. Please create it first.';
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not access general_orders table: %', SQLERRM;
END $$;

-- 2. Add opening_time column if it doesn't exist
ALTER TABLE general_orders 
ADD COLUMN IF NOT EXISTS opening_time TIMESTAMP WITH TIME ZONE;

-- 3. Create activity_log table (simplified)
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'completed',
    user_id UUID,
    general_order_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create cron_jobs table (simplified)
DROP TABLE IF EXISTS cron_jobs CASCADE;
CREATE TABLE cron_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_name VARCHAR(100) NOT NULL UNIQUE,
    status VARCHAR(50) DEFAULT 'idle',
    last_run TIMESTAMP WITH TIME ZONE,
    last_success TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    duration_ms INTEGER,
    run_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Create email_queue table (simplified)
CREATE TABLE IF NOT EXISTS email_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    subject VARCHAR(500) NOT NULL,
    html_body TEXT NOT NULL,
    email_type VARCHAR(100) NOT NULL,
    user_id UUID,
    general_order_id UUID,
    priority INTEGER DEFAULT 5,
    status VARCHAR(50) DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Create shop_status table (simplified) - ensure only one record
DROP TABLE IF EXISTS shop_status CASCADE;
CREATE TABLE shop_status (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    is_open BOOLEAN NOT NULL DEFAULT false,
    message TEXT DEFAULT 'החנות סגורה כרגע',
    current_general_order_id UUID,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Insert exactly one shop status record
INSERT INTO shop_status (is_open, message) 
VALUES (false, 'החנות סגורה כרגע');

-- 8. Drop existing functions if they exist and recreate them
DROP FUNCTION IF EXISTS toggle_shop_status(boolean, uuid, text);
DROP FUNCTION IF EXISTS update_cron_job_status(text, text, integer, text);

-- Create basic functions without complex error handling
CREATE OR REPLACE FUNCTION toggle_shop_status(
    open_status BOOLEAN,
    general_order_id UUID DEFAULT NULL,
    status_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE shop_status SET
        is_open = open_status,
        message = COALESCE(status_message, CASE WHEN open_status THEN 'החנות פתוחה' ELSE 'החנות סגורה' END),
        current_general_order_id = general_order_id,
        updated_at = CURRENT_TIMESTAMP;
        
    IF NOT FOUND THEN
        INSERT INTO shop_status (is_open, message, current_general_order_id)
        VALUES (open_status, COALESCE(status_message, CASE WHEN open_status THEN 'החנות פתוחה' ELSE 'החנות סגורה' END), general_order_id);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 9. Create cron job status function
CREATE OR REPLACE FUNCTION update_cron_job_status(
    p_job_name TEXT,
    p_status TEXT,
    p_duration INTEGER DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO cron_jobs (
        job_name, status, last_run, last_success, last_error, duration_ms,
        run_count, success_count, failure_count
    ) VALUES (
        p_job_name, p_status, CURRENT_TIMESTAMP,
        CASE WHEN p_status = 'success' THEN CURRENT_TIMESTAMP ELSE NULL END,
        p_error_message, p_duration, 1,
        CASE WHEN p_status = 'success' THEN 1 ELSE 0 END,
        CASE WHEN p_status = 'failed' THEN 1 ELSE 0 END
    )
    ON CONFLICT (job_name) DO UPDATE SET
        status = EXCLUDED.status,
        last_run = EXCLUDED.last_run,
        last_success = CASE WHEN EXCLUDED.status = 'success' THEN EXCLUDED.last_run ELSE cron_jobs.last_success END,
        last_error = EXCLUDED.last_error,
        duration_ms = EXCLUDED.duration_ms,
        run_count = cron_jobs.run_count + 1,
        success_count = cron_jobs.success_count + CASE WHEN EXCLUDED.status = 'success' THEN 1 ELSE 0 END,
        failure_count = cron_jobs.failure_count + CASE WHEN EXCLUDED.status = 'failed' THEN 1 ELSE 0 END,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- 10. Insert initial cron job records
INSERT INTO cron_jobs (job_name, status) VALUES 
    ('auto_open_orders', 'idle'),
    ('auto_close_orders', 'idle'),
    ('send_reminder_emails', 'idle'),
    ('process_email_queue', 'idle')
ON CONFLICT (job_name) DO NOTHING;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Simple Scheduled Orders System has been set up!';
    RAISE NOTICE '📋 Added: opening_time column, activity_log, cron_jobs, email_queue, shop_status tables';
    RAISE NOTICE '📋 Added: toggle_shop_status and update_cron_job_status functions';
    RAISE NOTICE '⚠️  Status constraint was skipped to avoid errors';
    RAISE NOTICE '📝 You may need to manually add the status constraint later';
    RAISE NOTICE '🚀 Core system is ready for scheduled orders!';
END $$;