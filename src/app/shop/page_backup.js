'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/supabase';

export default function ShopPage() {
    const [user, setUser] = useState(null);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [productsLoading, setProductsLoading] = useState(false);
    const [shopStatus, setShopStatus] = useState(null);
    const [shopStatusLoading, setShopStatusLoading] = useState(false);
    const [currentGeneralOrder, setCurrentGeneralOrder] = useState(null);
    const [hasPlacedOrder, setHasPlacedOrder] = useState(false);
    const [cart, setCart] = useState([]);
    const [showCart, setShowCart] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            router.push('/auth/login');
            return;
        }
        setUser(currentUser);
        setLoading(false);
    }, [router]);

    // Fetch shop status
    useEffect(() => {
        if (!user) return;

        const fetchShopStatus = async () => {
            setShopStatusLoading(true);
            try {
                const response = await fetch('/api/shop/status');
                if (response.ok) {
                    const data = await response.json();
                    setShopStatus(data);
                } else {
                    console.error('Error fetching shop status:', await response.text());
                }
            } catch (error) {
                console.error('Error fetching shop status:', error);
            } finally {
                setShopStatusLoading(false);
            }
        };

        fetchShopStatus();
    }, [user]);

    // Fetch general order info
    useEffect(() => {
        if (!user) return;

        const fetchGeneralOrder = async () => {
            try {
                const response = await fetch('/api/admin/general-orders');
                if (response.ok) {
                    const data = await response.json();
                    if (data.orders && data.orders.length > 0) {
                        const activeOrder = data.orders.find(order => order.status === 'active' || order.status === 'pending');
                        setCurrentGeneralOrder(activeOrder || null);

                        if (activeOrder) {
                            const participantResponse = await fetch(`/api/general-orders/participate?general_order_id=${activeOrder.id}&user_id=${user.id}`);
                            if (participantResponse.ok) {
                                const participantData = await participantResponse.json();
                                setHasPlacedOrder(participantData.hasParticipated);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching general order:', error);
            }
        };

        fetchGeneralOrder();
    }, [user]);

    // Fetch products
    useEffect(() => {
        if (!user) return;

        const fetchProducts = async () => {
            setProductsLoading(true);
            try {
                const response = await fetch('/api/products');
                if (response.ok) {
                    const data = await response.json();
                    setProducts(data.products || []);
                } else {
                    console.error('Error fetching products:', await response.text());
                }
            } catch (error) {
                console.error('Error fetching products:', error);
            } finally {
                setProductsLoading(false);
            }
        };

        fetchProducts();
    }, [user]);

    const addToCart = (product) => {
        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.id === product.id);
            if (existingItem) {
                return prevCart.map(item =>
                    item.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            } else {
                return [...prevCart, { ...product, quantity: 1 }];
            }
        });
    };

    const removeFromCart = (productId) => {
        setCart(prevCart => prevCart.filter(item => item.id !== productId));
    };

    const updateCartQuantity = (productId, newQuantity) => {
        if (newQuantity <= 0) {
            removeFromCart(productId);
        } else {
            setCart(prevCart => 
                prevCart.map(item =>
                    item.id === productId
                        ? { ...item, quantity: newQuantity }
                        : item
                )
            );
        }
    };

    const getCartTotal = () => {
        return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    };

    const getCartItemsCount = () => {
        return cart.reduce((total, item) => total + item.quantity, 0);
    };

    const placeOrder = async () => {
        if (!currentGeneralOrder || cart.length === 0) {
            alert('לא ניתן לבצע הזמנה');
            return;
        }

        try {
            const orderData = {
                user_id: user.id,
                general_order_id: currentGeneralOrder.id,
                items: cart.map(item => ({
                    product_id: item.id,
                    quantity: item.quantity,
                    price_per_item: item.price
                })),
                total_amount: getCartTotal(),
                status: 'pending'
            };

            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(orderData)
            });

            if (response.ok) {
                alert('ההזמנה בוצעה בהצלחה!');
                setCart([]);
                setShowCart(false);
                setHasPlacedOrder(true);
            } else {
                const errorData = await response.json();
                alert(`שגיאה בביצוע ההזמנה: ${errorData.error}`);
            }
        } catch (error) {
            console.error('Error placing order:', error);
            alert('שגיאה בביצוע ההזמנה');
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <div className="loading-spinner"></div>
            </div>
        );
    }

    return (
        <div className="main-container">
            {/* Modern Header Navigation */}
            <header style={{ 
                background: 'rgba(255, 255, 255, 0.98)', 
                backdropFilter: 'blur(15px)',
                borderBottom: '2px solid rgba(111, 66, 193, 0.3)',
                marginBottom: '20px',
                borderRadius: '16px',
                padding: '20px 32px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <h1 style={{ 
                            fontSize: '26px', 
                            fontWeight: 'bold',
                            background: 'linear-gradient(135deg, #6f42c1, #0d6efd)',
                            WebkitBackgroundClip: 'text',
                            backgroundClip: 'text',
                            color: 'transparent',
                            margin: 0,
                            textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}>
                            🛒 חנות ווייפים
                        </h1>
                        <span style={{ color: '#9ca3af', fontSize: '20px' }}>|</span>
                        <span style={{ color: '#6b7280', fontSize: '16px', fontWeight: '500' }}>שלום {user?.full_name || user?.email}</span>
                    </div>
                    
                    <nav style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {/* Orders Button */}
                        <button 
                            onClick={() => router.push('/orders')}
                            style={{
                                background: 'linear-gradient(135deg, #ffffff, #f8fafc)',
                                border: '2px solid #6f42c1',
                                color: '#6f42c1',
                                padding: '12px 20px',
                                borderRadius: '12px',
                                fontSize: '15px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 4px 12px rgba(111, 66, 193, 0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.background = 'linear-gradient(135deg, #6f42c1, #8b5cf6)';
                                e.target.style.color = 'white';
                                e.target.style.transform = 'translateY(-2px)';
                                e.target.style.boxShadow = '0 8px 20px rgba(111, 66, 193, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.background = 'linear-gradient(135deg, #ffffff, #f8fafc)';
                                e.target.style.color = '#6f42c1';
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 4px 12px rgba(111, 66, 193, 0.2)';
                            }}
                        >
                            📋 ההזמנות שלי
                        </button>

                        {/* Group Orders Button */}
                        <button 
                            onClick={() => router.push('/group-orders')}
                            style={{
                                background: 'linear-gradient(135deg, #ffffff, #f8fafc)',
                                border: '2px solid #0d6efd',
                                color: '#0d6efd',
                                padding: '12px 20px',
                                borderRadius: '12px',
                                fontSize: '15px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 4px 12px rgba(13, 110, 253, 0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.background = 'linear-gradient(135deg, #0d6efd, #3b82f6)';
                                e.target.style.color = 'white';
                                e.target.style.transform = 'translateY(-2px)';
                                e.target.style.boxShadow = '0 8px 20px rgba(13, 110, 253, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.background = 'linear-gradient(135deg, #ffffff, #f8fafc)';
                                e.target.style.color = '#0d6efd';
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 4px 12px rgba(13, 110, 253, 0.2)';
                            }}
                        >
                            👥 הזמנות קבוצתיות
                        </button>

                        {/* Cart Button */}
                        <button 
                            onClick={() => setShowCart(!showCart)}
                            style={{
                                position: 'relative',
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                border: 'none',
                                color: 'white',
                                padding: '12px 20px',
                                borderRadius: '12px',
                                fontSize: '15px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.transform = 'translateY(-2px)';
                                e.target.style.boxShadow = '0 8px 20px rgba(16, 185, 129, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                            }}
                        >
                            🛒 עגלה ({getCartItemsCount()})
                            {getCartItemsCount() > 0 && (
                                <span style={{ 
                                    position: 'absolute', 
                                    top: '-8px', 
                                    right: '-8px', 
                                    backgroundColor: '#ef4444', 
                                    color: 'white', 
                                    borderRadius: '50%', 
                                    width: '24px', 
                                    height: '24px', 
                                    fontSize: '12px', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    fontWeight: 'bold',
                                    border: '2px solid white'
                                }}>
                                    {getCartItemsCount()}
                                </span>
                            )}
                        </button>

                        {/* Logout Button */}
                        <button 
                            onClick={() => {
                                localStorage.removeItem('user');
                                router.push('/auth/login');
                            }}
                            style={{
                                background: 'linear-gradient(135deg, #ffffff, #fef2f2)',
                                border: '2px solid #ef4444',
                                color: '#ef4444',
                                padding: '12px 20px',
                                borderRadius: '12px',
                                fontSize: '15px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
                                e.target.style.color = 'white';
                                e.target.style.transform = 'translateY(-2px)';
                                e.target.style.boxShadow = '0 8px 20px rgba(239, 68, 68, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.background = 'linear-gradient(135deg, #ffffff, #fef2f2)';
                                e.target.style.color = '#ef4444';
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.2)';
                            }}
                        >
                            🚪 יציאה
                        </button>
                    </nav>
                </div>
            </header>

            {/* Page Subtitle */}
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <p className="subtitle">הזמינו את המוצרים המועדפים עליכם</p>
            </div>

            <div className="container">
                {/* Shop Status */}
                {shopStatusLoading ? (
                    <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                        <div className="loading-spinner"></div>
                    </div>
                ) : shopStatus && !shopStatus.isOpen ? (
                    <div className="card" style={{ marginBottom: '30px', textAlign: 'center', backgroundColor: '#fef2f2', borderColor: '#fca5a5' }}>
                        <h2 style={{ color: '#dc2626', fontSize: '24px', marginBottom: '10px' }}>החנות סגורה</h2>
                        <p style={{ color: '#991b1b', fontSize: '16px' }}>החנות סגורה כרגע. אנא בדקו שוב מאוחר יותר.</p>
                        {shopStatus.closeReason && (
                            <p style={{ color: '#7f1d1d', fontSize: '14px', fontStyle: 'italic', marginTop: '10px' }}>
                                סיבה: {shopStatus.closeReason}
                            </p>
                        )}
                    </div>
                ) : null}

                {/* General Order Info */}
                {currentGeneralOrder && (
                    <div className="card" style={{ marginBottom: '30px', backgroundColor: '#f0f9ff', borderColor: '#7dd3fc' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <div>
                                <h3 style={{ color: '#1e40af', fontSize: '20px', marginBottom: '5px' }}>🎯 הזמנה קבוצתית פעילה</h3>
                                <p style={{ color: '#374151', fontSize: '16px', margin: 0 }}>{currentGeneralOrder.description || 'הזמנה קבוצתית חדשה'}</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div>
                                    <span style={{ color: '#dc2626', fontSize: '14px', fontWeight: '500' }}>סגירה: </span>
                                    <span style={{ color: '#991b1b', fontSize: '14px', fontFamily: 'monospace' }}>
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
                        {hasPlacedOrder && (
                            <div style={{ backgroundColor: '#dcfce7', padding: '10px', borderRadius: '8px', marginTop: '10px' }}>
                                <p style={{ color: '#166534', fontSize: '14px', margin: 0, fontWeight: '500' }}>
                                    ✅ כבר הזמנתם בהזמנה הקבוצתית הזו
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Cart Panel */}
                {showCart && (
                    <div className="card" style={{ marginBottom: '30px', backgroundColor: '#f9fafb', borderColor: '#d1d5db' }}>
                        <h3 style={{ fontSize: '18px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            🛒 עגלת קניות
                            <button 
                                onClick={() => setShowCart(false)}
                                style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}
                            >
                                ✕
                            </button>
                        </h3>
                        {cart.length === 0 ? (
                            <p style={{ textAlign: 'center', color: '#6b7280' }}>העגלה ריקה</p>
                        ) : (
                            <div>
                                {cart.map(item => (
                                    <div key={item.id} style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center', 
                                        padding: '10px', 
                                        borderBottom: '1px solid #e5e7eb',
                                        marginBottom: '10px'
                                    }}>
                                        <div>
                                            <h4 style={{ margin: 0, fontSize: '16px' }}>{item.name}</h4>
                                            <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>₪{item.price} × {item.quantity}</p>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <button 
                                                onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                                                style={{ 
                                                    background: '#f3f4f6', 
                                                    border: '1px solid #d1d5db', 
                                                    borderRadius: '4px', 
                                                    width: '30px', 
                                                    height: '30px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                -
                                            </button>
                                            <span style={{ minWidth: '20px', textAlign: 'center' }}>{item.quantity}</span>
                                            <button 
                                                onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                                                style={{ 
                                                    background: '#f3f4f6', 
                                                    border: '1px solid #d1d5db', 
                                                    borderRadius: '4px', 
                                                    width: '30px', 
                                                    height: '30px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                +
                                            </button>
                                            <button 
                                                onClick={() => removeFromCart(item.id)}
                                                style={{ 
                                                    background: '#fef2f2', 
                                                    border: '1px solid #fca5a5', 
                                                    borderRadius: '4px', 
                                                    padding: '5px 10px',
                                                    color: '#dc2626',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                הסר
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px' }}>
                                        סה"כ: ₪{getCartTotal()}
                                    </div>
                                    <button 
                                        className="btn btn-primary"
                                        onClick={placeOrder}
                                        disabled={!currentGeneralOrder || hasPlacedOrder}
                                        style={{ width: '100%', padding: '15px' }}
                                    >
                                        {!currentGeneralOrder ? '❌ אין הזמנה קבוצתית פעילה' :
                                         hasPlacedOrder ? '✅ כבר הזמנתם בהזמנה זו' :
                                         '🛒 בצע הזמנה'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Products Grid */}
                <div style={{ marginBottom: '40px' }}>
                    <h2 style={{ fontSize: '24px', marginBottom: '20px', textAlign: 'center' }}>📦 מוצרים זמינים</h2>
                    
                    {productsLoading ? (
                        <div style={{ textAlign: 'center' }}>
                            <div className="loading-spinner"></div>
                        </div>
                    ) : products.length === 0 ? (
                        <div className="card" style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: '18px', color: '#6b7280' }}>אין מוצרים זמינים כרגע</p>
                        </div>
                    ) : (
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
                            gap: '20px' 
                        }}>
                            {products.map(product => (
                                <div key={product.id} className="card" style={{ 
                                    border: '1px solid #e5e7eb',
                                    transition: 'all 0.3s ease',
                                    cursor: 'pointer'
                                }}>
                                    {/* Product Image */}
                                    {product.image_url && (
                                        <div style={{ 
                                            width: '100%', 
                                            height: '200px', 
                                            backgroundImage: `url(${product.image_url})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            borderRadius: '8px',
                                            marginBottom: '15px'
                                        }}></div>
                                    )}

                                    {/* Product Info */}
                                    <div style={{ padding: '15px' }}>
                                        <h3 style={{ fontSize: '18px', marginBottom: '10px', color: '#1f2937' }}>{product.name}</h3>
                                        <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '15px', lineHeight: '1.5' }}>
                                            {product.description}
                                        </p>
                                        
                                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981', marginBottom: '15px' }}>
                                            ₪{product.price}
                                        </div>
                                    </div>

                                    {/* Add to Cart Button */}
                                    <button 
                                        className="btn btn-primary"
                                        style={{ width: '100%' }}
                                        onClick={() => addToCart(product)}
                                        disabled={!currentGeneralOrder}
                                    >
                                        {!currentGeneralOrder ? '❌ אין הזמנה כללית פעילה' : 'הוסף לעגלה'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                <div className="card" style={{ marginTop: '40px', textAlign: 'center' }}>
                    <h3 style={{ fontSize: '18px', marginBottom: '15px' }}>ℹ️ מידע חשוב</h3>
                    <div style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.6' }}>
                        <p style={{ marginBottom: '10px' }}>• ההזמנות מתבצעות במסגרת הזמנות קבוצתיות</p>
                        <p style={{ marginBottom: '10px' }}>• התשלום במזומן בעת האיסוף</p>
                        <p>• זמני איסוף יתואמו לאחר סגירת ההזמנה</p>
                    </div>
                </div>
            </div>
        </div>
    );
}