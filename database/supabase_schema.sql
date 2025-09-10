-- Modern Vape Shop Database Schema for Supabase
-- Run this SQL in your Supabase SQL Editor (Supabase Compatible Version)

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    is_active BOOLEAN DEFAULT true,
    force_password_change BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    stock_quantity INTEGER DEFAULT 0 CHECK (stock_quantity >= 0),
    category VARCHAR(100),
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create orders table (without foreign key constraint initially)
CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    general_order_id UUID, -- Will reference general_orders table after it's created
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    shipping_address TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create general_orders table (for group orders)
CREATE TABLE IF NOT EXISTS general_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'closed', 'processing', 'completed')),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    total_orders INTEGER DEFAULT 0,
    total_amount DECIMAL(10,2) DEFAULT 0,
    reminder_1h_sent BOOLEAN DEFAULT false,
    reminder_10m_sent BOOLEAN DEFAULT false,
    closure_email_sent BOOLEAN DEFAULT false,
    opening_email_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create email_logs table
CREATE TABLE IF NOT EXISTS email_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_email VARCHAR(255) NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'processing')),
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create user_logs table
CREATE TABLE IF NOT EXISTS user_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add missing columns to existing tables if they don't exist
-- Ensure users table has all required columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'username') THEN
        ALTER TABLE users ADD COLUMN username VARCHAR(255) UNIQUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password') THEN
        ALTER TABLE users ADD COLUMN password VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password_hash') THEN
        ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'full_name') THEN
        ALTER TABLE users ADD COLUMN full_name VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'phone') THEN
        ALTER TABLE users ADD COLUMN phone VARCHAR(20);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'address') THEN
        ALTER TABLE users ADD COLUMN address TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role') THEN
        ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'force_password_change') THEN
        ALTER TABLE users ADD COLUMN force_password_change BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_active') THEN
        ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'created_at') THEN
        ALTER TABLE users ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'updated_at') THEN
        ALTER TABLE users ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Ensure products table has all required columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'is_active') THEN
        ALTER TABLE products ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'stock_quantity') THEN
        ALTER TABLE products ADD COLUMN stock_quantity INTEGER DEFAULT 0 CHECK (stock_quantity >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'category') THEN
        ALTER TABLE products ADD COLUMN category VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'image_url') THEN
        ALTER TABLE products ADD COLUMN image_url TEXT;
    END IF;
END $$;

-- Ensure general_orders table has all required columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'general_orders' AND column_name = 'reminder_1h_sent') THEN
        ALTER TABLE general_orders ADD COLUMN reminder_1h_sent BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'general_orders' AND column_name = 'reminder_10m_sent') THEN
        ALTER TABLE general_orders ADD COLUMN reminder_10m_sent BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'general_orders' AND column_name = 'closure_email_sent') THEN
        ALTER TABLE general_orders ADD COLUMN closure_email_sent BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'general_orders' AND column_name = 'opening_email_sent') THEN
        ALTER TABLE general_orders ADD COLUMN opening_email_sent BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'general_orders' AND column_name = 'total_orders') THEN
        ALTER TABLE general_orders ADD COLUMN total_orders INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'general_orders' AND column_name = 'total_amount') THEN
        ALTER TABLE general_orders ADD COLUMN total_amount DECIMAL(10,2) DEFAULT 0;
    END IF;
END $$;

-- Ensure user_logs table has all required columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_logs' AND column_name = 'action') THEN
        ALTER TABLE user_logs ADD COLUMN action VARCHAR(100) NOT NULL DEFAULT 'unknown';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_logs' AND column_name = 'details') THEN
        ALTER TABLE user_logs ADD COLUMN details JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_logs' AND column_name = 'ip_address') THEN
        ALTER TABLE user_logs ADD COLUMN ip_address INET;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_logs' AND column_name = 'user_agent') THEN
        ALTER TABLE user_logs ADD COLUMN user_agent TEXT;
    END IF;
END $$;

-- Ensure system_settings table has all required columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_settings' AND column_name = 'description') THEN
        ALTER TABLE system_settings ADD COLUMN description TEXT;
    END IF;
END $$;

-- Add foreign key for general_order_id in orders table (after general_orders table exists)
-- First, ensure the general_order_id column exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'general_order_id'
    ) THEN
        ALTER TABLE orders ADD COLUMN general_order_id UUID;
    END IF;
