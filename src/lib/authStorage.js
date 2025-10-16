/**
 * Persistent Authentication Storage for Median App
 * 
 * This module provides persistent authentication across app restarts.
 * Uses multiple storage strategies with Median native storage support:
 * 1. Median native storage (most persistent - survives app restarts)
 * 2. localStorage (fallback for web)
 * 3. Cookie-based storage (web fallback)
 */

// Check if running in Median app
const isMedianApp = () => {
    if (typeof window === 'undefined') return false;
    
    const hasMedian = window.median !== undefined;
    const hasGoNative = window.gonative !== undefined;
    const hasMedianUA = navigator.userAgent.includes('gonative') || navigator.userAgent.includes('median');
    
    console.log('🔍 Median Detection:', {
        hasMedian,
        hasGoNative,
        hasMedianUA,
        hasNativeDatastore: hasMedian && window.median.nativeDatastore !== undefined,
        hasNativeStorage: hasMedian && window.median.nativeStorage !== undefined,
        userAgent: navigator.userAgent
    });
    
    return hasMedian || hasGoNative || hasMedianUA;
};

// Median native datastore helpers
const medianSetItem = (key, value) => {
    if (typeof window === 'undefined') return false;
    
    try {
        // Try nativeDatastore first (new API name)
        if (window.median && window.median.nativeDatastore && window.median.nativeDatastore.setItem) {
            window.median.nativeDatastore.setItem(key, value);
            console.log('✅ Stored in Median native datastore:', key);
            return true;
        } else if (window.gonative && window.gonative.nativeDatastore && window.gonative.nativeDatastore.setItem) {
            window.gonative.nativeDatastore.setItem(key, value);
            console.log('✅ Stored in GoNative datastore:', key);
            return true;
        }
        // Fallback to old nativeStorage API
        else if (window.median && window.median.nativeStorage && window.median.nativeStorage.set) {
            window.median.nativeStorage.set({
                key: key,
                value: value
            });
            console.log('✅ Stored in Median native storage (legacy):', key);
            return true;
        } else if (window.gonative && window.gonative.nativeStorage && window.gonative.nativeStorage.set) {
            window.gonative.nativeStorage.set({
                key: key,
                value: value
            });
            console.log('✅ Stored in GoNative storage (legacy):', key);
            return true;
        }
    } catch (error) {
        console.error('Error storing in Median native datastore:', error);
    }
    return false;
};

const medianGetItem = async (key) => {
    if (typeof window === 'undefined') return null;
    
    try {
        // Try nativeDatastore first (new API - synchronous)
        if (window.median && window.median.nativeDatastore && window.median.nativeDatastore.getItem) {
            const value = window.median.nativeDatastore.getItem(key);
            console.log('✅ Retrieved from Median native datastore:', key, value ? 'found' : 'not found');
            return value;
        } else if (window.gonative && window.gonative.nativeDatastore && window.gonative.nativeDatastore.getItem) {
            const value = window.gonative.nativeDatastore.getItem(key);
            console.log('✅ Retrieved from GoNative datastore:', key, value ? 'found' : 'not found');
            return value;
        }
        // Fallback to old nativeStorage API (async)
        else if (window.median && window.median.nativeStorage && window.median.nativeStorage.get) {
            return new Promise((resolve, reject) => {
                // Add timeout to prevent hanging
                const timeout = setTimeout(() => {
                    console.warn('Median native storage timeout');
                    resolve(null);
                }, 1000);
                
                window.median.nativeStorage.get({
                    key: key,
                    callback: (value) => {
                        clearTimeout(timeout);
                        console.log('✅ Retrieved from Median native storage (legacy):', key);
                        resolve(value);
                    }
                });
            });
        } else if (window.gonative && window.gonative.nativeStorage && window.gonative.nativeStorage.get) {
            return new Promise((resolve, reject) => {
                // Add timeout to prevent hanging
                const timeout = setTimeout(() => {
                    console.warn('GoNative storage timeout');
                    resolve(null);
                }, 1000);
                
                window.gonative.nativeStorage.get({
                    key: key,
                    callback: (value) => {
                        clearTimeout(timeout);
                        console.log('✅ Retrieved from GoNative storage (legacy):', key);
                        resolve(value);
                    }
                });
            });
        }
    } catch (error) {
        console.error('Error retrieving from Median native datastore:', error);
    }
    return null;
};

const medianDeleteItem = (key) => {
    if (typeof window === 'undefined') return false;
    
    try {
        // Try nativeDatastore first (new API)
        if (window.median && window.median.nativeDatastore && window.median.nativeDatastore.removeItem) {
            window.median.nativeDatastore.removeItem(key);
            console.log('✅ Removed from Median native datastore:', key);
            return true;
        } else if (window.gonative && window.gonative.nativeDatastore && window.gonative.nativeDatastore.removeItem) {
            window.gonative.nativeDatastore.removeItem(key);
            console.log('✅ Removed from GoNative datastore:', key);
            return true;
        }
        // Fallback to old nativeStorage API
        else if (window.median && window.median.nativeStorage && window.median.nativeStorage.remove) {
            window.median.nativeStorage.remove({ key: key });
            console.log('✅ Removed from Median native storage (legacy):', key);
            return true;
        } else if (window.gonative && window.gonative.nativeStorage && window.gonative.nativeStorage.remove) {
            window.gonative.nativeStorage.remove({ key: key });
            console.log('✅ Removed from GoNative storage:', key);
            return true;
        }
    } catch (error) {
        console.error('Error removing from Median native storage:', error);
    }
    return false;
};

