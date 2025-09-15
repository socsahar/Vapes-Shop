import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Only throw error at runtime, not during build
const checkEnvVars = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }
}

// Configure fetch with SSL bypass for server environments
const createFetchWithSSLBypass = () => {
  // Only bypass SSL in server environment (Node.js) and only during development
  if (typeof window === 'undefined' && typeof process !== 'undefined') {
    // Only set in development, never in production
    if (process.env.NODE_ENV === 'development' && !process.env.RAILWAY_ENVIRONMENT) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
    
    return (url, options = {}) => {
      return fetch(url, {
        ...options,
        // Additional fetch options for Node.js
        agent: false
      });
    };
  }
  return fetch;
};

// Client for browser/client-side operations
export const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    fetch: typeof window !== 'undefined' ? fetch : createFetchWithSSLBypass()
  }
}) : null

// Admin client for server-side operations (uses service role key)
export const supabaseAdmin = supabaseUrl ? createClient(
  supabaseUrl, 
  supabaseServiceKey || supabaseAnonKey || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      fetch: typeof window !== 'undefined' ? fetch : createFetchWithSSLBypass()
    }
  }
) : null

// Helper function to get current user from localStorage (client-side)
export const getCurrentUser = () => {
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (error) {
        console.error('Error parsing user from localStorage:', error);
        localStorage.removeItem('user');
      }
    }
  }
  return null;
}

// Helper function to get current user from request headers (server-side)
export const getCurrentUserFromRequest = async (request) => {
  try {
    // Try to get user ID from custom header
    const userId = request.headers.get('x-user-id');
    const userToken = request.headers.get('x-user-token');
    
    if (!userId || !userToken) {
      return null;
    }

    // Validate user exists and token matches
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .eq('status', 'active')
      .single();

    if (error || !user) {
      return null;
    }

    // Simple token validation - in production, use JWT
    const expectedToken = Buffer.from(user.id + user.username).toString('base64');
    
    if (userToken !== expectedToken) {
      return null;
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  } catch (error) {
    console.error('Error getting user from request:', error);
    return null;
  }
}

// Helper function to get authentication headers for API requests
export const getAuthHeaders = () => {
  const user = getCurrentUser();
  if (!user) {
    return {};
  }
  
  // Simple token generation - in production, use JWT
  const token = Buffer.from(user.id + user.username).toString('base64');
  
  return {
    'x-user-id': user.id,
    'x-user-token': token
  };
}

// Helper function to make authenticated API requests
export const makeAuthenticatedRequest = async (url, options = {}) => {
  const authHeaders = getAuthHeaders();
  
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options.headers
    }
  });
}

// Helper function to check if user is admin
export const isUserAdmin = () => {
  const user = getCurrentUser();
  return user?.role === 'admin';
}

// Authentication helpers using API routes
export const signInWithPassword = async (username, password) => {
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        const data = await response.json();

        if (!response.ok) {
            return { data: null, error: { message: data.error } };
        }

        // Store user in localStorage for session management
        if (typeof window !== 'undefined') {
            localStorage.setItem('user', JSON.stringify(data.user));
        }

        return { data, error: null };
    } catch (error) {
        return { data: null, error: { message: 'שגיאה בהתחברות' } };
    }
};

export const signUpWithPassword = async ({ username, email, password, full_name, phone }) => {
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, email, password, full_name, phone }),
        });

        const data = await response.json();

        if (!response.ok) {
            return { data: null, error: { message: data.error } };
        }

        return { data, error: null };
    } catch (error) {
        return { data: null, error: { message: 'שגיאה ברישום' } };
    }
};

export const signOut = async () => {
    try {
        const response = await fetch('/api/auth/logout', {
            method: 'POST',
        });

        if (typeof window !== 'undefined') {
            localStorage.removeItem('user');
        }

        return { error: null };
    } catch (error) {
        return { error: { message: 'שגיאה בהתנתקות' } };
    }
};

// Helper function to get system settings
export const getSystemSettings = async () => {
  const { data, error } = await supabase
    .from('system_settings')
    .select('*')
  
  if (error) {
    console.error('Error fetching system settings:', error)
    return {}
  }
  
  // Convert to key-value object
  const settings = {}
  data.forEach(setting => {
    settings[setting.setting_key] = setting.setting_value
  })
  
  return settings
}

// Helper function to update system setting
export const updateSystemSetting = async (key, value) => {
  const { error } = await supabase
    .from('system_settings')
    .upsert({
      setting_key: key,
      setting_value: value,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'setting_key'
    })
  
  if (error) {
    console.error('Error updating system setting:', error)
    return false
  }
  
  return true
}

export default supabase