END $$;

-- Then add the foreign key constraint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_orders_general_order'
        AND table_name = 'orders'
    ) THEN
        ALTER TABLE orders ADD CONSTRAINT fk_orders_general_order 
            FOREIGN KEY (general_order_id) REFERENCES general_orders(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_general_order_id ON orders(general_order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_general_orders_status ON general_orders(status);
CREATE INDEX IF NOT EXISTS idx_general_orders_deadline ON general_orders(deadline);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_user_logs_user_id ON user_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_logs_action ON user_logs(action);

-- Create function to update updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns (only if they don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'update_users_updated_at') THEN
        CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'update_products_updated_at') THEN
        CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'update_orders_updated_at') THEN
        CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'update_general_orders_updated_at') THEN
        CREATE TRIGGER update_general_orders_updated_at BEFORE UPDATE ON general_orders 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'update_system_settings_updated_at') THEN
        CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE general_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to prevent conflicts (ignore errors if they don't exist)
DO $$ 
BEGIN
    -- Drop all existing policies for clean setup
    DROP POLICY IF EXISTS "Users can view their own profile" ON users;
    DROP POLICY IF EXISTS "Users can update their own profile" ON users;
    DROP POLICY IF EXISTS "Admins can view all users" ON users;
    DROP POLICY IF EXISTS "Admins can manage all users" ON users;
    DROP POLICY IF EXISTS "Anyone can view active products" ON products;
    DROP POLICY IF EXISTS "Admins can manage all products" ON products;
    DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
    DROP POLICY IF EXISTS "Users can create their own orders" ON orders;
    DROP POLICY IF EXISTS "Users can update their own pending orders" ON orders;
    DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
    DROP POLICY IF EXISTS "Admins can manage all orders" ON orders;
    DROP POLICY IF EXISTS "Users can view their order items" ON order_items;
    DROP POLICY IF EXISTS "Users can manage their order items" ON order_items;
    DROP POLICY IF EXISTS "Admins can view all order items" ON order_items;
    DROP POLICY IF EXISTS "Admins can manage all order items" ON order_items;
    DROP POLICY IF EXISTS "Anyone can view general orders" ON general_orders;
    DROP POLICY IF EXISTS "Admins can manage general orders" ON general_orders;
    DROP POLICY IF EXISTS "Admins can view email logs" ON email_logs;
    DROP POLICY IF EXISTS "System can manage email logs" ON email_logs;
    DROP POLICY IF EXISTS "Anyone can read system settings" ON system_settings;
    DROP POLICY IF EXISTS "Admins can manage system settings" ON system_settings;
    DROP POLICY IF EXISTS "Users can view their own logs" ON user_logs;
    DROP POLICY IF EXISTS "Admins can view all user logs" ON user_logs;
    DROP POLICY IF EXISTS "System can create user logs" ON user_logs;
EXCEPTION
    WHEN OTHERS THEN NULL; -- Ignore errors if policies don't exist
END $$;

-- Create RLS policies for users table
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (id::text = auth.uid()::text);

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (id::text = auth.uid()::text);

CREATE POLICY "Admins can view all users" ON users
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    ));

CREATE POLICY "Admins can manage all users" ON users
    FOR ALL USING (EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    ));

-- Create RLS policies for products table
CREATE POLICY "Anyone can view active products" ON products
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage all products" ON products
    FOR ALL USING (EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    ));

-- Create RLS policies for orders table
CREATE POLICY "Users can view their own orders" ON orders
    FOR SELECT USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can create their own orders" ON orders
    FOR INSERT WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "Users can update their own pending orders" ON orders
    FOR UPDATE USING (user_id::text = auth.uid()::text AND status = 'pending');

CREATE POLICY "Admins can view all orders" ON orders
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    ));

CREATE POLICY "Admins can manage all orders" ON orders
    FOR ALL USING (EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    ));

-- Create RLS policies for order_items table
CREATE POLICY "Users can view their order items" ON order_items
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id::text = auth.uid()::text
    ));

CREATE POLICY "Users can manage their order items" ON order_items
    FOR ALL USING (EXISTS (
        SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id::text = auth.uid()::text
    ));

