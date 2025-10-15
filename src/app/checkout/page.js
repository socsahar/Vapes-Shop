'use client';

import { useState, useEffect } from 'react';
import { getCurrentUser } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { showToast } from '../../components/Toast';

export default function CheckoutPage() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [cart, setCart] = useState([]);
    const [orderLoading, setOrderLoading] = useState(false);
    const [orderForm, setOrderForm] = useState({
        delivery_address: '',
        phone: '',
        notes: '',
        delivery_method: 'delivery' // delivery or pickup
    });
    const router = useRouter();

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const currentUser = await getCurrentUser();
                if (!currentUser) {
                    router.push('/auth/login');
                    return;
                }
                setUser(currentUser);
                
                // Pre-fill form with user data
                setOrderForm(prev => ({
                    ...prev,
                    phone: currentUser.phone || ''
                }));
                
                loadCart();
                setLoading(false);
            } catch (error) {
                console.error('Error checking auth:', error);
                router.push('/auth/login');
            }
        };
        
        checkAuth();
    }, [router]);

    const loadCart = () => {
        if (typeof window !== 'undefined') {
            const savedCart = localStorage.getItem('cart');
            if (savedCart) {
                try {
                    const cartData = JSON.parse(savedCart);
                    setCart(cartData);
                    if (cartData.length === 0) {
                        router.push('/shop');
                    }
                } catch (error) {
                    console.error('Error loading cart:', error);
                    router.push('/shop');
                }
            } else {
                router.push('/shop');
            }
        }
    };

    const getCartTotal = () => {
        return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    };

    const getCartItemsCount = () => {
        return cart.reduce((total, item) => total + item.quantity, 0);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setOrderForm(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmitOrder = async (e) => {
        e.preventDefault();
        
        if (!orderForm.delivery_address && orderForm.delivery_method === 'delivery') {
            showToast('נא להזין כתובת משלוח', 'warning');
            return;
        }

        if (!orderForm.phone) {
            showToast('נא להזין מספר טלפון', 'warning');
            return;
        }

        try {
            setOrderLoading(true);

            const orderData = {
                items: cart,
                delivery_address: orderForm.delivery_address,
                phone: orderForm.phone,
                notes: orderForm.notes,
                delivery_method: orderForm.delivery_method,
                total_amount: getCartTotal()
            };

            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(orderData),
            });

            if (response.ok) {
                const result = await response.json();
                
                // Clear cart
                localStorage.removeItem('cart');
                
                // Redirect to order confirmation
                router.push(`/orders/${result.order.id}`);
            } else {
                const error = await response.json();
                showToast(error.error || 'שגיאה בהגשת ההזמנה', 'error');
            }
        } catch (error) {
            console.error('Order submission error:', error);
            showToast('שגיאה בהגשת ההזמנה', 'error');
        } finally {
            setOrderLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            {/* Background */}
            <div className="fixed inset-0 bg-gradient-cosmic"></div>
            <div className="fixed inset-0 bg-pattern opacity-10"></div>
            
            {/* Floating particles */}
            <div className="floating-particles">
                {Array.from({ length: 20 }).map((_, i) => (
                    <div key={i} className="particle"></div>
                ))}
            </div>

            {/* Header */}
            <header className="relative z-10 glass-card border-b border-primary/20">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <Link href="/shop" className="flex items-center space-x-2 space-x-reverse text-primary hover:text-primary-light transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            <span>חזרה לחנות</span>
                        </Link>
                        
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-light to-secondary bg-clip-text text-transparent">
                            סיום הזמנה
                        </h1>
                        
                        <div className="w-20"></div> {/* Spacer */}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="relative z-10 container mx-auto px-4 py-8">
                <div className="max-w-4xl mx-auto">
                    <div className="checkout-form grid-cols-1 lg:grid-cols-2 gap-8">
                        
                        {/* Order Form */}
                        <div className="glass-card p-6 border border-primary/20">
                            <h2 className="text-xl font-bold mb-6">פרטי הזמנה</h2>
                            
                            <form onSubmit={handleSubmitOrder} className="space-y-6">
                                {/* Delivery Method */}
                                <div>
                                    <label className="block text-sm font-medium mb-3">שיטת קבלה</label>
                                    <div className="delivery-options grid-cols-2 gap-4">
                                        <button
                                            type="button"
                                            onClick={() => setOrderForm(prev => ({ ...prev, delivery_method: 'delivery' }))}
                                            className={`delivery-option p-4 rounded-lg border-2 transition-all ${
                                                orderForm.delivery_method === 'delivery'
                                                    ? 'border-primary bg-primary/10 text-primary'
                                                    : 'border-gray-600 hover:border-gray-500'
                                            }`}
                                        >
                                            <div className="text-center">
                                                <svg className="w-6 h-6 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                                </svg>
                                                <span>משלוח</span>
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setOrderForm(prev => ({ ...prev, delivery_method: 'pickup' }))}
                                            className={`delivery-option p-4 rounded-lg border-2 transition-all ${
                                                orderForm.delivery_method === 'pickup'
                                                    ? 'border-primary bg-primary/10 text-primary'
                                                    : 'border-gray-600 hover:border-gray-500'
                                            }`}
                                        >
                                            <div className="text-center">
                                                <svg className="w-6 h-6 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                </svg>
                                                <span>איסוף עצמי</span>
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                {/* Delivery Address */}
                                {orderForm.delivery_method === 'delivery' && (
                                    <div>
                                        <label htmlFor="delivery_address" className="block text-sm font-medium mb-2">
                                            כתובת משלוח *
                                        </label>
                                        <textarea
                                            id="delivery_address"
                                            name="delivery_address"
                                            value={orderForm.delivery_address}
                                            onChange={handleInputChange}
                                            required={orderForm.delivery_method === 'delivery'}
                                            rows={3}
                                            placeholder="הזן כתובת מלאה כולל עיר, רחוב, מספר בית וקומה"
                                            className="w-full px-4 py-3 bg-dark/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary"
                                        />
                                    </div>
                                )}

                                {/* Phone */}
                                <div>
                                    <label htmlFor="phone" className="block text-sm font-medium mb-2">
                                        מספר טלפון *
                                    </label>
                                    <input
                                        type="tel"
                                        id="phone"
                                        name="phone"
                                        value={orderForm.phone}
                                        onChange={handleInputChange}
                                        required
                                        placeholder="050-1234567"
                                        className="w-full px-4 py-3 bg-dark/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary"
                                    />
                                </div>

                                {/* Notes */}
                                <div>
                                    <label htmlFor="notes" className="block text-sm font-medium mb-2">
                                        הערות (אופציונלי)
                                    </label>
                                    <textarea
                                        id="notes"
                                        name="notes"
                                        value={orderForm.notes}
                                        onChange={handleInputChange}
                                        rows={3}
                                        placeholder="הערות נוספות להזמנה..."
                                        className="w-full px-4 py-3 bg-dark/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary"
                                    />
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={orderLoading}
                                    className="w-full btn-primary"
                                >
                                    {orderLoading ? (
                                        <div className="flex items-center justify-center">
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white ml-2"></div>
                                            שולח הזמנה...
                                        </div>
                                    ) : (
                                        'השלם הזמנה'
                                    )}
                                </button>
                            </form>
                        </div>

                        {/* Order Summary */}
                        <div className="order-summary glass-card p-6 border border-primary/20">
                            <h2 className="text-xl font-bold mb-6">סיכום הזמנה</h2>
                            
                            {/* Items */}
                            <div className="space-y-4 mb-6">
                                {cart.map(item => (
                                    <div key={item.id} className="flex items-center space-x-4 space-x-reverse p-4 bg-dark/30 rounded-lg">
                                        <div className="w-12 h-12 bg-dark/50 rounded flex items-center justify-center">
                                            📦
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-sm">{item.name}</h3>
                                            <p className="text-xs text-gray-400">כמות: {item.quantity}</p>
                                        </div>
                                        <div className="text-left">
                                            <div className="text-sm font-semibold">₪{(item.price * item.quantity).toFixed(2)}</div>
                                            <div className="text-xs text-gray-400">₪{item.price} × {item.quantity}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Totals */}
                            <div className="border-t border-gray-600 pt-4 space-y-2">
                                <div className="flex justify-between">
                                    <span>סה&ldquo;כ מוצרים ({getCartItemsCount()}):</span>
                                    <span>₪{getCartTotal().toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>משלוח:</span>
                                    <span>{orderForm.delivery_method === 'delivery' ? '₪15.00' : 'חינם'}</span>
                                </div>
                                <div className="border-t border-gray-600 pt-2">
                                    <div className="flex justify-between text-lg font-bold">
                                        <span>סה&ldquo;כ לתשלום:</span>
                                        <span className="text-primary">
                                            ₪{(getCartTotal() + (orderForm.delivery_method === 'delivery' ? 15 : 0)).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Method Info */}
                            <div className="mt-6 p-4 bg-primary/10 rounded-lg border border-primary/20">
                                <h3 className="font-semibold mb-2 text-primary">💳 תשלום</h3>
                                <p className="text-sm text-gray-300">
                                    התשלום יתבצע במזומן בעת המסירה או האיסוף.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}