'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '../../lib/supabase';

export default function ShopPage() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [products                ) : null}

                {/* Products Grid */}
                {productsLoading ? ( useState([]);
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

    useEffect(() => {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            router.push('/auth/login');
            return;
        }
        setUser(currentUser);
        setLoading(false);
        loadProducts();
        loadCart();
        loadShopStatus();
        checkUserParticipation(currentUser.id);
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

    const saveCart = (cartItems) => {
        setCart(cartItems);
        if (typeof window !== 'undefined') {
            localStorage.setItem('cart', JSON.stringify(cartItems));
        }
    };

    const addToCart = (product, quantity = 1) => {
        const existingItem = cart.find(item => item.id === product.id);
        if (existingItem) {
            const newCart = cart.map(item =>
                item.id === product.id 
                    ? { ...item, quantity: item.quantity + quantity }
                    : item
            );
            saveCart(newCart);
        } else {
            const newCart = [...cart, { ...product, quantity }];
            saveCart(newCart);
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
        if (!user || !currentGeneralOrder || cart.length === 0) {
            alert('לא ניתן לבצע הזמנה כרגע');
            return;
        }

        try {
            const orderData = {
                user_id: user.id,
                items: cart.map(item => ({
                    product_id: item.id,
                    quantity: item.quantity
                }))
            };

            const response = await fetch('/api/general-orders/participate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(orderData)
            });

            if (response.ok) {
                const result = await response.json();
                alert('הזמנה נשלחה בהצלחה!');
                setHasPlacedOrder(true);
                setShowCart(false);
                // Refresh participation status
                checkUserParticipation(user.id);
            } else {
                const error = await response.json();
                alert(error.error || 'שגיאה בשליחת ההזמנה');
            }
        } catch (error) {
            console.error('Error placing general order:', error);
            alert('שגיאה בשליחת ההזמנה');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('currentUser');
        router.push('/auth/login');
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
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 space-x-reverse">
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                                הוייפ שופ
                            </h1>
                            <span className="text-gray-400">|</span>
                            <span className="text-gray-200">שלום {user?.full_name}</span>
                        </div>
                        
                        <nav className="flex items-center gap-4">
                            <Link 
                                href="/shop" 
                                className="btn btn-primary"
                            >
                                🏪 חנות
                            </Link>
                            <Link 
                                href="/orders" 
                                className="btn btn-secondary"
                            >
                                📋 ההזמנות שלי
                            </Link>
                            <Link 
                                href="/group-orders" 
                                className="btn btn-secondary"
                            >
                                👥 הזמנות קבוצתיות
                            </Link>
                            {user?.role === 'admin' && (
                                <Link 
                                    href="/admin" 
                                    className="btn btn-primary"
                                >
                                    ⚙️ ניהול
                                </Link>
                            )}
                            <button
                                onClick={() => setShowCart(true)}
                                className="btn btn-primary relative"
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
                                className="btn btn-outline"
                            >
                                🚪 יציאה
                            </button>
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


                                
                                {/* Order details with enhanced styling */}
                                <div className="bg-white/10 rounded-xl p-6 mb-6 border border-white/20">
                                    <h3 className="text-2xl font-bold text-yellow-300 mb-3 flex items-center">
                                        <span className="text-3xl mr-3 animate-spin-slow">�</span>
                                        {currentGeneralOrder.title}
                                    </h3>


                </div>

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
                                {/* Product Image */}
                                <div className="w-full h-32 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/20"></div>
                                    {product.image_url ? (
                                        <img 
                                            src={product.image_url} 
                                            alt={product.name}
                                            className="w-full h-full object-cover rounded-lg"
                                        />
                                    ) : (
                                        <svg className="w-12 h-12 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                                        </svg>
                                    )}
                                </div>

                                {/* Product Info */}
                                <div className="space-y-3">
                                    <div className="bg-white/90 backdrop-blur-sm rounded-lg p-3 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300">
                                        <h3 className="font-bold text-lg text-gray-800 text-center leading-snug tracking-wide hover:text-blue-600 transition-colors">
                                            {product.name}
                                        </h3>
                                    </div>
                                    
                                    {/* Category Badge */}
                                    {product.category && (
                                        <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-800 text-sm rounded-full border border-blue-500/30 font-medium">
                                            {product.category}
                                        </span>
                                    )}

                                    {/* Price */}
                                    <div className="text-center">
                                        <div className="bg-white/90 backdrop-blur-sm rounded-lg p-2 border border-gray-200 shadow-md">
                                            <div className="text-xl font-bold text-gray-800">
                                                ₪{product.price}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quantity Selector */}
                                    <div className="flex items-center justify-center gap-2 bg-white/90 backdrop-blur-sm rounded-lg p-2 border border-gray-200 shadow-md">
                                        <button
                                            onClick={() => updateProductQuantity(product.id, getProductQuantity(product.id) - 1)}
                                            disabled={!shopStatus || !shopStatus.is_open}
                                            className={`w-8 h-8 btn text-xs font-bold rounded-md transition-all duration-200 ${
                                                shopStatus && shopStatus.is_open 
                                                    ? 'btn-outline hover:scale-105' 
                                                    : 'btn-gray cursor-not-allowed opacity-50'
                                            }`}
                                        >
                                            -
                                        </button>
                                        <span className="text-gray-800 font-bold min-w-[35px] text-center text-lg px-2">
                                            {getProductQuantity(product.id)}
                                        </span>
                                        <button
                                            onClick={() => updateProductQuantity(product.id, getProductQuantity(product.id) + 1)}
                                            disabled={!shopStatus || !shopStatus.is_open}
                                            className={`w-8 h-8 btn text-xs font-bold rounded-md transition-all duration-200 ${
                                                shopStatus && shopStatus.is_open 
                                                    ? 'btn-primary hover:scale-105' 
                                                    : 'btn-gray cursor-not-allowed opacity-50'
                                            }`}
                                        >
                                            +
                                        </button>
                                    </div>

                                    {/* Add to Cart Button */}
                                    {shopStatus && shopStatus.is_open ? (
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
                                                                className="w-8 h-8 btn btn-outline text-xs font-bold rounded-md hover:scale-105 transition-all"
                                                            >
                                                                -
                                                            </button>
                                                            <span className="text-gray-800 font-bold min-w-[30px] text-center bg-white px-3 py-1 rounded-lg border border-gray-200">
                                                                {item.quantity}
                                                            </span>
                                                            <button
                                                                onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                                                                className="w-8 h-8 btn btn-primary text-xs font-bold rounded-md hover:scale-105 transition-all"
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
                                                <span className="text-gray-600 font-semibold text-lg">סה&ldquo;כ:</span>
                                                <span className="text-2xl font-bold text-blue-600">₪{getCartTotal()}</span>
                                            </div>
                                            
                                            {shopStatus && shopStatus.is_open && currentGeneralOrder ? (
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
                </div>
            </main>
        </div>
    );
}