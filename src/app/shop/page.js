'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '../../lib/supabase';

export default function ShopPage() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState([]);
    const [productsLoading, setProductsLoading] = useState(true);
    const [productsError, setProductsError] = useState(null);
    const [cart, setCart] = useState([]);
    const [showCart, setShowCart] = useState(false);
    const [productQuantities, setProductQuantities] = useState({}); // Track quantity for each product
    const [shopStatus, setShopStatus] = useState(null);
    const [currentGeneralOrder, setCurrentGeneralOrder] = useState(null);
    const [userParticipation, setUserParticipation] = useState(null);
    const [shopStatusLoading, setShopStatusLoading] = useState(true);
    const [hasPlacedOrder, setHasPlacedOrder] = useState(false);
    const [showOrdersModal, setShowOrdersModal] = useState(false);
    const [userOrders, setUserOrders] = useState([]);
    const [ordersLoading, setOrdersLoading] = useState(false);

    useEffect(() => {
        const loadUser = async () => {
            const currentUser = await getCurrentUser();
            // Allow browsing without login
            setUser(currentUser);
            setLoading(false);
            loadProducts();
            loadCart();
            loadShopStatus();
            if (currentUser) {
                checkUserParticipation(currentUser.id);
            }
        };
        loadUser();
    }, [router]);

    const loadProducts = async () => {
        try {
            setProductsError(null);
            const response = await fetch('/api/products');
            if (response.ok) {
                const data = await response.json();
                setProducts(data.products || []);
            } else {
                throw new Error('Failed to fetch products');
            }
        } catch (error) {
            console.error('Error loading products:', error);
            setProductsError('שגיאה בטעינת המוצרים. אנא נסה שוב.');
        } finally {
            setProductsLoading(false);
        }
    };

    const loadCart = () => {
        if (typeof window !== 'undefined') {
            const savedCart = localStorage.getItem('cart');
            if (savedCart) {
                try {
                    setCart(JSON.parse(savedCart));
                } catch (error) {
                    console.error('Error loading cart:', error);
                    setCart([]);
                }
            }
        }
    };

    const loadShopStatus = async () => {
        try {
            const response = await fetch('/api/shop/status');
            if (response.ok) {
                const status = await response.json();
                setShopStatus(status);
                setCurrentGeneralOrder(status.current_general_order);
            }
        } catch (error) {
            console.error('Error loading shop status:', error);
        } finally {
            setShopStatusLoading(false);
        }
    };

    const checkUserParticipation = async (userId) => {
        if (!userId) return;
        
        try {
            const response = await fetch(`/api/general-orders/participate?user_id=${userId}`);
            if (response.ok) {
                const data = await response.json();
                setUserParticipation(data);
                setHasPlacedOrder(data.hasOrder);
                if (data.hasOrder && data.participation) {
                    // Convert participation to cart format
                    const cartItems = data.participation.map(item => ({
                        id: item.product.id || item.product_id,
                        name: item.product.name,
                        price: item.product.price,
                        quantity: item.quantity
                    }));
                    setCart(cartItems);
                }
            }
        } catch (error) {
            console.error('Error checking user participation:', error);
        }
    };

    const loadUserOrders = async () => {
        if (!user || !user.id) {
            console.error('No user available for loading orders');
            alert('נדרשת התחברות כדי לצפות בהזמנות');
            router.push('/auth/login?redirect=/shop');
            setOrdersLoading(false);
            return;
        }
        
        setOrdersLoading(true);
        try {
            // Create authentication token - encode to base64 safely with unicode support
            // Convert string to base64 using encodeURIComponent to handle Hebrew characters
            const tokenString = user.id + user.username;
            const userToken = btoa(unescape(encodeURIComponent(tokenString)));
            
            console.log('Loading orders for user:', user.username, 'ID:', user.id);
            
            const response = await fetch('/api/orders', {
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': user.id,
                    'x-user-token': userToken
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('Orders loaded successfully:', data.total_orders, 'orders');
                setUserOrders(data.orders || []);
            } else {
                const errorData = await response.json();
                console.error('Failed to load orders:', response.status, errorData);
                showNotification(errorData.error || 'שגיאה בטעינת ההזמנות', 'error');
            }
        } catch (error) {
            console.error('Error loading orders:', error);
            showNotification('שגיאה בטעינת ההזמנות', 'error');
        } finally {
            setOrdersLoading(false);
        }
    };

    const handleShowOrders = () => {
        setShowOrdersModal(true);
        loadUserOrders();
    };

    const handleReorder = async (order) => {
        // Check if shop is open
        if (!shopStatus || !shopStatus.is_open || !currentGeneralOrder) {
            showNotification('לא ניתן להזמין כרגע - החנות סגורה', 'warning');
            return;
        }

        try {
            // Get current products to check availability
            const productsResponse = await fetch('/api/products');
            if (!productsResponse.ok) {
                showNotification('שגיאה בטעינת המוצרים', 'error');
                return;
            }
            
            const productsData = await productsResponse.json();
            const availableProducts = productsData.products || [];

            // Map order items to available products
            const availableItems = [];
            const missingItems = [];

            order.items.forEach(orderItem => {
                // Get product ID from nested product object
                const productId = orderItem.product?.id;
                if (!productId) {
                    missingItems.push(orderItem.product?.name || 'מוצר לא ידוע');
                    return;
                }
                
                const product = availableProducts.find(p => p.id === productId);
                if (product) {
                    availableItems.push({
                        id: product.id,
                        name: product.name,
                        price: product.price,
                        quantity: orderItem.quantity,
                        image_url: product.image_url
                    });
                } else {
                    missingItems.push(orderItem.product?.name || 'מוצר לא ידוע');
                }
            });

            // If there are missing items, ask user what to do
            if (missingItems.length > 0) {
                const missingList = missingItems.join('\n• ');
                const userChoice = confirm(
                    `⚠️ המוצרים הבאים אינם זמינים:\n\n• ${missingList}\n\n` +
                    `להזמין ללא המוצרים החסרים או לבצע הזמנה חדשה?\n\n` +
                    `✅ לחץ "אישור" להזמין ללא המוצרים החסרים\n` +
                    `❌ לחץ "ביטול" לבצע הזמנה חדשה ידנית`
                );

                if (!userChoice) {
                    // User chose to make a new order manually
                    setShowOrdersModal(false);
                    return;
                }

                // If no items are available at all
                if (availableItems.length === 0) {
                    showNotification('אף אחד מהמוצרים בהזמנה הקודמת לא זמין כרגע', 'error');
                    return;
                }
            }

            // Add items to cart
            saveCart(availableItems);
            
            // Close orders modal and open cart
            setShowOrdersModal(false);
            setShowCart(true);
            
            // Show success message
            const message = missingItems.length > 0 
                ? `${availableItems.length} מוצרים נוספו לעגלה. ${missingItems.length} מוצרים חסרים לא נוספו`
                : `${availableItems.length} מוצרים נוספו לעגלה בהצלחה! 🎉`;
            showNotification(message, missingItems.length > 0 ? 'warning' : 'success');

        } catch (error) {
            console.error('Error reordering:', error);
            showNotification('שגיאה בביצוע ההזמנה מחדש', 'error');
        }
    };

    const showNotification = (message, type = 'info') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 4000);
    };

    const saveCart = (cartItems) => {
        setCart(cartItems);
        if (typeof window !== 'undefined') {
            localStorage.setItem('cart', JSON.stringify(cartItems));
        }
    };

    const addToCart = (product, quantity = 1) => {
        // Check if user is logged in
        if (!user) {
            showNotification('נדרשת התחברות כדי להוסיף מוצרים לסל', 'warning');
            setTimeout(() => {
                router.push('/auth/login?redirect=/shop');
            }, 2000);
            return;
        }

        const existingItem = cart.find(item => item.id === product.id);
        if (existingItem) {
            const newCart = cart.map(item =>
                item.id === product.id 
                    ? { ...item, quantity: item.quantity + quantity }
                    : item
            );
            saveCart(newCart);
            showNotification(`${product.name} עודכן בסל 🛒`, 'success');
        } else {
            const newCart = [...cart, { ...product, quantity }];
            saveCart(newCart);
            showNotification(`${product.name} נוסף לסל 🛒`, 'success');
        }
        
        // Reset the product quantity after adding to cart
        setProductQuantities(prev => ({ ...prev, [product.id]: 1 }));
    };

    const updateProductQuantity = (productId, newQuantity) => {
        if (newQuantity < 1) newQuantity = 1;
        if (newQuantity > 99) newQuantity = 99; // Set a reasonable max
        setProductQuantities(prev => ({ ...prev, [productId]: newQuantity }));
    };

    const getProductQuantity = (productId) => {
        return productQuantities[productId] || 1;
    };

    const removeFromCart = (productId) => {
        const newCart = cart.filter(item => item.id !== productId);
        saveCart(newCart);
    };

    const updateCartQuantity = (productId, quantity) => {
        if (quantity <= 0) {
            removeFromCart(productId);
            return;
        }
        
        const newCart = cart.map(item => 
            item.id === productId 
                ? { ...item, quantity }
                : item
        );
        saveCart(newCart);
    };

    const getCartTotal = () => {
        return cart.reduce((total, item) => total + (item.price * item.quantity), 0).toFixed(2);
    };

    const placeGeneralOrder = async () => {
        // Check if user is logged in
        if (!user) {
            showNotification('נדרשת התחברות כדי להצטרף להזמנה קבוצתית', 'warning');
            // Save cart to localStorage before redirect
            if (typeof window !== 'undefined') {
                localStorage.setItem('cart', JSON.stringify(cart));
            }
            setTimeout(() => {
                router.push('/auth/login?redirect=/shop');
            }, 2000);
            return;
        }
        
        if (!currentGeneralOrder || cart.length === 0) {
            showNotification('לא ניתן לבצע הזמנה כרגע', 'error');
            return;
        }

        try {
            // Create authentication token - encode to base64 safely with unicode support
            const tokenString = user.id + user.username;
            const userToken = btoa(unescape(encodeURIComponent(tokenString)));

            const orderData = {
                general_order_id: currentGeneralOrder.id,
                items: cart.map(item => ({
                    product_id: item.id,
                    quantity: item.quantity
                }))
            };

            const response = await fetch('/api/general-orders/participate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': user.id,
                    'x-user-token': userToken
                },
                body: JSON.stringify(orderData)
            });

            if (response.ok) {
                const result = await response.json();
                showNotification('הזמנה נשלחה בהצלחה! 🎉', 'success');
                setHasPlacedOrder(true);
                setShowCart(false);
                // Refresh participation status
                checkUserParticipation(user.id);
            } else {
                const error = await response.json();
                showNotification(error.error || 'שגיאה בשליחת ההזמנה', 'error');
            }
        } catch (error) {
            console.error('Error placing general order:', error);
            showNotification('שגיאה בשליחת ההזמנה', 'error');
        }
    };

    const cancelOrder = async () => {
        if (!user || !currentGeneralOrder) {
            showNotification('לא ניתן לבטל הזמנה כרגע', 'error');
            return;
        }

        const confirmCancel = confirm('❌ האם אתה בטוח שברצונך לבטל את ההזמנה?\n\nהפעולה תמחק את כל הפריטים מההזמנה הנוכחית.');
        if (!confirmCancel) {
            return;
        }

        try {
            // Create authentication token
            const tokenString = user.id + user.username;
            const userToken = btoa(unescape(encodeURIComponent(tokenString)));

            const response = await fetch(`/api/general-orders/participate?general_order_id=${currentGeneralOrder.id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': user.id,
                    'x-user-token': userToken
                }
            });

            if (response.ok) {
                showNotification('ההזמנה בוטלה בהצלחה! ✅', 'success');
                setHasPlacedOrder(false);
                setCart([]);
                setShowCart(false);
                // Refresh participation status
                checkUserParticipation(user.id);
            } else {
                const error = await response.json();
                showNotification(error.error || 'שגיאה בביטול ההזמנה', 'error');
            }
        } catch (error) {
            console.error('Error canceling order:', error);
            showNotification('שגיאה בביטול ההזמנה', 'error');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('currentUser');
        // Stay on shop page after logout to allow browsing
        setUser(null);
        setCart([]);
        setHasPlacedOrder(false);
        setUserParticipation(null);
        showNotification('התנתקת בהצלחה 👋', 'success');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-dark flex items-center justify-center">
                <div className="text-xl text-gray-300">טוען...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 relative overflow-hidden">
            {/* Custom Toast Notification */}
            {toast.show && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-slide-down">
                    <div className={`px-6 py-4 rounded-lg shadow-2xl backdrop-blur-md border-2 ${
                        toast.type === 'success' ? 'bg-green-500/90 border-green-300' :
                        toast.type === 'error' ? 'bg-red-500/90 border-red-300' :
                        toast.type === 'warning' ? 'bg-yellow-500/90 border-yellow-300' :
                        'bg-blue-500/90 border-blue-300'
                    }`}>
                        <p className="text-white font-semibold text-lg text-center">{toast.message}</p>
                    </div>
                </div>
            )}

            {/* Animated Background Elements */}
            <div className="absolute inset-0">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
                <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-500"></div>
            </div>
            
            {/* Floating particles */}
            <div className="absolute inset-0 overflow-hidden">
                {Array.from({ length: 20 }).map((_, i) => (
                    <div 
                        key={i} 
                        className="absolute w-2 h-2 bg-blue-400/30 rounded-full animate-float"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            animationDelay: `${Math.random() * 5}s`,
                            animationDuration: `${3 + Math.random() * 4}s`
                        }}
                    ></div>
                ))}
            </div>

            {/* Header */}
            <header className="relative z-10 backdrop-blur-md bg-white/10 border-b border-white/20 shadow-lg">
                <div className="container mx-auto px-4 py-3">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        <div className="flex items-center space-x-4 space-x-reverse">
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                                הוייפ שופ
                            </h1>
                            {user && (
                                <>
                                    <span className="text-gray-400 hidden sm:inline">|</span>
                                    <span className="text-gray-200 text-sm sm:text-base">שלום {user.full_name}</span>
                                </>
                            )}
                        </div>
                        
                        <nav className="flex items-center gap-2 flex-wrap justify-center sm:justify-end w-full sm:w-auto">
                            {user ? (
                                <>
                                    <button 
                                        onClick={handleShowOrders}
                                        className="btn btn-secondary text-xs sm:text-sm px-3 py-2"
                                    >
                                        📋 <span className="hidden sm:inline">ההזמנות שלי</span>
                                    </button>
                                    {user.role === 'admin' && (
                                        <Link 
                                            href="/admin" 
                                            className="btn btn-primary text-xs sm:text-sm px-3 py-2"
                                        >
                                            ⚙️ <span className="hidden sm:inline">ניהול</span>
                                        </Link>
                                    )}
                                    <button
                                        onClick={() => setShowCart(true)}
                                        className="btn btn-primary relative text-xs sm:text-sm px-3 py-2"
                                    >
                                        🛒
                                        {cart.length > 0 && (
                                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold animate-bounce">
                                                {cart.reduce((sum, item) => sum + item.quantity, 0)}
                                            </span>
                                        )}
                                    </button>
                                    <button 
                                        onClick={handleLogout}
                                        type="button"
                                        className="btn btn-outline text-xs sm:text-sm px-3 py-2"
                                    >
                                        🚪 <span className="hidden sm:inline">יציאה</span>
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Link 
                                        href="/auth/login?redirect=/shop"
                                        className="btn btn-primary text-xs sm:text-sm px-3 sm:px-4 py-2 flex-1 sm:flex-initial text-center"
                                    >
                                        🔑 התחברות
                                    </Link>
                                    <Link 
                                        href="/auth/register?redirect=/shop"
                                        className="btn btn-secondary text-xs sm:text-sm px-3 sm:px-4 py-2 flex-1 sm:flex-initial text-center"
                                    >
                                        📝 הרשמה
                                    </Link>
                                </>
                            )}
                        </nav>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="relative z-10 container mx-auto px-4 py-6">
                {/* Shop Header */}
                <div className="mb-6">
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent text-center">
                        קטלוג המוצרים
                    </h2>
                </div>

                {/* Shop Status */}
                <div>
                {shopStatusLoading ? (
                    <div className="text-center py-6">
                        <div className="backdrop-blur-md bg-white/10 rounded-xl p-6 border border-white/20 shadow-xl">
                            <div className="animate-spin h-8 w-8 border-4 border-blue-400 border-t-transparent rounded-full mx-auto"></div>
                            <p className="text-white mt-4">בודק סטטוס החנות...</p>
                        </div>
                    </div>
                ) : shopStatus && !shopStatus.is_open ? (
                    <div className="mb-2">
                        <div className="bg-red-50 border border-red-200 rounded px-2 py-2 text-center">
                            <div className="text-lg font-medium text-red-600">🔒 החנות סגורה</div>
                            <div className="text-sm text-red-500">החנות תפתח בעת פתיחת הזמנה קבוצתית</div>
                        </div>
                    </div>
                ) : currentGeneralOrder ? (
                    <div className="mb-6">
                        {/* Compact General Order Banner */}
                        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-purple-600/20 via-blue-600/20 to-green-600/20 backdrop-blur-md border border-purple-400/30 shadow-lg">
                            {/* Subtle animated border */}
                            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-400/20 via-blue-400/20 to-green-400/20 animate-pulse"></div>
                            
                            {/* Main content - more compact */}
                            <div className="relative p-4">
                                {/* Header - smaller and inline */}
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center space-x-3">
                                        <span className="text-2xl animate-pulse">🎯</span>
                                        <div>
                                            <h3 className="text-lg font-bold text-yellow-300">{currentGeneralOrder.title}</h3>
                                            <p className="text-gray-300 text-sm">{currentGeneralOrder.description}</p>
                                        </div>
                                    </div>
                                    
                                    {/* User status - compact */}
                                    {hasPlacedOrder && (
                                        <div className="bg-green-500/30 rounded-lg px-3 py-1 border border-green-400/50">
                                            <span className="text-green-300 font-medium text-sm flex items-center">
                                                <span className="mr-1">✅</span>
                                                השתתפת
                                            </span>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Countdown timer - compact */}
                                <div className="bg-red-500/20 rounded-lg p-3 border border-red-500/30">
                                    <div className="flex items-center justify-center space-x-2">
                                        <span className="text-lg">⏰</span>
                                        <div className="text-center">
                                            <span className="text-red-300 font-medium text-sm">סגירה: </span>
                                            <span className="text-red-100 font-mono text-sm">
                                                {new Date(currentGeneralOrder.deadline).toLocaleString('he-IL', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}

                {/* Products Grid */}
                {productsLoading ? (
                    <div className="text-center py-12">
                        <div className="inline-flex items-center px-4 py-2 font-semibold leading-6 text-sm shadow rounded-md text-white bg-gradient-to-r from-blue-500 to-purple-500 transition ease-in-out duration-150">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            טוען מוצרים...
                        </div>
                    </div>
                ) : productsError ? (
                    <div className="text-center py-12">
                        <div className="backdrop-blur-md bg-red-500/10 rounded-xl p-8 border border-red-500/30 shadow-xl">
                            <div className="mx-auto w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-red-300 mb-2">שגיאה בטעינת המוצרים</h3>
                            <p className="text-red-200 mb-4">{productsError}</p>
                            <button 
                                onClick={loadProducts}
                                className="btn btn-primary"
                            >
                                נסה שוב
                            </button>
                        </div>
                    </div>
                ) : products.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="backdrop-blur-md bg-white/90 rounded-xl p-8 border border-gray-200 shadow-xl">
                            <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4m16 0l-2-2m2 2l-2 2M4 13l2-2m-2 2l2 2" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">אין מוצרים להצגה</h3>
                            <p className="text-gray-600">
                                אין מוצרים להצגה כרגע
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {products.map((product) => (
                            <div key={product.id} className="group backdrop-blur-md bg-white/10 hover:bg-white/20 rounded-xl p-4 transition-all duration-300 border border-white/20 hover:border-white/40 shadow-lg hover:shadow-xl hover:scale-105">
                                {/* Product Info */}
                                <div className="space-y-3">
                                    {/* Product Name */}
                                    <div className="text-center">
                                        <h3 className="font-bold text-xl text-white mb-2 leading-tight">
                                            {product.name}
                                        </h3>
                                    </div>
                                    
                                    {/* Category Badge */}
                                    {product.category && (
                                        <div className="text-center">
                                            <span className="inline-block px-3 py-1 bg-blue-500/30 text-blue-200 text-sm rounded-full border border-blue-400/40 font-medium">
                                                {product.category}
                                            </span>
                                        </div>
                                    )}

                                    {/* Price */}
                                    <div className="text-center py-2">
                                        <div className="text-3xl font-bold text-cyan-400">
                                            ₪{product.price}
                                        </div>
                                    </div>

                                    {/* Quantity Selector */}
                                    <div className="flex items-center justify-center gap-2">
                                        <button
                                            onClick={() => updateProductQuantity(product.id, getProductQuantity(product.id) - 1)}
                                            disabled={!user || !shopStatus || !shopStatus.is_open}
                                            className={`w-8 h-8 text-lg font-bold rounded-full transition-all duration-200 ${
                                                user && shopStatus && shopStatus.is_open 
                                                    ? 'bg-red-500 hover:bg-red-600 text-white hover:scale-110' 
                                                    : 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-50'
                                            }`}
                                        >
                                            −
                                        </button>
                                        <span className="text-white font-bold text-xl min-w-[40px] text-center">
                                            {getProductQuantity(product.id)}
                                        </span>
                                        <button
                                            onClick={() => updateProductQuantity(product.id, getProductQuantity(product.id) + 1)}
                                            disabled={!user || !shopStatus || !shopStatus.is_open}
                                            className={`w-8 h-8 text-lg font-bold rounded-full transition-all duration-200 ${
                                                user && shopStatus && shopStatus.is_open 
                                                    ? 'bg-green-500 hover:bg-green-600 text-white hover:scale-110' 
                                                    : 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-50'
                                            }`}
                                        >
                                            +
                                        </button>
                                    </div>

                                    {/* Add to Cart Button */}
                                    {!user ? (
                                        <button
                                            onClick={() => {
                                                showNotification('נדרשת התחברות כדי להוסיף מוצרים לסל', 'warning');
                                                setTimeout(() => router.push('/auth/login?redirect=/shop'), 2000);
                                            }}
                                            className="w-full btn btn-secondary text-sm py-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300"
                                        >
                                            🔑 התחבר להוספה לסל
                                        </button>
                                    ) : shopStatus && shopStatus.is_open ? (
                                        <button
                                            onClick={() => addToCart(product, getProductQuantity(product.id))}
                                            className="w-full btn btn-primary text-sm py-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300"
                                        >
                                            🛒 הוסף {getProductQuantity(product.id) > 1 ? `${getProductQuantity(product.id)} ` : ''}לסל
                                        </button>
                                    ) : (
                                        <button
                                            disabled
                                            className="w-full btn btn-gray text-sm py-2 cursor-not-allowed opacity-50"
                                            title="החנות סגורה כרגע"
                                        >
                                            🔒 החנות סגורה
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Cart Sidebar */}
                {showCart && (
                    <div className="fixed inset-0 z-50">
                        <div 
                            className="fixed inset-0 bg-black/70 backdrop-blur-md"
                            onClick={() => setShowCart(false)}
                        ></div>
                        
                        <div className="fixed right-0 top-0 h-full w-96 bg-white border-l border-gray-200 shadow-2xl overflow-y-auto">
                            <div className="p-6">
                                <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
                                    <h3 className="text-2xl font-bold text-gray-800">🛒 סל קניות</h3>
                                    <button
                                        onClick={() => setShowCart(false)}
                                        style={{
                                            backgroundColor: '#dc2626',
                                            color: 'white',
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '18px',
                                            fontWeight: 'bold',
                                            border: 'none',
                                            cursor: 'pointer',
                                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                                        }}
                                        onMouseEnter={(e) => e.target.style.backgroundColor = '#b91c1c'}
                                        onMouseLeave={(e) => e.target.style.backgroundColor = '#dc2626'}
                                    >
                                        ×
                                    </button>
                                </div>

                                {cart.length === 0 ? (
                                    <div className="text-center py-12">
                                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m1.6 8L6 5H3m4 8a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4z" />
                                            </svg>
                                        </div>
                                        <p className="text-gray-600 text-lg font-medium">הסל ריק</p>
                                        <p className="text-gray-400 text-sm mt-2">הוסף מוצרים להתחלת קנייה</p>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="space-y-4 mb-6">
                                            {cart.map((item) => (
                                                <div key={item.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:border-gray-300 transition-all duration-300 shadow-sm hover:shadow-md">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <h4 className="font-semibold text-gray-800 pr-2 flex-1">{item.name}</h4>
                                                        <button
                                                            onClick={() => removeFromCart(item.id)}
                                                            className="text-red-500 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-all"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center gap-3">
                                                            <button
                                                                onClick={() => updateCartQuantity(item.id, Math.max(0, item.quantity - 1))}
                                                                className="w-10 h-10 bg-red-500 hover:bg-red-600 text-white text-xl font-bold rounded-lg hover:scale-105 transition-all shadow-md flex items-center justify-center"
                                                            >
                                                                −
                                                            </button>
                                                            <span className="text-gray-800 font-bold min-w-[40px] text-center bg-white px-4 py-2 rounded-lg border-2 border-gray-300 text-lg">
                                                                {item.quantity}
                                                            </span>
                                                            <button
                                                                onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                                                                className="w-10 h-10 bg-blue-500 hover:bg-blue-600 text-white text-xl font-bold rounded-lg hover:scale-105 transition-all shadow-md flex items-center justify-center"
                                                            >
                                                                +
                                                            </button>
                                                        </div>
                                                        <div className="text-lg font-bold text-blue-600">
                                                            ₪{(item.price * item.quantity).toFixed(2)}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="border-t border-gray-200 pt-6">
                                            <div className="flex justify-between items-center mb-6">
                                                <span className="text-gray-600 font-semibold text-lg">סה"כ:</span>
                                                <span className="text-2xl font-bold text-blue-600">₪{getCartTotal()}</span>
                                            </div>
                                            
                                            {shopStatus && shopStatus.is_open && currentGeneralOrder ? (
                                                <div className="space-y-3">
                                                    <button
                                                        onClick={placeGeneralOrder}
                                                        className="relative w-full py-4 px-6 text-lg font-bold text-white rounded-xl shadow-lg transform hover:scale-105 transition-all duration-300 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 border border-purple-400/50"
                                                        disabled={cart.length === 0}
                                                    >
                                                        {/* Subtle animated background */}
                                                        <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/10 to-pink-400/10 rounded-xl animate-pulse"></div>
                                                        
                                                        {/* Button content */}
                                                        <div className="relative flex items-center justify-center space-x-2">
                                                            <span className="text-xl">{hasPlacedOrder ? '🔄' : '🚀'}</span>
                                                            <span className="font-bold">
                                                                {hasPlacedOrder ? 'עדכן הזמנה' : 'הצטרף להזמנה הקבוצתית!'}
                                                            </span>
                                                        </div>
                                                    </button>
                                                    
                                                    {hasPlacedOrder && (
                                                        <button
                                                            onClick={cancelOrder}
                                                            className="w-full py-3 px-6 text-base font-bold text-white rounded-xl shadow-lg transform hover:scale-105 transition-all duration-300 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 border border-red-400/50"
                                                        >
                                                            <div className="flex items-center justify-center gap-2">
                                                                <span className="text-lg">🗑️</span>
                                                                <span>בטל הזמנה</span>
                                                            </div>
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-center">
                                                    <button
                                                        disabled
                                                        className="btn btn-outline w-full text-lg py-4 opacity-50 cursor-not-allowed"
                                                    >
                                                        החנות סגורה כרגע
                                                    </button>
                                                    <p className="text-gray-500 text-sm mt-2">
                                                        ההזמנה תהיה זמינה בהזמנה קבוצתית הבאה
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Orders History Modal */}
                {showOrdersModal && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowOrdersModal(false)}>
                        <div className="bg-gradient-to-br from-gray-900 to-blue-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl border border-cyan-500/30" onClick={(e) => e.stopPropagation()}>
                            {/* Modal Header */}
                            <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-6 border-b border-cyan-500/30">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                                        <span className="text-4xl">📋</span>
                                        <span>ההזמנות שלי</span>
                                    </h2>
                                    <button
                                        onClick={() => setShowOrdersModal(false)}
                                        className="text-white hover:text-red-400 transition-colors p-2 hover:bg-white/10 rounded-lg"
                                    >
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
                                {ordersLoading ? (
                                    <div className="flex flex-col items-center justify-center py-20">
                                        <div className="spinner mb-4"></div>
                                        <p className="text-gray-300 text-lg">טוען הזמנות...</p>
                                    </div>
                                ) : userOrders.length === 0 ? (
                                    <div className="text-center py-20">
                                        <div className="w-32 h-32 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-cyan-500/30">
                                            <svg className="w-16 h-16 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                            </svg>
                                        </div>
                                        <p className="text-2xl font-bold text-white mb-3">אין הזמנות עדיין</p>
                                        <p className="text-gray-400 text-lg">ההזמנות שלך יופיעו כאן</p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {userOrders.map((order) => (
                                            <div key={order.id} className="bg-gradient-to-br from-gray-800/50 to-blue-900/30 rounded-xl p-6 border border-cyan-500/20 hover:border-cyan-500/40 transition-all duration-300 backdrop-blur-sm shadow-xl">
                                                {/* Order Header */}
                                                <div className="flex justify-between items-start mb-4 pb-4 border-b border-cyan-500/20">
                                                    <div className="flex-1">
                                                        <h3 className="text-2xl font-bold text-cyan-400 mb-2">
                                                            {order.general_order?.title || 'הזמנה קבוצתית'}
                                                        </h3>
                                                        {order.general_order?.description && (
                                                            <p className="text-gray-300 text-sm mb-2">{order.general_order.description}</p>
                                                        )}
                                                        <div className="flex flex-wrap gap-3 text-sm">
                                                            <span className="text-gray-400">
                                                                📅 {new Date(order.created_at).toLocaleDateString('he-IL')}
                                                            </span>
                                                            <span className="text-gray-400">
                                                                🕐 {new Date(order.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2">
                                                        <span className={`px-4 py-2 rounded-full text-sm font-bold ${
                                                            order.general_order?.status === 'open' 
                                                                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                                                : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                                                        }`}>
                                                            {order.general_order?.status === 'open' ? '🟢 פעילה' : '⚫ הסתיימה'}
                                                        </span>
                                                        {order.is_ending_soon && order.general_order?.status === 'open' && (
                                                            <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-bold border border-yellow-500/30 animate-pulse">
                                                                ⏰ מסתיימת בקרוב
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Order Items */}
                                                <div className="space-y-3 mb-4">
                                                    <h4 className="text-lg font-semibold text-white mb-3">מוצרים בהזמנה:</h4>
                                                    {order.items.map((item) => (
                                                        <div key={item.id} className="bg-gray-900/40 rounded-lg p-4 border border-cyan-500/10 hover:bg-gray-900/60 transition-all">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div className="flex items-center gap-4 flex-1">
                                                                    <div className="w-12 h-12 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-lg flex items-center justify-center text-2xl border border-cyan-500/30 flex-shrink-0">
                                                                        🛍️
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <h5 className="font-semibold text-white text-lg mb-1">{item.product?.name}</h5>
                                                                        <div className="flex items-center gap-4 text-sm">
                                                                            <span className="text-gray-400">כמות: <span className="text-white font-semibold">{item.quantity}</span></span>
                                                                            <span className="text-gray-400">מחיר ליחידה: <span className="text-cyan-400 font-semibold">₪{(item.unit_price || 0).toFixed(2)}</span></span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="text-left flex-shrink-0 mr-4">
                                                                    <div className="text-cyan-400 font-bold text-xl">₪{(item.total_price || 0).toFixed(2)}</div>
                                                                    <div className="text-gray-500 text-xs text-right">סה"כ</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Order Summary */}
                                                <div className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 rounded-lg p-4 border-2 border-cyan-500/30">
                                                    <div className="flex justify-between items-center">
                                                        <div className="text-gray-300">
                                                            <span className="font-semibold">סה"כ פריטים: </span>
                                                            <span className="text-white font-bold">{order.total_items}</span>
                                                        </div>
                                                        <div className="text-left">
                                                            <div className="text-sm text-gray-400 mb-1">סכום כולל:</div>
                                                            <div className="text-3xl font-bold text-cyan-400">₪{(order.total_amount || 0).toFixed(2)}</div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Reorder Button - Only show for closed/completed orders when shop is open */}
                                                {shopStatus && shopStatus.is_open && currentGeneralOrder && 
                                                 order.general_order?.status !== 'open' && (
                                                    <div className="mt-4">
                                                        <button
                                                            onClick={() => handleReorder(order)}
                                                            className="w-full py-3 px-6 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/50 flex items-center justify-center gap-3"
                                                        >
                                                            <span className="text-2xl">🔄</span>
                                                            <span className="text-lg">הזמן מחדש</span>
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Time Remaining (for active orders) */}
                                                {order.general_order?.status === 'open' && !order.is_expired && (
                                                    <div className="mt-4 bg-gradient-to-r from-green-900/20 to-blue-900/20 border border-green-500/30 rounded-lg p-4">
                                                        <div className="flex items-center justify-center gap-3 text-green-400">
                                                            <span className="text-2xl">⏳</span>
                                                            <span className="font-semibold">
                                                                נותרו {order.hours_remaining} שעות ו-{order.minutes_remaining} דקות
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                </div>
            </main>
        </div>
    );
}