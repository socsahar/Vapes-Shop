/**
 * Persistent Authentication Storage for Median App
 * 
 * This module provides persistent authentication across app restarts.
 * Uses multiple storage strategies with fallbacks:
 * 1. Cookie-based storage (most persistent)
 * 2. localStorage (fallback)
 * 3. sessionStorage (last resort)
 */

// Cookie helpers
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
 */
export const storeUserSession = (user) => {
    if (typeof window === 'undefined') return;

    const userStr = JSON.stringify(user);
    
    try {
        // 1. Store in cookie (most persistent - survives app restarts)
        setCookie('vape_shop_user', userStr, 365);
        
        // 2. Store in localStorage (backup)
        localStorage.setItem('user', userStr);
        localStorage.setItem('vape_shop_auth', 'true');
        localStorage.setItem('vape_shop_user_id', user.id);
        
        // 3. Store auth timestamp
        localStorage.setItem('vape_shop_auth_time', Date.now().toString());
        
        console.log('✅ User session stored successfully');
    } catch (error) {
        console.error('Error storing user session:', error);
    }
};

/**
 * Retrieve user session from storage
 */
export const getUserSession = () => {
    if (typeof window === 'undefined') return null;

    try {
        // 1. Try cookie first (most reliable)
        const cookieUser = getCookie('vape_shop_user');
        if (cookieUser) {
            const user = JSON.parse(cookieUser);
            // Also sync to localStorage
            localStorage.setItem('user', cookieUser);
            console.log('✅ User session restored from cookie');
            return user;
        }

        // 2. Fallback to localStorage
        const localUser = localStorage.getItem('user');
        if (localUser) {
            const user = JSON.parse(localUser);
            // Sync to cookie for future
            setCookie('vape_shop_user', localUser, 365);
            console.log('✅ User session restored from localStorage');
            return user;
        }

        console.log('❌ No user session found');
        return null;
    } catch (error) {
        console.error('Error retrieving user session:', error);
        return null;
    }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = () => {
    if (typeof window === 'undefined') return false;
    
    // Check multiple sources
    const hasCookie = !!getCookie('vape_shop_user');
    const hasLocalStorage = !!localStorage.getItem('user');
    const hasAuthFlag = localStorage.getItem('vape_shop_auth') === 'true';
    
    return hasCookie || (hasLocalStorage && hasAuthFlag);
};

/**
 * Clear user session completely
 */
export const clearUserSession = () => {
    if (typeof window === 'undefined') return;

    try {
        // Clear cookie
        deleteCookie('vape_shop_user');
        
        // Clear localStorage
        localStorage.removeItem('user');
        localStorage.removeItem('vape_shop_auth');
        localStorage.removeItem('vape_shop_user_id');
        localStorage.removeItem('vape_shop_auth_time');
        
        // Clear sessionStorage
        sessionStorage.clear();
        
        console.log('✅ User session cleared successfully');
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
    isAuthenticated,
    clearUserSession,
    isSessionExpired,
    refreshSession
};
