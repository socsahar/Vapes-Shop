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
    const hasAppStorage = hasMedian && window.median.storage && window.median.storage.app;
    
    console.log('🔍 Median Detection:', {
        hasMedian,
        hasGoNative,
        hasMedianUA,
        hasAppStorage,
        hasCloudStorage: hasMedian && window.median.storage && window.median.storage.cloud,
        userAgent: navigator.userAgent
    });
    
    return hasMedian || hasGoNative || hasMedianUA;
};

// Median native datastore helpers (using official API)
const medianSetItem = (key, value) => {
    if (typeof window === 'undefined') return false;
    
    try {
        // Use median.storage.app API (official Native Datastore plugin)
        if (window.median && window.median.storage && window.median.storage.app) {
            window.median.storage.app.set({
                key: key,
                value: value,
                statuscallback: (result) => {
                    if (result.status === 'success') {
                        console.log('✅ Stored in Median App Storage:', key);
                    } else {
                        console.error('❌ Median storage error:', result.status);
                    }
                }
            });
            return true;
        }
        // Fallback for GoNative (older branding)
        else if (window.gonative && window.gonative.storage && window.gonative.storage.app) {
            window.gonative.storage.app.set({
                key: key,
                value: value,
                statuscallback: (result) => {
                    if (result.status === 'success') {
                        console.log('✅ Stored in GoNative App Storage:', key);
                    }
                }
            });
            return true;
        }
    } catch (error) {
        console.error('Error storing in Median App Storage:', error);
    }
    return false;
};

const medianGetItem = async (key) => {
    if (typeof window === 'undefined') return null;
    
    try {
        // Use median.storage.app API with Promise support
        if (window.median && window.median.storage && window.median.storage.app && window.median.storage.app.get) {
            return new Promise((resolve) => {
                // Add timeout to prevent hanging
                const timeout = setTimeout(() => {
                    console.warn('⏱️ Median App Storage timeout for key:', key);
                    resolve(null);
                }, 2000);
                
                // Try Promise method first (preferred)
                window.median.storage.app.get({ key: key })
                    .then((result) => {
                        clearTimeout(timeout);
                        if (result.data) {
                            console.log('✅ Retrieved from Median App Storage:', key);
                            resolve(result.data);
                        } else if (result.status === 'preference-not-found') {
                            console.log('ℹ️ Key not found in Median App Storage:', key);
                            resolve(null);
                        } else {
                            console.log('ℹ️ No data in Median App Storage for:', key, result.status);
                            resolve(null);
                        }
                    })
                    .catch((error) => {
                        clearTimeout(timeout);
                        console.error('❌ Median App Storage get error:', error);
                        resolve(null);
                    });
            });
        }
        // Fallback for GoNative
        else if (window.gonative && window.gonative.storage && window.gonative.storage.app && window.gonative.storage.app.get) {
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    console.warn('⏱️ GoNative App Storage timeout for key:', key);
                    resolve(null);
                }, 2000);
                
                window.gonative.storage.app.get({ key: key })
                    .then((result) => {
                        clearTimeout(timeout);
                        if (result.data) {
                            console.log('✅ Retrieved from GoNative App Storage:', key);
                            resolve(result.data);
                        } else {
                            resolve(null);
                        }
                    })
                    .catch(() => {
                        clearTimeout(timeout);
                        resolve(null);
                    });
            });
        }
    } catch (error) {
        console.error('Error retrieving from Median App Storage:', error);
    }
    return null;
};

