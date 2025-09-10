// Script to add missing tables and update schema for existing database
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function addMissingTables() {
  console.log('🔧 Adding missing tables to Supabase database...')
  console.log('=' .repeat(60))
  
  try {
    // Add missing columns to products table
    console.log('\n📦 Updating products table schema...')
    await supabaseAdmin.rpc('exec_sql', {
      sql: `
        -- Add missing columns to products table if they don't exist
        DO $$ 
        BEGIN
          -- Add is_active column if it doesn't exist
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='is_active') THEN
            ALTER TABLE products ADD COLUMN is_active BOOLEAN DEFAULT true;
          END IF;
          
          -- Add category column if it doesn't exist
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='category') THEN
            ALTER TABLE products ADD COLUMN category VARCHAR(100);
          END IF;
          
          -- Add stock_quantity column if it doesn't exist
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='stock_quantity') THEN
            ALTER TABLE products ADD COLUMN stock_quantity INTEGER DEFAULT 0 CHECK (stock_quantity >= 0);
          END IF;
          
          -- Add image_url column if it doesn't exist
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='image_url') THEN
            ALTER TABLE products ADD COLUMN image_url TEXT;
          END IF;
        END
        $$;
      `
    })
    
    // Create general_orders table (group orders)
    console.log('\n👥 Creating general_orders table...')
    await supabaseAdmin.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS general_orders (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          deadline TIMESTAMP WITH TIME ZONE NOT NULL,
          status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closed', 'completed')),
          created_by UUID NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Add foreign key constraint if users table exists
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
            IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'general_orders_created_by_fkey') THEN
              ALTER TABLE general_orders ADD CONSTRAINT general_orders_created_by_fkey 
              FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;
            END IF;
          END IF;
        END
        $$;
      `
    })
    
    // Create general_order_participants table
    console.log('\n👥 Creating general_order_participants table...')
    await supabaseAdmin.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS general_order_participants (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          general_order_id UUID NOT NULL,
          user_id UUID NOT NULL,
          product_id UUID NOT NULL,
          quantity INTEGER NOT NULL CHECK (quantity > 0),
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Add foreign key constraints
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'general_order_participants_order_fkey') THEN
            ALTER TABLE general_order_participants ADD CONSTRAINT general_order_participants_order_fkey 
            FOREIGN KEY (general_order_id) REFERENCES general_orders(id) ON DELETE CASCADE;
          END IF;
          
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
            IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'general_order_participants_user_fkey') THEN
              ALTER TABLE general_order_participants ADD CONSTRAINT general_order_participants_user_fkey 
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
            END IF;
          END IF;
          
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
            IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'general_order_participants_product_fkey') THEN
              ALTER TABLE general_order_participants ADD CONSTRAINT general_order_participants_product_fkey 
              FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
            END IF;
          END IF;
        END
        $$;
        
        -- Add unique constraint
        CREATE UNIQUE INDEX IF NOT EXISTS idx_general_order_participants_unique 
        ON general_order_participants(general_order_id, user_id, product_id);
      `
    })
    
    // Create password_reset_tokens table
    console.log('\n🔑 Creating password_reset_tokens table...')
    await supabaseAdmin.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID NOT NULL,
          token VARCHAR(255) NOT NULL UNIQUE,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          used BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Add foreign key constraint
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
            IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'password_reset_tokens_user_fkey') THEN
              ALTER TABLE password_reset_tokens ADD CONSTRAINT password_reset_tokens_user_fkey 
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
            END IF;
          END IF;
        END
        $$;
        
        -- Add indexes
        CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
        CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);
      `
    })
    
    // Add indexes for better performance
    console.log('\n📈 Adding performance indexes...')
    await supabaseAdmin.rpc('exec_sql', {
      sql: `
        -- Users table indexes
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
        CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
        
        -- Products table indexes
        CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
        CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
        CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
        
        -- Orders table indexes
        CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
        CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
        
        -- General orders indexes
        CREATE INDEX IF NOT EXISTS idx_general_orders_status ON general_orders(status);
        CREATE INDEX IF NOT EXISTS idx_general_orders_deadline ON general_orders(deadline);
        CREATE INDEX IF NOT EXISTS idx_general_orders_created_by ON general_orders(created_by);
        
        -- General order participants indexes
        CREATE INDEX IF NOT EXISTS idx_general_order_participants_order_id ON general_order_participants(general_order_id);
        CREATE INDEX IF NOT EXISTS idx_general_order_participants_user_id ON general_order_participants(user_id);
        
        -- Email logs indexes
        CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
        CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at);
        CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email);
      `
    })
    
    // Add triggers for updated_at columns
    console.log('\n⚡ Adding update triggers...')
    await supabaseAdmin.rpc('exec_sql', {
      sql: `
        -- Create or replace function for updating updated_at
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql';
        
        -- Add triggers for tables that have updated_at column
        DROP TRIGGER IF EXISTS update_users_updated_at ON users;
        CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        
        DROP TRIGGER IF EXISTS update_products_updated_at ON products;
        CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        
        DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
        CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        
        DROP TRIGGER IF EXISTS update_general_orders_updated_at ON general_orders;
        CREATE TRIGGER update_general_orders_updated_at BEFORE UPDATE ON general_orders 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        
        DROP TRIGGER IF EXISTS update_system_settings_updated_at ON system_settings;
        CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      `
    })
    
    console.log('\n✅ All missing tables and schema updates completed!')
    
  } catch (error) {
    console.error('❌ Error updating database schema:', error.message)
  }
}

async function addSampleData() {
  console.log('\n🌱 Adding sample data...')
  console.log('=' .repeat(60))
  
  try {
    // Add sample products
    console.log('\n🛍️ Adding sample products...')
    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .upsert([
        {
          name: 'Pod מתקדם Pro',
          description: 'Pod חדיש ואיכותי למתחילים ומתקדמים עם טכנולוגיית מתקדמת',
          price: 150.00,
          category: 'Pods',
          stock_quantity: 25,
          is_active: true
        },
        {
          name: 'נוזל טעם וניל פרמיום',
          description: 'נוזל איכותי בטעם וניל עדין ומתוק',
          price: 35.00,
          category: 'נוזלים',
          stock_quantity: 50,
          is_active: true
        },
        {
          name: 'נוזל טעם מנטול קריר',
          description: 'נוזל מנטול קריר ומרענן לחוויה מושלמת',
          price: 35.00,
          category: 'נוזלים',
          stock_quantity: 45,
          is_active: true
        },
        {
          name: 'סוללה חזקה 3000mAh',
          description: 'סוללה איכותית עם חיי שימוש ארוכים וטעינה מהירה',
          price: 120.00,
          category: 'אביזרים',
          stock_quantity: 20,
          is_active: true
        },
        {
          name: 'מטען מהיר USB-C',
          description: 'מטען מהיר ובטוח לכל סוגי הפודים עם הגנות מתקדמות',
          price: 45.00,
          category: 'אביזרים',
          stock_quantity: 30,
          is_active: true
        },
        {
          name: 'Kit מתחילים',
          description: 'קיט שלם למתחילים כולל Pod, נוזל וכל הנדרש',
          price: 200.00,
          category: 'קיטים',
          stock_quantity: 15,
          is_active: true
        }
      ], { 
        onConflict: 'name',
        ignoreDuplicates: false 
      })
    
    if (productsError) {
      console.log('⚠️  Products insert warning:', productsError.message)
    } else {
      console.log(`✅ Added ${products?.length || 0} products`)
    }
    
    // Add additional system settings
    console.log('\n⚙️ Adding additional system settings...')
    const { error: settingsError } = await supabaseAdmin
      .from('system_settings')
      .upsert([
        {
          setting_key: 'currency',
          setting_value: 'ILS'
        },
        {
          setting_key: 'tax_rate',
          setting_value: '17'
        },
        {
          setting_key: 'min_order_amount',
          setting_value: '100'
        },
        {
          setting_key: 'email_notifications',
          setting_value: 'true'
        },
        {
          setting_key: 'registration_enabled',
          setting_value: 'true'
        },
        {
          setting_key: 'general_orders_enabled',
          setting_value: 'true'
        },
        {
          setting_key: 'maintenance_mode',
          setting_value: 'false'
        }
      ], { 
        onConflict: 'setting_key',
        ignoreDuplicates: true 
      })
    
    if (settingsError) {
      console.log('⚠️  Settings insert warning:', settingsError.message)
    } else {
      console.log('✅ Added additional system settings')
    }
    
    // Create a sample group order
    console.log('\n👥 Creating sample group order...')
    const { data: adminUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
      .single()
    
    if (adminUser) {
      const { error: groupOrderError } = await supabaseAdmin
        .from('general_orders')
        .upsert([
          {
            title: 'הזמנה קבוצתית - נוזלים במחיר מיוחד',
            description: 'הזמנה קבוצתית לנוזלים איכותיים במחיר מוזל. הצטרפו עד יום ראשון!',
            deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
            status: 'open',
            created_by: adminUser.id
          }
        ], { 
          onConflict: 'title',
          ignoreDuplicates: true 
        })
      
      if (groupOrderError) {
        console.log('⚠️  Group order insert warning:', groupOrderError.message)
      } else {
        console.log('✅ Created sample group order')
      }
    }
    
    console.log('\n✅ Sample data added successfully!')
    
  } catch (error) {
    console.error('❌ Error adding sample data:', error.message)
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting Database Schema Update')
  console.log('Time:', new Date().toLocaleString())
  
  await addMissingTables()
  await addSampleData()
  
  console.log('\n🎉 Database setup complete!')
  console.log('=' .repeat(60))
}

main().catch(console.error)