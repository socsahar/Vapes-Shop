-- Modern Vape Shop Database Schema for Supabase
-- Run this SQL in your Supabase SQL Editor

-- Enable Row Level Security
ALTER DATABASE postgres SET "app.settings.jwt_secret" TO 'your-jwt-secret-here';

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    category VARCHAR(100),
    stock_quantity INTEGER DEFAULT 0 CHECK (stock_quantity >= 0),
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create general_orders table (group orders)
CREATE TABLE IF NOT EXISTS general_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closed', 'completed')),
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create general_order_participants table
CREATE TABLE IF NOT EXISTS general_order_participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    general_order_id UUID NOT NULL REFERENCES general_orders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(general_order_id, user_id, product_id)
);

-- Create email_logs table
CREATE TABLE IF NOT EXISTS email_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('sent', 'failed', 'pending')),
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create password_reset_tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

CREATE INDEX IF NOT EXISTS idx_general_orders_status ON general_orders(status);
CREATE INDEX IF NOT EXISTS idx_general_orders_deadline ON general_orders(deadline);
CREATE INDEX IF NOT EXISTS idx_general_orders_created_by ON general_orders(created_by);

CREATE INDEX IF NOT EXISTS idx_general_order_participants_order_id ON general_order_participants(general_order_id);
CREATE INDEX IF NOT EXISTS idx_general_order_participants_user_id ON general_order_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);

-- Create triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_general_orders_updated_at BEFORE UPDATE ON general_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE general_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE general_order_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users policies
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (auth.uid()::text = id::text OR EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    ));

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (auth.uid()::text = id::text OR EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    ));

CREATE POLICY "Admins can manage all users" ON users
    FOR ALL USING (EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    ));

-- Products policies (public read, admin write)
CREATE POLICY "Anyone can view active products" ON products
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage products" ON products
    FOR ALL USING (EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    ));

-- Orders policies
CREATE POLICY "Users can view their own orders" ON orders
    FOR SELECT USING (user_id::text = auth.uid()::text OR EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    ));

CREATE POLICY "Users can create their own orders" ON orders
    FOR INSERT WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "Users can update their own pending orders" ON orders
    FOR UPDATE USING (user_id::text = auth.uid()::text AND status = 'pending' OR EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    ));

CREATE POLICY "Admins can manage all orders" ON orders
    FOR ALL USING (EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    ));

-- Order items policies
CREATE POLICY "Users can view their order items" ON order_items
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM orders WHERE orders.id = order_items.order_id 
        AND (orders.user_id::text = auth.uid()::text OR EXISTS (
            SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
        ))
    ));

CREATE POLICY "Users can manage their order items" ON order_items
    FOR ALL USING (EXISTS (
        SELECT 1 FROM orders WHERE orders.id = order_items.order_id 
        AND (orders.user_id::text = auth.uid()::text OR EXISTS (
            SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
        ))
    ));

-- General orders policies
CREATE POLICY "Anyone can view open general orders" ON general_orders
    FOR SELECT USING (status = 'open' OR created_by::text = auth.uid()::text OR EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    ));

CREATE POLICY "Authenticated users can create general orders" ON general_orders
    FOR INSERT WITH CHECK (created_by::text = auth.uid()::text);

CREATE POLICY "Creators and admins can update general orders" ON general_orders
    FOR UPDATE USING (created_by::text = auth.uid()::text OR EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    ));

-- General order participants policies
CREATE POLICY "Users can view participants of open orders" ON general_order_participants
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM general_orders WHERE general_orders.id = general_order_participants.general_order_id 
        AND (general_orders.status = 'open' OR general_orders.created_by::text = auth.uid()::text OR EXISTS (
            SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
        ))
    ));

CREATE POLICY "Users can manage their own participation" ON general_order_participants
    FOR ALL USING (user_id::text = auth.uid()::text OR EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    ));

-- Email logs policies (admin only)
CREATE POLICY "Admins can view email logs" ON email_logs
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    ));

CREATE POLICY "System can insert email logs" ON email_logs
    FOR INSERT WITH CHECK (true);

-- System settings policies (admin only)
CREATE POLICY "Admins can manage system settings" ON system_settings
    FOR ALL USING (EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    ));

-- Password reset tokens policies
CREATE POLICY "Anyone can view valid tokens" ON password_reset_tokens
    FOR SELECT USING (expires_at > CURRENT_TIMESTAMP AND used = false);

CREATE POLICY "System can manage reset tokens" ON password_reset_tokens
    FOR ALL WITH CHECK (true);

-- Insert default admin user (change password after first login)
INSERT INTO users (email, password_hash, full_name, role, force_password_change) 
VALUES (
    'admin@yourshop.com', 
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeUcLgYInusS9a2hq', -- 'admin123'
    'מנהל המערכת',
    'admin',
    true
) ON CONFLICT (email) DO NOTHING;