const medianDeleteItem = (key) => {
    if (typeof window === 'undefined') return false;
    
    try {
        // Use median.storage.app.delete API
        if (window.median && window.median.storage && window.median.storage.app && window.median.storage.app.delete) {
            window.median.storage.app.delete({
                key: key,
                statuscallback: (result) => {
                    if (result.status === 'success') {
                        console.log('✅ Deleted from Median App Storage:', key);
                    } else {
                        console.log('ℹ️ Median delete status:', result.status);
                    }
                }
            });
            return true;
        }
        // Fallback for GoNative
        else if (window.gonative && window.gonative.storage && window.gonative.storage.app && window.gonative.storage.app.delete) {
            window.gonative.storage.app.delete({
                key: key,
                statuscallback: (result) => {
                    if (result.status === 'success') {
                        console.log('✅ Deleted from GoNative App Storage:', key);
                    }
                }
            });
            return true;
        }
    } catch (error) {
        console.error('Error deleting from Median App Storage:', error);
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

    // CRITICAL: Validate user object before storing
    if (!user || !user.id) {
        console.error('❌ CANNOT STORE SESSION: Invalid user object', user);
        return;
    }

    const userStr = JSON.stringify(user);
    
    console.log('🔄 STORING USER SESSION - START');
    console.log('   User ID:', user.id);
    console.log('   Username:', user.username);
    console.log('   Role:', user.role);
    console.log('   Is Median App?', isMedianApp());
    
    try {
        // 1. ALWAYS store in localStorage first (immediate, guaranteed)
        localStorage.setItem('user', userStr);
        localStorage.setItem('vape_shop_auth', 'true');
        localStorage.setItem('vape_shop_user_id', user.id);
        localStorage.setItem('vape_shop_auth_time', Date.now().toString());
        console.log('✅ STORED in localStorage');
        
        // 2. ALWAYS store in cookie (immediate, guaranteed)
        setCookie('vape_shop_user', userStr, 365);
        console.log('✅ STORED in cookie');
        
        // 3. Try Median App Storage (if available)
        if (isMedianApp()) {
            const medianStored = medianSetItem('vape_shop_user', userStr);
            const authStored = medianSetItem('vape_shop_auth', 'true');
            const idStored = medianSetItem('vape_shop_user_id', user.id);
            const timeStored = medianSetItem('vape_shop_auth_time', Date.now().toString());
            
            if (medianStored && authStored && idStored && timeStored) {
                console.log('✅ STORED in Median App Storage');
            } else {
                console.warn('⚠️ PARTIAL Median storage (some items failed)');
            }
        } else {
            console.log('ℹ️ Not a Median app - skipping native storage');
        }
        
        console.log('✅✅✅ USER SESSION STORED SUCCESSFULLY ✅✅✅');
    } catch (error) {
        console.error('❌ Error storing user session:', error);
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
 * ULTRA-SAFE VERSION - Will NEVER hang or break, guaranteed!
 * Uses aggressive timeouts and multiple fallbacks
 */
export const getUserSession = async () => {
    if (typeof window === 'undefined') return null;

    console.log('🔍 RETRIEVING USER SESSION - START');
    console.log('   Is Median App?', isMedianApp());

    try {
        // 1. ALWAYS check localStorage first (instant, never fails)
        const localUser = localStorage.getItem('user');
        console.log('   localStorage:', localUser ? '✅ FOUND' : '❌ EMPTY');
        if (localUser) {
            try {
                const user = JSON.parse(localUser);
                
                // CRITICAL: Validate user has required fields
                if (!user || !user.id) {
                    console.error('❌ CORRUPTED DATA in localStorage - clearing');
                    console.log('   Bad data:', user);
                    localStorage.removeItem('user');
                    localStorage.removeItem('vape_shop_auth');
                    localStorage.removeItem('vape_shop_user_id');
                } else {
                    console.log('✅✅✅ USER SESSION FROM LOCALSTORAGE ✅✅✅');
                    console.log('   User ID:', user.id);
                    console.log('   Username:', user.username);
                    console.log('   Role:', user.role);
                    return user;
                }
            } catch (parseError) {
                console.warn('⚠️ localStorage parse error, clearing invalid data');
                localStorage.removeItem('user');
            }
        }

        // 2. ALWAYS check cookie second (instant, never fails)
        const cookieUser = getCookie('vape_shop_user');
        console.log('   Cookie:', cookieUser ? '✅ FOUND' : '❌ EMPTY');
        if (cookieUser) {
            try {
                const user = JSON.parse(cookieUser);
                
                // CRITICAL: Validate user has required fields
                if (!user || !user.id) {
                    console.error('❌ CORRUPTED DATA in cookie - clearing');
                    deleteCookie('vape_shop_user');
                } else {
                    localStorage.setItem('user', cookieUser);
                    console.log('✅✅✅ USER SESSION FROM COOKIE ✅✅✅');
                    console.log('   User ID:', user.id);
                    console.log('   Username:', user.username);
                    console.log('   Role:', user.role);
                    return user;
                }
            } catch (parseError) {
                console.warn('⚠️ Cookie parse error');
                deleteCookie('vape_shop_user');
            }
        }

        // 3. ONLY try Median if we have nothing else (with aggressive timeout)
        console.log('   Checking Median App Storage...');
        if (isMedianApp()) {
            try {
                // CRITICAL: Hard 1000ms timeout - if Median doesn't respond, give up
                const medianPromise = medianGetItem('vape_shop_user');
                const timeoutPromise = new Promise((resolve) => {
                    setTimeout(() => {
                        console.warn('⏱️ Median timeout (1000ms) - skipping');
                        resolve(null);
                    }, 1000);
                });
                
                const medianUser = await Promise.race([medianPromise, timeoutPromise]);
                console.log('   Median result:', medianUser ? '✅ FOUND' : '❌ EMPTY');
                
                if (medianUser) {
                    const user = JSON.parse(medianUser);
                    // Restore to localStorage and cookie for faster future access
                    localStorage.setItem('user', medianUser);
                    setCookie('vape_shop_user', medianUser, 365);
                    console.log('✅✅✅ USER SESSION FROM MEDIAN (RESTORED) ✅✅✅');
                    console.log('   User ID:', user.id);
                    console.log('   Also restored to localStorage & cookie');
                    return user;
                }
            } catch (medianError) {
                console.warn('⚠️ Median check failed:', medianError.message || medianError);
            }
        } else {
            console.log('   Not a Median app - skipping');
        }

        console.log('❌❌❌ NO USER SESSION FOUND ❌❌❌');
        return null;
        
    } catch (error) {
        console.error('❌ getUserSession error:', error);
        
        // ULTIMATE EMERGENCY: Just try cookie one more time
        try {
            const cookie = getCookie('vape_shop_user');
            if (cookie) {
                console.log('🚨 EMERGENCY: Cookie rescue');
                return JSON.parse(cookie);
            }
        } catch (e) {
            // Do nothing - just return null
        }
        
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