CREATE POLICY "Admins can view all order items" ON order_items
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    ));

CREATE POLICY "Admins can manage all order items" ON order_items
    FOR ALL USING (EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    ));

-- Create RLS policies for general_orders table
CREATE POLICY "Anyone can view general orders" ON general_orders
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage general orders" ON general_orders
    FOR ALL USING (EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    ));

-- Create RLS policies for email_logs table
CREATE POLICY "Admins can view email logs" ON email_logs
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    ));

CREATE POLICY "System can manage email logs" ON email_logs
    FOR ALL USING (true); -- Allow API to manage email logs

-- Create RLS policies for system_settings table
CREATE POLICY "Anyone can read system settings" ON system_settings
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage system settings" ON system_settings
    FOR ALL USING (EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    ));

-- Create RLS policies for user_logs table
CREATE POLICY "Users can view their own logs" ON user_logs
    FOR SELECT USING (user_id::text = auth.uid()::text);

CREATE POLICY "Admins can view all user logs" ON user_logs
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    ));

CREATE POLICY "System can create user logs" ON user_logs
    FOR INSERT WITH CHECK (true);

-- Insert default system settings (only if they don't exist)
DO $$ 
BEGIN
    -- Insert system settings one by one to avoid conflicts
    IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'shop_name') THEN
        INSERT INTO system_settings (setting_key, setting_value, description) VALUES ('shop_name', 'VapeShop Pro', 'שם החנות');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'shop_email') THEN
        INSERT INTO system_settings (setting_key, setting_value, description) VALUES ('shop_email', 'admin@vapeshop.com', 'כתובת אימייל של החנות');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'shop_phone') THEN
        INSERT INTO system_settings (setting_key, setting_value, description) VALUES ('shop_phone', '+972-50-123-4567', 'טלפון החנות');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'shop_address') THEN
        INSERT INTO system_settings (setting_key, setting_value, description) VALUES ('shop_address', 'רחוב הראשי 123, תל אביב', 'כתובת החנות');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'currency') THEN
        INSERT INTO system_settings (setting_key, setting_value, description) VALUES ('currency', 'ILS', 'מטבע');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'currency_symbol') THEN
        INSERT INTO system_settings (setting_key, setting_value, description) VALUES ('currency_symbol', '₪', 'סמל מטבע');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'timezone') THEN
        INSERT INTO system_settings (setting_key, setting_value, description) VALUES ('timezone', 'Asia/Jerusalem', 'אזור זמן');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'email_notifications') THEN
        INSERT INTO system_settings (setting_key, setting_value, description) VALUES ('email_notifications', 'true', 'הפעלת התראות אימייל');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'auto_close_orders') THEN
        INSERT INTO system_settings (setting_key, setting_value, description) VALUES ('auto_close_orders', 'true', 'סגירה אוטומטית של הזמנות');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'order_reminder_1h') THEN
        INSERT INTO system_settings (setting_key, setting_value, description) VALUES ('order_reminder_1h', 'true', 'תזכורת שעה לפני סגירה');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'order_reminder_10m') THEN
        INSERT INTO system_settings (setting_key, setting_value, description) VALUES ('order_reminder_10m', 'true', 'תזכורת 10 דקות לפני סגירה');
    END IF;
END $$;

-- Insert sample admin user (password: admin123) only if doesn't exist
-- Note: In production, change this password immediately
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@vapeshop.com' OR username = 'admin') THEN
        INSERT INTO users (username, password, email, password_hash, full_name, role) VALUES
        ('admin', 'admin123', 'admin@vapeshop.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeKrZKMj8.4PTBDbG', 'מנהל מערכת', 'admin');
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON TABLE users IS 'טבלת משתמשים';
COMMENT ON TABLE products IS 'טבלת מוצרים';
COMMENT ON TABLE orders IS 'טבלת הזמנות';
COMMENT ON TABLE order_items IS 'פריטי הזמנה';
COMMENT ON TABLE general_orders IS 'הזמנות קבוצתיות';
COMMENT ON TABLE email_logs IS 'לוג אימיילים';
COMMENT ON TABLE system_settings IS 'הגדרות מערכת';
COMMENT ON TABLE user_logs IS 'לוג פעילות משתמשים';