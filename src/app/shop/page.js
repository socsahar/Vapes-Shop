'use client';

import { useState, useEffect } from 'react';
import { getCurrentUser, signOut, makeAuthenticatedRequest } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { showToast } from '../../components/Toast';

export default function ShopPage() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState([]);
    const [productsLoading, setProductsLoading] = useState(false);
    const [groupOrders, setGroupOrders] = useState([]);
    const [groupOrdersLoading, setGroupOrdersLoading] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [cart, setCart] = useState({});
    const [showParticipateModal, setShowParticipateModal] = useState(false);
    const [participateLoading, setParticipateLoading] = useState(false);
    const [shopStatus, setShopStatus] = useState('loading');
    const [shopStatusMessage, setShopStatusMessage] = useState('');
    const [actualShopData, setActualShopData] = useState(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [userParticipation, setUserParticipation] = useState({});
    const [showUserOrderModal, setShowUserOrderModal] = useState(false);
    const [selectedUserOrder, setSelectedUserOrder] = useState(null);
    // Static shop settings - not affected by admin panel changes
    const shopSettings = {
        closedTitle: 'החנות סגורה כרגע. נפתח בהזמנה קבוצתית הבאה.',
        closedMessage: 'החנות פועלת במודל הזמנות קבוצתיות בלבד\nכאשר המנהל יפתח הזמנה קבוצתית חדשה, תוכל להשתתף',
        closedInstructions: [
            '🕐 המנהל פותח הזמנה קבוצתית עם תאריך סגירה',
            '📧 תקבל התראה באימייל כשההזמנה נפתחת',
            '🛒 תוכל להצטרף ולהזמין מוצרים עד תאריך הסגירה',
            '� תשלום יש להעביר במזומן באיסוף או בפייבוקס: 0546743526'
        ]
    };
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

    useEffect(() => {
        if (user) {
            fetchGroupOrders();
            fetchProducts(); // Always fetch products
            // fetchShopSettings(); // Disabled - using static settings instead
            fetchActualShopStatus(); // Fetch real shop status from database
        }
    }, [user]);

    // Separate effect for polling with dynamic intervals
    useEffect(() => {
        if (!user) return;
        
        let interval;
        
        const setupPolling = () => {
            // Clear any existing interval
            if (interval) {
                clearInterval(interval);
            }
            
            // Determine polling frequency based on current status
            let pollingInterval = 45000; // Default 45s when closed
            
            if (groupOrders.length > 0) {
                const hasEndingSoon = groupOrders.some(order => order.is_ending_soon);
                pollingInterval = hasEndingSoon ? 45000 : 45000; // 45s if ending soon, 45s if open
            }
            
            console.log(`Setting up polling every ${pollingInterval/1000}s (${groupOrders.length} active orders)`);
            
            interval = setInterval(async () => {
                await Promise.all([
                    fetchGroupOrders(),
                    fetchActualShopStatus()
                ]);
            }, pollingInterval);
        };
        
        // Set up initial polling
        setupPolling();
        
        // Clean up on unmount
        return () => {
            if (interval) {
                clearInterval(interval);
            }
        };
    }, [user, groupOrders.length, groupOrders.some(order => order?.is_ending_soon)]); // Re-setup when status changes

    const fetchGroupOrders = async (isManualRefresh = false) => {
        try {
            if (isManualRefresh) {
                setIsRefreshing(true);
            }
            setGroupOrdersLoading(true);
            const response = await makeAuthenticatedRequest('/api/group-orders');
            if (response.ok) {
                const data = await response.json();
                setGroupOrders(data.orders || []);
                
                // Don't set shop status here - let fetchActualShopStatus handle it
                setLastUpdated(new Date());
                
                // Fetch detailed participation for each order
                await fetchUserParticipation(data.orders || []);
            } else {
                setGroupOrders([]);
            }
        } catch (error) {
            console.error('Error fetching group orders:', error);
            setGroupOrders([]);
        } finally {
            setGroupOrdersLoading(false);
            setIsRefreshing(false);
        }
    };

    const fetchUserParticipation = async (orders) => {
        if (!user || orders.length === 0) return;
        
        const participationData = {};
        
        for (const order of orders) {
            if (order.user_participating) {
                try {
                    const response = await makeAuthenticatedRequest(`/api/general-orders/participate?general_order_id=${order.id}`);
                    if (response.ok) {
                        const data = await response.json();
                        participationData[order.id] = data;
                    }
                } catch (error) {
                    console.error(`Error fetching participation for order ${order.id}:`, error);
                }
            }
        }
        
        setUserParticipation(participationData);
    };

    const fetchProducts = async () => {
        try {
            setProductsLoading(true);
            const response = await fetch('/api/products');
            if (response.ok) {
                const data = await response.json();
                setProducts(data.products || []);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setProductsLoading(false);
        }
    };

    // fetchShopSettings function disabled - using static settings instead
    // const fetchShopSettings = async () => {
    //     try {
    //         const response = await fetch('/api/shop/status');
    //         if (response.ok) {
    //             const data = await response.json();
    //             if (data.message) {
    //                 try {
    //                     // Try to parse as JSON first (new structured format)
    //                     const parsedSettings = JSON.parse(data.message);
    //                     if (parsedSettings.closedTitle || parsedSettings.closedMessage || parsedSettings.closedInstructions) {
    //                         setShopSettings(prev => ({
    //                             ...prev,
    //                             closedTitle: parsedSettings.closedTitle || prev.closedTitle,
    //                             closedMessage: parsedSettings.closedMessage || prev.closedMessage,
    //                             closedInstructions: parsedSettings.closedInstructions || prev.closedInstructions
    //                         }));
    //                         return;
    //                     }
    //                 } catch (jsonError) {
    //                     // Fallback to old format (plain text)
    //                     const [title, ...messageParts] = data.message.split('\n');
    //                     setShopSettings(prev => ({
    //                         ...prev,
    //                         closedTitle: title || prev.closedTitle,
    //                         closedMessage: messageParts.join('\n') || prev.closedMessage
    //                     }));
    //                 }
    //             }
    //         }
    //     } catch (error) {
    //         console.error('Error fetching shop settings:', error);
    //     }
    // };

    const fetchActualShopStatus = async () => {
        try {
            const response = await fetch('/api/shop/status');
            if (response.ok) {
                const data = await response.json();
                setActualShopData(data);
                
                // Set shop status and message based on database data
                if (data.is_open) {
                    setShopStatus('open');
                    setShopStatusMessage(data.message || 'החנות פתוחה - הזמנות קבוצתיות פעילות');
                } else {
                    setShopStatus('closed');
                    setShopStatusMessage(data.message || 'החנות סגורה - אין הזמנות קבוצתיות פעילות');
                }
            } else {
                // Fallback status
                setShopStatus('closed');
                setShopStatusMessage('החנות סגורה - אין הזמנות קבוצתיות פעילות');
            }
        } catch (error) {
            console.error('Error fetching actual shop status:', error);
            setShopStatus('closed');
            setShopStatusMessage('שגיאה בטעינת סטטוס החנות');
        }
    };

    const handleAddToCart = (productId, quantity = 1) => {
        if (!selectedOrder) return;
        
        setCart(prev => ({
            ...prev,
            [productId]: (prev[productId] || 0) + quantity
        }));
    };

    const handleRemoveFromCart = (productId) => {
        setCart(prev => {
            const newCart = { ...prev };
            delete newCart[productId];
            return newCart;
        });
    };

    const handleQuantityChange = (productId, quantity) => {
        if (quantity <= 0) {
            handleRemoveFromCart(productId);
        } else {
            setCart(prev => ({
                ...prev,
                [productId]: quantity
            }));
        }
    };

    const calculateCartTotal = () => {
        return Object.entries(cart).reduce((total, [productId, quantity]) => {
            const product = products.find(p => p.id === productId);
            return total + (product ? product.price * quantity : 0);
        }, 0);
    };

    const getCartItemsCount = () => {
        return Object.values(cart).reduce((total, quantity) => total + quantity, 0);
    };

    const handleParticipate = async () => {
        if (!selectedOrder || Object.keys(cart).length === 0) {
            showToast('אנא בחר מוצרים להזמנה', 'warning');
            return;
        }

        try {
            setParticipateLoading(true);
            
            const items = Object.entries(cart).map(([productId, quantity]) => ({
                product_id: productId,
                quantity
            }));

            const response = await makeAuthenticatedRequest('/api/general-orders/participate', {
                method: 'POST',
                body: JSON.stringify({
                    general_order_id: selectedOrder.id,
                    items
                })
            });

            const result = await response.json();

            if (response.ok) {
                showToast('השתתפת בהזמנה הקבוצתית בהצלחה!', 'success');
                setCart({});
                setShowParticipateModal(false);
                fetchGroupOrders(); // Refresh to update participation status
            } else {
                showToast(`שגיאה: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error participating:', error);
            showToast('שגיאה בהשתתפות בהזמנה', 'error');
        } finally {
            setParticipateLoading(false);
        }
    };

    const handleSelectOrder = (order) => {
        // Only allow selection of open orders
        if (order.status === 'open') {
            setSelectedOrder(order);
            setCart({});
        }
    };

    const handleViewUserOrder = (order) => {
        const participation = userParticipation[order.id];
        if (participation && participation.participating) {
            setSelectedUserOrder({
                ...order,
                participation: participation
            });
            setShowUserOrderModal(true);
        }
    };

    const handleCancelUserOrder = async (orderId) => {
        if (!confirm('האם אתה בטוח שברצונך לבטל את ההשתתפות שלך? פעולה זו אינה ניתנת לביטול.')) {
            return;
        }

        try {
            const response = await makeAuthenticatedRequest('/api/group-orders', {
                method: 'POST',
                body: JSON.stringify({
                    general_order_id: orderId,
                    action: 'leave'
                })
            });

            if (response.ok) {
                showToast('ההשתתפות בוטלה בהצלחה!', 'success');
                await fetchGroupOrders(); // Refresh to update participation status
                setShowUserOrderModal(false);
            } else {
                const error = await response.json();
                showToast(`שגיאה בביטול ההשתתפות: ${error.error}`, 'error');
            }
        } catch (error) {
            console.error('Error canceling participation:', error);
            showToast('שגיאה בביטול ההשתתפות', 'error');
        }
    };

    const handleLogout = async () => {
        await signOut();
        router.push('/');
    };

    const handleManualRefresh = async () => {
        await Promise.all([
            fetchGroupOrders(true),
            fetchActualShopStatus()
        ]);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen shop-page">
            {/* Background */}
            <div className="fixed inset-0 bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50"></div>
            <div className="fixed inset-0 bg-pattern opacity-5"></div>

            {/* Header */}
            <header className="relative z-10 shop-header">
                <div className="container mx-auto px-6 py-4">
                    <div className="flex items-center justify-between mobile-flex-col gap-4">
                        <div className="flex items-center space-x-4 space-x-reverse mobile-w-full mobile-text-center">
                            <Link href="/" className="shop-logo">
                                <span className="text-2xl">💨</span>
                                <span className="font-bold">הוייפ שופ</span>
                            </Link>
                            <div className={`shop-status ${shopStatus} mobile-w-full`}>
                                <div className="flex items-center gap-2 mobile-text-center mobile-flex-col">
                                    {shopStatus === 'open' ? (
                                        <>
                                            <span className="status-indicator open"></span>
                                            <span className="text-sm md:text-base">{shopStatusMessage}</span>
                                        </>
                                    ) : shopStatus === 'closed' ? (
                                        <>
                                            <span className="status-indicator closed"></span>
                                            <span className="text-sm md:text-base">{shopStatusMessage}</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="status-indicator loading"></span>
                                            <span className="text-sm md:text-base">בודק סטטוס...</span>
                                        </>
                                    )}
                                    
                                    {/* Auto-refresh indicator and manual refresh button */}
                                    <div className="flex items-center gap-1 text-xs opacity-70">
                                        {isRefreshing && (
                                            <span className="animate-spin">🔄</span>
                                        )}
                                        <button 
                                            onClick={handleManualRefresh}
                                            disabled={isRefreshing}
                                            className="hover:opacity-100 transition-opacity disabled:opacity-50"
                                            title="רענן סטטוס החנות"
                                        >
                                            ↻
                                        </button>
                                        {lastUpdated && (
                                            <span title={`עודכן לאחרונה: ${lastUpdated.toLocaleTimeString('he-IL')}`}>
                                                {lastUpdated.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <nav className="flex items-center space-x-4 space-x-reverse">
                            <span className="shop-welcome">שלום {user?.full_name}</span>
                            {user?.role === 'admin' && (
                                <Link href="/admin" className="shop-nav-link admin">
                                    <span className="ml-2">⚡</span>
                                    פאנל ניהול
                                </Link>
                            )}
                            <button onClick={handleLogout} className="shop-nav-link logout">
                                <span className="ml-2">🚪</span>
                                יציאה
                            </button>
                        </nav>
                    </div>
                </div>
            </header>

            <main className="relative z-10 shop-main">
                <div className="container mx-auto px-6 py-8">
                    {shopStatus === 'closed' ? (
                        // Shop Closed State - Show products but disable ordering
                        <div className="shop-closed-state">
                            <div className="closed-header">
                                <div className="closed-icon">🔒</div>
                                <h1 className="closed-title">{shopSettings.closedTitle}</h1>
                                <p className="closed-message">
                                    {shopSettings.closedMessage.split('\n').map((line, index) => (
                                        <span key={index}>
                                            {line}
                                            {index < shopSettings.closedMessage.split('\n').length - 1 && <br />}
                                        </span>
                                    ))}
                                </p>
                                <div className="closed-info">
                                    <h3 className="how-it-works-heading">איך זה עובד?</h3>
                                    <ul>
                                        {shopSettings.closedInstructions.map((instruction, index) => (
                                            <li key={index}>{instruction}</li>
                                        ))}
                                    </ul>
                                </div>
                                <button 
                                    onClick={fetchGroupOrders}
                                    className="btn-primary refresh-btn"
                                    disabled={groupOrdersLoading}
                                >
                                    {groupOrdersLoading ? 'בודק...' : 'בדוק שוב'}
                                </button>
                            </div>
                            
                            {/* Products catalog - visible but not orderable */}
                            <section className="products-catalog-closed">
                                <div className="section-header">
                                    <h2 className="section-title">קטלוג המוצרים שלנו</h2>
                                    <p className="section-subtitle">עיין במוצרים הזמינים - ההזמנה תתאפשר כשתיפתח הזמנה קבוצתית</p>
                                </div>
                                
                                {productsLoading ? (
                                    <div className="loading-state">
                                        <div className="spinner"></div>
                                        <p>טוען מוצרים...</p>
                                    </div>
                                ) : products.length > 0 ? (
                                    <div className="products-grid products-disabled">
                                        {products.map((product) => (
                                            <div key={product.id} className="product-card disabled">
                                                <div className="product-image">
                                                    {product.image_url ? (
                                                        <img 
                                                            src={product.image_url} 
                                                            alt={product.name}
                                                            onError={(e) => {
                                                                e.target.style.display = 'none';
                                                                e.target.nextSibling.style.display = 'flex';
                                                            }}
                                                        />
                                                    ) : null}
                                                    <div 
                                                        className="product-placeholder"
                                                        style={{display: product.image_url ? 'none' : 'flex'}}
                                                    >
                                                        💨
                                                    </div>
                                                    <div className="disabled-overlay">
                                                        <span>לא זמין להזמנה</span>
                                                    </div>
                                                </div>
                                                
                                                <div className="product-info">
                                                    <h3 className="product-name">{product.name}</h3>
                                                    {product.description && (
                                                        <p className="product-description">{product.description}</p>
                                                    )}
                                                    <div className="product-price">₪{product.price}</div>
                                                </div>
                                                
                                                <div className="product-actions">
                                                    <button className="btn-disabled" disabled>
                                                        חנות סגורה
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="empty-state">
                                        <div className="empty-icon">📦</div>
                                        <p>אין מוצרים זמינים כרגע</p>
                                    </div>
                                )}
                            </section>
                        </div>
                    ) : (
                        // Shop Open State
                        <div className="shop-content">
                            {/* Active Group Orders */}
                            <section className="group-orders-section">
                                <div className="section-header">
                                    <h2 className="section-title">הזמנות קבוצתיות פעילות</h2>
                                    <p className="section-subtitle">בחר הזמנה קבוצתית להשתתפות</p>
                                </div>
                                
                                {groupOrdersLoading ? (
                                    <div className="loading-state">
                                        <div className="spinner"></div>
                                        <p>טוען הזמנות קבוצתיות...</p>
                                    </div>
                                ) : (
                                    <div className="group-orders-grid">
                                        {groupOrders.map((order) => (
                                            <div 
                                                key={order.id} 
                                                className={`group-order-card ${selectedOrder?.id === order.id ? 'selected' : ''} ${order.user_participating ? 'participating' : ''} ${order.status === 'scheduled' ? 'scheduled' : ''}`}
                                                onClick={() => order.status === 'open' ? handleSelectOrder(order) : null}
                                                style={{ cursor: order.status === 'scheduled' ? 'not-allowed' : 'pointer' }}
                                            >
                                                <div className="order-header">
                                                    <h3 className="order-title">{order.title}</h3>
                                                    <div className="order-badges">
                                                        {order.status === 'scheduled' && (
                                                            <span className="status-badge scheduled">מתוזמן</span>
                                                        )}
                                                        {order.user_participating && (
                                                            <span className="participation-badge">משתתף</span>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                {order.description && (
                                                    <p className="order-description">{order.description}</p>
                                                )}
                                                
                                                {order.status === 'scheduled' && order.opening_time ? (
                                                    <div className="scheduled-info">
                                                        <strong>יפתח ב:</strong> {new Date(order.opening_time).toLocaleDateString('he-IL', {
                                                            weekday: 'short',
                                                            month: 'short',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div className="order-stats">
                                                        <div className="stat">
                                                            <span className="stat-label">משתתפים:</span>
                                                            <span className="stat-value">{order.total_participants}</span>
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                <div className="order-timing">
                                                    {order.status === 'scheduled' ? (
                                                        <div className="scheduled-status">
                                                            <span>הזמנה מתוזמנת - עדיין לא פתוחה להשתתפות</span>
                                                        </div>
                                                    ) : (
                                                        <div className={`time-remaining ${order.is_ending_soon ? 'urgent' : ''}`}>
                                                            {order.days_remaining > 0 ? (
                                                                order.hours_remaining > 0 ? (
                                                                    <span>נותרו {order.days_remaining} ימים, {order.hours_remaining} שעות ו-{order.minutes_remaining} דקות</span>
                                                                ) : (
                                                                    <span>נותרו {order.days_remaining} ימים ו-{order.minutes_remaining} דקות</span>
                                                                )
                                                            ) : order.hours_remaining > 0 ? (
                                                                <span>נותרו {order.hours_remaining} שעות ו-{order.minutes_remaining} דקות</span>
                                                            ) : order.minutes_remaining > 0 ? (
                                                                <span>נותרו {order.minutes_remaining} דקות</span>
                                                            ) : (
                                                                <span>ההזמנה תיסגר בקרוב</span>
                                                            )}
                                                        </div>
                                                    )}
                                                    
                                                    <div className="deadline">
                                                        נסגרת: {new Date(order.deadline).toLocaleDateString('he-IL', {
                                                            weekday: 'short',
                                                            month: 'short',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </div>
                                                </div>
                                                
                                                {order.user_participating && order.status === 'open' && (
                                                    <div className="user-participation">
                                                        <div className="participation-actions">
                                                            <button 
                                                                className="btn-view-order"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleViewUserOrder(order);
                                                                }}
                                                            >
                                                                👁️ צפה בהזמנה
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {order.status === 'scheduled' && (
                                                    <div className="scheduled-notice">
                                                        ההזמנה תיפתח אוטומטית בזמן המתוזמן
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>

                            {/* Product Selection */}
                            {selectedOrder && selectedOrder.status === 'open' && (
                                <section className="products-section">
                                    <div className="section-header">
                                        <h2 className="section-title">
                                            בחירת מוצרים להזמנה: {selectedOrder.title}
                                        </h2>
                                        <div className="cart-summary">
                                            <span className="cart-items">{getCartItemsCount()} פריטים</span>
                                            <span className="cart-total">₪{calculateCartTotal()}</span>
                                            {Object.keys(cart).length > 0 && (
                                                <button 
                                                    onClick={() => setShowParticipateModal(true)}
                                                    className="btn-primary participate-btn"
                                                >
                                                    השתתף בהזמנה
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {productsLoading ? (
                                        <div className="loading-state">
                                            <div className="spinner"></div>
                                            <p>טוען מוצרים...</p>
                                        </div>
                                    ) : products.length > 0 ? (
                                        <div className="products-grid">
                                            {products.map((product) => (
                                                <div key={product.id} className="product-card">
                                                    <div className="product-image">
                                                        {product.image_url ? (
                                                            <img 
                                                                src={product.image_url} 
                                                                alt={product.name}
                                                                onError={(e) => {
                                                                    e.target.style.display = 'none';
                                                                    e.target.nextSibling.style.display = 'flex';
                                                                }}
                                                            />
                                                        ) : null}
                                                        <div 
                                                            className="product-placeholder"
                                                            style={{display: product.image_url ? 'none' : 'flex'}}
                                                        >
                                                            💨
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="product-info">
                                                        <h3 className="product-name">{product.name}</h3>
                                                        {product.description && (
                                                            <p className="product-description">{product.description}</p>
                                                        )}
                                                        <div className="product-price">₪{product.price}</div>
                                                    </div>
                                                    
                                                    <div className="product-actions">
                                                        {cart[product.id] ? (
                                                            <div className="quantity-controls">
                                                                <button 
                                                                    onClick={() => handleQuantityChange(product.id, cart[product.id] - 1)}
                                                                    className="quantity-btn"
                                                                >
                                                                    -
                                                                </button>
                                                                <span className="quantity">{cart[product.id]}</span>
                                                                <button 
                                                                    onClick={() => handleQuantityChange(product.id, cart[product.id] + 1)}
                                                                    className="quantity-btn"
                                                                >
                                                                    +
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleRemoveFromCart(product.id)}
                                                                    className="remove-btn"
                                                                    title="הסר מהעגלה"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button 
                                                                onClick={() => handleAddToCart(product.id)}
                                                                className="btn-secondary"
                                                            >
                                                                הוסף להזמנה
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="empty-state">
                                            <div className="empty-icon">📦</div>
                                            <p>אין מוצרים זמינים כרגע</p>
                                        </div>
                                    )}
                                </section>
                            )}
                        </div>
                    )}
                </div>
            </main>

            {/* Participate Modal */}
            {showParticipateModal && (
                <div className="modal-overlay" onClick={() => setShowParticipateModal(false)}>
                    <div className="modal participate-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>אישור השתתפות בהזמנה קבוצתית</h3>
                            <button 
                                className="modal-close"
                                onClick={() => setShowParticipateModal(false)}
                            >
                                ✕
                            </button>
                        </div>
                        
                        <div className="modal-content">
                            <div className="order-info">
                                <h4>הזמנה: {selectedOrder?.title}</h4>
                                <p>תאריך סגירה: {new Date(selectedOrder?.deadline).toLocaleDateString('he-IL', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}</p>
                            </div>
                            
                            <div className="cart-items">
                                <h4>הפריטים שלך:</h4>
                                {Object.entries(cart).map(([productId, quantity]) => {
                                    const product = products.find(p => p.id === productId);
                                    if (!product) return null;
                                    
                                    return (
                                        <div key={productId} className="cart-item">
                                            <span className="item-name">{product.name}</span>
                                            <span className="item-quantity">כמות: {quantity}</span>
                                            <span className="item-total">₪{product.price * quantity}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            
                            <div className="total-summary">
                                <div className="total-line">
                                    <span>סה&quot;כ פריטים: {getCartItemsCount()}</span>
                                </div>
                                <div className="total-line main">
                                    <span>סה&quot;כ לתשלום: ₪{calculateCartTotal()}</span>
                                </div>
                            </div>
                            
                            <div className="participation-note">
                                <p>⚠️ לאחר האישור, ההשתתפות שלך תישמר במערכת</p>
                                <p>📧 תקבל התראות על מצב ההזמנה באימייל</p>
                            </div>
                        </div>
                        
                        <div className="modal-actions">
                            <button 
                                onClick={() => setShowParticipateModal(false)}
                                className="btn-secondary"
                            >
                                ביטול
                            </button>
                            <button 
                                onClick={handleParticipate}
                                className="btn-primary"
                                disabled={participateLoading}
                            >
                                {participateLoading ? 'משתתף...' : 'אשר השתתפות'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* User Order Details Modal */}
            {showUserOrderModal && selectedUserOrder && (
                <div className="modal-overlay" onClick={() => setShowUserOrderModal(false)}>
                    <div className="modal-content user-order-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>פרטי ההשתתפות שלך</h2>
                            <button 
                                onClick={() => setShowUserOrderModal(false)}
                                className="close-btn"
                            >
                                ✕
                            </button>
                        </div>
                        
                        <div className="modal-body">
                            <div className="order-info">
                                <h3>{selectedUserOrder.title}</h3>
                                <p>{selectedUserOrder.description}</p>
                                <div className="deadline-info">
                                    <strong>תאריך סגירה: </strong>
                                    {new Date(selectedUserOrder.deadline).toLocaleDateString('he-IL', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </div>
                            </div>

                            {selectedUserOrder.participation && selectedUserOrder.participation.items && (
                                <div className="user-items">
                                    <h4>המוצרים שהזמנת:</h4>
                                    <div className="items-list">
                                        {selectedUserOrder.participation.items.map((item, index) => (
                                            <div key={index} className="item-row">
                                                <div className="item-details">
                                                    <div className="item-name">{item.products?.name || 'מוצר לא ידוע'}</div>
                                                    {item.products?.description && (
                                                        <div className="item-description">{item.products.description}</div>
                                                    )}
                                                </div>
                                                <div className="item-quantity">כמות: {item.quantity}</div>
                                                <div className="item-price">₪{item.products?.price || 0} × {item.quantity}</div>
                                                <div className="item-total">₪{(item.products?.price || 0) * item.quantity}</div>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    <div className="order-total">
                                        <strong>סה"כ להשתתפות: ₪{selectedUserOrder.participation.total_amount}</strong>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="modal-actions">
                            <button 
                                onClick={() => setShowUserOrderModal(false)}
                                className="btn-secondary"
                            >
                                סגור
                            </button>
                            <button 
                                onClick={() => handleCancelUserOrder(selectedUserOrder.id)}
                                className="btn-danger"
                            >
                                בטל השתתפות
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}