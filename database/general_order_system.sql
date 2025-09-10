-- Enhanced General Order System Schema
-- Add this to your existing database

-- Add reminder tracking columns to general_orders
ALTER TABLE general_orders ADD COLUMN IF NOT EXISTS reminder_1h_sent BOOLEAN DEFAULT false;
ALTER TABLE general_orders ADD COLUMN IF NOT EXISTS reminder_10m_sent BOOLEAN DEFAULT false;
ALTER TABLE general_orders ADD COLUMN IF NOT EXISTS closure_email_sent BOOLEAN DEFAULT false;
ALTER TABLE general_orders ADD COLUMN IF NOT EXISTS opening_email_sent BOOLEAN DEFAULT false;

-- Add timezone-aware functions for Jerusalem time
CREATE OR REPLACE FUNCTION jerusalem_now()
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
    RETURN NOW() AT TIME ZONE 'Asia/Jerusalem';
END;
$$ LANGUAGE plpgsql;

-- Enhanced function to check for reminders and send emails
CREATE OR REPLACE FUNCTION check_general_order_reminders()
RETURNS void AS $$
DECLARE
    order_record RECORD;
    jerusalem_time TIMESTAMP WITH TIME ZONE;
BEGIN
    jerusalem_time := jerusalem_now();
    
    -- Check for 1-hour reminders
    FOR order_record IN 
        SELECT * FROM general_orders 
        WHERE status = 'open' 
        AND reminder_1h_sent = false
        AND deadline <= jerusalem_time + INTERVAL '1 hour'
        AND deadline > jerusalem_time + INTERVAL '59 minutes'
    LOOP
        -- Mark as sent
        UPDATE general_orders 
        SET reminder_1h_sent = true, updated_at = CURRENT_TIMESTAMP
        WHERE id = order_record.id;
        
        -- Log the reminder need (will be picked up by email service)
        INSERT INTO email_logs (recipient_email, subject, body, status)
        VALUES (
            'SYSTEM_REMINDER_1H', 
            'תזכורת: הזמנה קבוצתית נסגרת בעוד שעה - ' || order_record.title,
            'GENERAL_ORDER_REMINDER_1H:' || order_record.id::text,
            'pending'
        );
    END LOOP;
    
    -- Check for 10-minute reminders
    FOR order_record IN 
        SELECT * FROM general_orders 
        WHERE status = 'open' 
        AND reminder_10m_sent = false
        AND deadline <= jerusalem_time + INTERVAL '10 minutes'
        AND deadline > jerusalem_time + INTERVAL '9 minutes'
    LOOP
        -- Mark as sent
        UPDATE general_orders 
        SET reminder_10m_sent = true, updated_at = CURRENT_TIMESTAMP
        WHERE id = order_record.id;
        
        -- Log the reminder need
        INSERT INTO email_logs (recipient_email, subject, body, status)
        VALUES (
            'SYSTEM_REMINDER_10M', 
            'תזכורת אחרונה: הזמנה קבוצתית נסגרת בעוד 10 דקות - ' || order_record.title,
            'GENERAL_ORDER_REMINDER_10M:' || order_record.id::text,
            'pending'
        );
    END LOOP;
    
    -- Check for orders that need to be closed
    FOR order_record IN 
        SELECT * FROM general_orders 
        WHERE status = 'open' 
        AND deadline <= jerusalem_time
    LOOP
        -- Close the order
        UPDATE general_orders 
        SET status = 'closed', closure_email_sent = true, updated_at = CURRENT_TIMESTAMP
        WHERE id = order_record.id;
        
        -- Log the closure notification need
        INSERT INTO email_logs (recipient_email, subject, body, status)
        VALUES (
            'SYSTEM_ORDER_CLOSED', 
            'הזמנה קבוצתית נסגרה - ' || order_record.title,
            'GENERAL_ORDER_CLOSED:' || order_record.id::text,
            'pending'
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Add shop status tracking
CREATE TABLE IF NOT EXISTS shop_status (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    is_open BOOLEAN DEFAULT false,
    current_general_order_id UUID REFERENCES general_orders(id) ON DELETE SET NULL,
    message TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial shop status (closed by default)
INSERT INTO shop_status (is_open, message) 
VALUES (false, 'החנות סגורה כרגע. נפתח בהזמנה קבוצתית הבאה.')
ON CONFLICT DO NOTHING;

-- Create function to toggle shop status
CREATE OR REPLACE FUNCTION toggle_shop_status(open_status BOOLEAN, general_order_id UUID DEFAULT NULL, status_message TEXT DEFAULT NULL)
RETURNS void AS $$
BEGIN
    UPDATE shop_status 
    SET 
        is_open = open_status,
        current_general_order_id = general_order_id,
        message = COALESCE(status_message, 
            CASE 
                WHEN open_status THEN 'החנות פתוחה להזמנות!'
                ELSE 'החנות סגורה כרגע. נפתח בהזמנה קבוצתית הבאה.'
            END
        ),
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS for shop_status
ALTER TABLE shop_status ENABLE ROW LEVEL SECURITY;

-- Anyone can view shop status
CREATE POLICY "Anyone can view shop status" ON shop_status
    FOR SELECT USING (true);

-- Only admins can update shop status
CREATE POLICY "Admins can update shop status" ON shop_status
    FOR UPDATE USING (EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    ));

-- Create email template types
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    template_type VARCHAR(100) UNIQUE NOT NULL,
    subject_template TEXT NOT NULL,
    body_template TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default email templates
INSERT INTO email_templates (template_type, subject_template, body_template) VALUES
('GENERAL_ORDER_OPENED', 
 'הזמנה קבוצתית חדשה נפתחה - {{title}}',
 '<!DOCTYPE html>
<html dir="rtl">
<head><meta charset="UTF-8"><title>הזמנה קבוצתית נפתחה</title></head>
<body style="font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
<div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
<h1 style="margin: 0; font-size: 28px;">🛒 הזמנה קבוצתית נפתחה!</h1>
</div>
<div style="padding: 30px;">
<h2 style="color: #333; margin-bottom: 20px;">{{title}}</h2>
<p style="color: #666; line-height: 1.6; font-size: 16px;">{{description}}</p>
<div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
<p style="margin: 0; color: #333;"><strong>⏰ תאריך סגירה:</strong> {{deadline}}</p>
</div>
<div style="text-align: center; margin: 30px 0;">
<a href="{{shop_url}}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">בצע הזמנה עכשיו</a>
</div>
<p style="color: #888; font-size: 14px; text-align: center;">לא לקבל הודעות? <a href="{{unsubscribe_url}}">הסר מהרשימה</a></p>
</div>
</div>
</body>
</html>'),

('GENERAL_ORDER_REMINDER_1H',
 'תזכורת: הזמנה קבוצתית נסגרת בעוד שעה - {{title}}',
 '<!DOCTYPE html>
<html dir="rtl">
<head><meta charset="UTF-8"><title>תזכורת - הזמנה נסגרת בקרוב</title></head>
<body style="font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
<div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
<div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center;">
<h1 style="margin: 0; font-size: 28px;">⏰ תזכורת אחרונה!</h1>
</div>
<div style="padding: 30px;">
<h2 style="color: #333; margin-bottom: 20px;">{{title}}</h2>
<div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0;">
<p style="margin: 0; color: #856404; font-weight: bold;">⚠️ ההזמנה הקבוצתית נסגרת בעוד שעה בלבד!</p>
</div>
<p style="color: #666; line-height: 1.6; font-size: 16px;">זו ההזדמנות האחרונה שלך להצטרף להזמנה.</p>
<div style="text-align: center; margin: 30px 0;">
<a href="{{shop_url}}" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">הזמן עכשיו לפני שמאוחר!</a>
</div>
</div>
</div>
</body>
</html>'),

('GENERAL_ORDER_REMINDER_10M',
 'תזכורת אחרונה: הזמנה קבוצתית נסגרת בעוד 10 דקות - {{title}}',
 '<!DOCTYPE html>
<html dir="rtl">
<head><meta charset="UTF-8"><title>תזכורת אחרונה - הזמנה נסגרת בעוד דקות!</title></head>
<body style="font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
<div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
<div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 30px; text-align: center;">
<h1 style="margin: 0; font-size: 28px;">🚨 תזכורת דחופה!</h1>
</div>
<div style="padding: 30px;">
<h2 style="color: #333; margin-bottom: 20px;">{{title}}</h2>
<div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; border-radius: 8px; margin: 20px 0;">
<p style="margin: 0; color: #721c24; font-weight: bold; font-size: 18px;">🚨 ההזמנה נסגרת בעוד 10 דקות בלבד!</p>
</div>
<p style="color: #666; line-height: 1.6; font-size: 16px;">זה הזמן האחרון להשלים את ההזמנה שלך.</p>
<div style="text-align: center; margin: 30px 0;">
<a href="{{shop_url}}" style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block; animation: pulse 2s infinite;">הזמן עכשיו - אחרון חשוב!</a>
</div>
</div>
</div>
</body>
</html>'),

('GENERAL_ORDER_CLOSED',
 'הזמנה קבוצתית נסגרה - {{title}}',
 '<!DOCTYPE html>
<html dir="rtl">
<head><meta charset="UTF-8"><title>הזמנה קבוצתית נסגרה</title></head>
<body style="font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
<div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
<div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 30px; text-align: center;">
<h1 style="margin: 0; font-size: 28px;">✅ הזמנה קבוצתית נסגרה</h1>
</div>
<div style="padding: 30px;">
<h2 style="color: #333; margin-bottom: 20px;">{{title}}</h2>
<p style="color: #666; line-height: 1.6; font-size: 16px;">ההזמנה הקבוצתית נסגרה בהצלחה. אנו מעבדים את ההזמנות ונעדכן בקרוב על הסטטוס.</p>
<div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 8px; margin: 20px 0;">
<p style="margin: 0; color: #155724; font-weight: bold;">✅ תודה על השתתפותך בהזמנה הקבוצתית!</p>
</div>
<p style="color: #888; font-size: 14px; text-align: center;">החנות סגורה כעת עד להזמנה קבוצתית הבאה.</p>
</div>
</div>
</body>
</html>'),

('USER_ORDER_CONFIRMATION',
 'אישור הזמנה - {{order_id}}',
 '<!DOCTYPE html>
<html dir="rtl">
<head><meta charset="UTF-8"><title>אישור הזמנה</title></head>
<body style="font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
<div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
<h1 style="margin: 0; font-size: 28px;">✅ הזמנתך התקבלה!</h1>
</div>
<div style="padding: 30px;">
<h2 style="color: #333; margin-bottom: 20px;">פרטי ההזמנה</h2>
<p style="color: #666; line-height: 1.6; font-size: 16px;">שלום {{user_name}}, ההזמנה שלך התקבלה בהצלחה והתווספה להזמנה הקבוצתית.</p>
<div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
<p style="margin: 0; color: #333;"><strong>מספר הזמנה:</strong> {{order_id}}</p>
<p style="margin: 10px 0 0 0; color: #333;"><strong>סכום כולל:</strong> ₪{{total_amount}}</p>
</div>
<div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0;">
<p style="margin: 0; color: #856404;">💡 ניתן לערוך את ההזמנה עד לסגירת ההזמנה הקבוצתית</p>
</div>
{{order_items}}
<div style="text-align: center; margin: 30px 0;">
<a href="{{shop_url}}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">עריכת הזמנה</a>
</div>
</div>
</div>
</body>
</html>')

ON CONFLICT (template_type) DO UPDATE SET
    subject_template = EXCLUDED.subject_template,
    body_template = EXCLUDED.body_template,
    updated_at = CURRENT_TIMESTAMP;

-- Enable RLS for email_templates
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Anyone can read templates (for email service)
CREATE POLICY "Anyone can read email templates" ON email_templates
    FOR SELECT USING (is_active = true);

-- Only admins can manage templates
CREATE POLICY "Admins can manage email templates" ON email_templates
    FOR ALL USING (EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    ));

-- Create trigger for email_templates updated_at
CREATE TRIGGER update_email_templates_updated_at 
    BEFORE UPDATE ON email_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE shop_status IS 'סטטוס החנות - פתוח/סגור';
COMMENT ON TABLE email_templates IS 'תבניות אימייל למערכת';
COMMENT ON FUNCTION jerusalem_now() IS 'החזרת זמן ירושלים הנוכחי';
COMMENT ON FUNCTION check_general_order_reminders() IS 'בדיקת תזכורות להזמנות קבוצתיות ושליחת אימיילים';
COMMENT ON FUNCTION toggle_shop_status(BOOLEAN, UUID, TEXT) IS 'החלפת סטטוס החנות';