-- Insert sample system settings
INSERT INTO system_settings (key, value, description) VALUES
    ('site_name', 'Vape Shop Israel', 'שם האתר'),
    ('site_description', 'החנות הטובה ביותר לווייפ בישראל', 'תיאור האתר'),
    ('currency', 'ILS', 'מטבע ברירת מחדל'),
    ('tax_rate', '17', 'שיעור מע"מ באחוזים'),
    ('min_order_amount', '100', 'סכום מינימלי להזמנה'),
    ('email_notifications', 'true', 'האם לשלוח התראות במייל'),
    ('registration_enabled', 'true', 'האם ניתן להירשם למערכת'),
    ('general_orders_enabled', 'true', 'האם הזמנות קבוצתיות פעילות')
ON CONFLICT (key) DO NOTHING;

-- Insert sample product categories
INSERT INTO products (name, description, price, category, stock_quantity, is_active) VALUES
    ('Pod מתקדם', 'Pod חדיש ואיכותי למתחילים ומתקדמים', 150.00, 'Pods', 10, true),
    ('נוזל טעם וניל', 'נוזל איכותי בטעם וניל עדין', 25.00, 'נוזלים', 50, true),
    ('נוזל טעם מנטול', 'נוזל מנטול קריר ומרענן', 25.00, 'נוזלים', 45, true),
    ('סוללה חזקה', 'סוללה איכותית עם חיי שימוש ארוכים', 80.00, 'אביזרים', 20, true),
    ('מטען מהיר', 'מטען מהיר ובטוח לכל סוגי הפודים', 35.00, 'אביזרים', 30, true)
ON CONFLICT DO NOTHING;

-- Create helpful views
CREATE OR REPLACE VIEW order_details AS
SELECT 
    o.id,
    o.user_id,
    u.full_name as user_name,
    u.email as user_email,
    o.status,
    o.total_amount,
    o.notes,
    o.created_at,
    o.updated_at,
    COALESCE(
        json_agg(
            json_build_object(
                'id', oi.id,
                'product_id', oi.product_id,
                'product_name', p.name,
                'quantity', oi.quantity,
                'price', oi.price,
                'total', oi.quantity * oi.price
            )
        ) FILTER (WHERE oi.id IS NOT NULL), 
        '[]'::json
    ) as items
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
LEFT JOIN order_items oi ON o.id = oi.order_id
LEFT JOIN products p ON oi.product_id = p.id
GROUP BY o.id, u.id;

CREATE OR REPLACE VIEW general_order_details AS
SELECT 
    go.id,
    go.title,
    go.description,
    go.deadline,
    go.status,
    go.created_by,
    creator.full_name as creator_name,
    go.created_at,
    go.updated_at,
    COUNT(DISTINCT gop.user_id) as participant_count,
    COALESCE(
        json_agg(
            DISTINCT json_build_object(
                'id', gop.id,
                'user_id', gop.user_id,
                'user_name', participant.full_name,
                'product_id', gop.product_id,
                'product_name', p.name,
                'quantity', gop.quantity,
                'notes', gop.notes
            )
        ) FILTER (WHERE gop.id IS NOT NULL), 
        '[]'::json
    ) as participants
FROM general_orders go
LEFT JOIN users creator ON go.created_by = creator.id
LEFT JOIN general_order_participants gop ON go.id = gop.general_order_id
LEFT JOIN users participant ON gop.user_id = participant.id
LEFT JOIN products p ON gop.product_id = p.id
GROUP BY go.id, creator.id;

-- Function to automatically close expired general orders
CREATE OR REPLACE FUNCTION close_expired_general_orders()
RETURNS void AS $$
BEGIN
    UPDATE general_orders 
    SET status = 'closed', updated_at = CURRENT_TIMESTAMP
    WHERE status = 'open' AND deadline < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Create a function to calculate order total
CREATE OR REPLACE FUNCTION calculate_order_total(order_id UUID)
RETURNS DECIMAL AS $$
DECLARE
    total DECIMAL(10,2);
BEGIN
    SELECT COALESCE(SUM(quantity * price), 0)
    INTO total
    FROM order_items
    WHERE order_items.order_id = calculate_order_total.order_id;
    
    UPDATE orders SET total_amount = total WHERE id = calculate_order_total.order_id;
    
    RETURN total;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update order total when items change
CREATE OR REPLACE FUNCTION update_order_total()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM calculate_order_total(
        CASE 
            WHEN TG_OP = 'DELETE' THEN OLD.order_id
            ELSE NEW.order_id
        END
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_order_total
    AFTER INSERT OR UPDATE OR DELETE ON order_items
    FOR EACH ROW EXECUTE FUNCTION update_order_total();

-- Set up periodic task to close expired orders (you can set this up as a cron job)
-- SELECT cron.schedule('close-expired-orders', '0 */6 * * *', 'SELECT close_expired_general_orders();');

COMMENT ON TABLE users IS 'רשימת משתמשי המערכת';
COMMENT ON TABLE products IS 'קטלוג המוצרים';
COMMENT ON TABLE orders IS 'הזמנות אישיות';
COMMENT ON TABLE order_items IS 'פריטים בהזמנות';
COMMENT ON TABLE general_orders IS 'הזמנות קבוצתיות';
COMMENT ON TABLE general_order_participants IS 'משתתפים בהזמנות קבוצתיות';
COMMENT ON TABLE email_logs IS 'לוג הודעות אימייל';
COMMENT ON TABLE system_settings IS 'הגדרות המערכת';
COMMENT ON TABLE password_reset_tokens IS 'טוקנים לאיפוס סיסמה';