// Cookie helpers (fallback for web)
const setCookie = (name, value, days = 365) => {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
};

const getCookie = (name) => {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) {
            return decodeURIComponent(c.substring(nameEQ.length, c.length));
        }
    }
    return null;
};

const deleteCookie = (name) => {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
};

/**
 * Store user session with maximum persistence
 * Uses Median native storage for mobile app, falls back to localStorage/cookies for web
 */
export const storeUserSession = (user) => {
    if (typeof window === 'undefined') return;

    const userStr = JSON.stringify(user);
    
    try {
        // 1. If in Median app, use native storage (MOST PERSISTENT)
        if (isMedianApp()) {
            medianSetItem('vape_shop_user', userStr);
            medianSetItem('vape_shop_auth', 'true');
            medianSetItem('vape_shop_user_id', user.id);
            medianSetItem('vape_shop_auth_time', Date.now().toString());
            console.log('✅ User session stored in Median native storage');
        }
        
        // 2. Store in cookie (web fallback)
        setCookie('vape_shop_user', userStr, 365);
        
        // 3. Store in localStorage (backup)
        localStorage.setItem('user', userStr);
        localStorage.setItem('vape_shop_auth', 'true');
        localStorage.setItem('vape_shop_user_id', user.id);
        localStorage.setItem('vape_shop_auth_time', Date.now().toString());
        
        console.log('✅ User session stored successfully (all methods)');
    } catch (error) {
        console.error('Error storing user session:', error);
    }
};

/**
 * Synchronous version - for immediate access (web only)
 */
export const getUserSessionSync = () => {
    if (typeof window === 'undefined') return null;

    try {
        // 1. Try localStorage first (fastest)
        const localUser = localStorage.getItem('user');
        if (localUser) {
            return JSON.parse(localUser);
        }

        // 2. Try cookie
        const cookieUser = getCookie('vape_shop_user');
        if (cookieUser) {
            const user = JSON.parse(cookieUser);
            localStorage.setItem('user', cookieUser);
            return user;
        }

        return null;
    } catch (error) {
        console.error('Error retrieving user session (sync):', error);
        return null;
    }
};

/**
 * Retrieve user session from storage
 * SIMPLE VERSION - Just use localStorage/cookies, skip Median for now
 */
export const getUserSession = async () => {
    if (typeof window === 'undefined') return null;

    try {
        // 1. Try localStorage first (fastest and most reliable)
        const localUser = localStorage.getItem('user');
        if (localUser) {
            const user = JSON.parse(localUser);
            console.log('✅ User session restored from localStorage');
            return user;
        }

        // 2. Try cookie as fallback
        const cookieUser = getCookie('vape_shop_user');
        if (cookieUser) {
            const user = JSON.parse(cookieUser);
            localStorage.setItem('user', cookieUser);
            console.log('✅ User session restored from cookie');
            return user;
        }

        console.log('❌ No user session found');
        return null;
    } catch (error) {
        console.error('Error retrieving user session:', error);
        return null;
    }
}

/**
 * Check if user is authenticated
 * Note: This is synchronous, so it checks localStorage/cookie only
 * For Median apps, use getUserSession() which is async and checks native storage
 */
export const isAuthenticated = () => {
    if (typeof window === 'undefined') return false;
    
    // Check multiple sources (synchronous only)
    const hasCookie = !!getCookie('vape_shop_user');
    const hasLocalStorage = !!localStorage.getItem('user');
    const hasAuthFlag = localStorage.getItem('vape_shop_auth') === 'true';
    
    return hasCookie || (hasLocalStorage && hasAuthFlag);
};

/**
 * Clear user session completely from all storage locations
 */
export const clearUserSession = () => {
    if (typeof window === 'undefined') return;

    try {
        // 1. Clear Median native storage if available
        if (isMedianApp()) {
            medianDeleteItem('vape_shop_user');
            medianDeleteItem('vape_shop_auth');
            medianDeleteItem('vape_shop_user_id');
            medianDeleteItem('vape_shop_auth_time');
            console.log('✅ Cleared Median native storage');
        }
        
        // 2. Clear cookie
        deleteCookie('vape_shop_user');
        
        // 3. Clear localStorage
        localStorage.removeItem('user');
        localStorage.removeItem('vape_shop_auth');
        localStorage.removeItem('vape_shop_user_id');
        localStorage.removeItem('vape_shop_auth_time');
        
        // 4. Clear sessionStorage
        sessionStorage.clear();
        
        console.log('✅ User session cleared successfully from all locations');
    } catch (error) {
        console.error('Error clearing user session:', error);
    }
};

/**
 * Check if session is expired (optional - for security)
 */
export const isSessionExpired = (maxAgeInDays = 365) => {
    if (typeof window === 'undefined') return true;

    try {
        const authTime = localStorage.getItem('vape_shop_auth_time');
        if (!authTime) return true;

        const ageInMs = Date.now() - parseInt(authTime);
        const ageInDays = ageInMs / (1000 * 60 * 60 * 24);
        
        return ageInDays > maxAgeInDays;
    } catch (error) {
        return true;
    }
};

/**
 * Refresh session timestamp (call periodically)
 */
export const refreshSession = () => {
    if (typeof window === 'undefined') return;
    
    const user = getUserSession();
    if (user) {
        storeUserSession(user);
    }
};

// Auto-refresh session on visibility change (user opens app)
if (typeof window !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            refreshSession();
        }
    });
}

export default {
    storeUserSession,
    getUserSession,
    getUserSessionSync,
    isAuthenticated,
    clearUserSession,
    isSessionExpired,
    refreshSession
};
