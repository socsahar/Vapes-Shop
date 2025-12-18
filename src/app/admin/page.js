'use client';

import React, { useState, useEffect } from 'react';
import { getCurrentUser, signOut, getAuthHeaders } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { showToast } from '../../components/Toast';

// Helper function to format datetime for local input
const formatDateTimeLocalInput = (date) => {
    if (!date) return '';
    
    // Convert UTC date from database to local time for datetime-local input
    const utcDate = new Date(date);
    
    // Adjust for local timezone (accounts for daylight saving time automatically)
    const localDate = new Date(utcDate.getTime() - (utcDate.getTimezoneOffset() * 60000));
    
    // Return in datetime-local format (YYYY-MM-DDTHH:MM)
    return localDate.toISOString().substring(0, 16);
};

export default function AdminPage() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [users, setUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({
        full_name: '',
        username: '',
        email: '',
        phone: '',
        role: 'user'
    });
    const [updateLoading, setUpdateLoading] = useState(false);
    const [resetPasswordLoading, setResetPasswordLoading] = useState(null);
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetUser, setResetUser] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [stats, setStats] = useState({
        users: 0,
        products: 0,
        orders: 0,
        generalOrders: 0,
        revenue: 0
    });
    const [products, setProducts] = useState([]);
    const [productsLoading, setProductsLoading] = useState(false);
    const [showProductModal, setShowProductModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [productForm, setProductForm] = useState({
        name: '',
        description: '',
        price: '',
        category: '',
        image_url: ''
    });
    const [productLoading, setProductLoading] = useState(false);
    const [imagePreview, setImagePreview] = useState('');
    const [showUserOrdersModal, setShowUserOrdersModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userOrders, setUserOrders] = useState([]);
    const [ordersLoading, setOrdersLoading] = useState(false);
    const [recentActivity, setRecentActivity] = useState([]);
    const [activityLoading, setActivityLoading] = useState(false);
    const [activitySilentRefresh, setActivitySilentRefresh] = useState(false);
    const [lastRefresh, setLastRefresh] = useState(null);
    const [generalOrders, setGeneralOrders] = useState([]);
    const [generalOrdersLoading, setGeneralOrdersLoading] = useState(false);
    const [allOrders, setAllOrders] = useState([]);
    const [allOrdersLoading, setAllOrdersLoading] = useState(false);
    const [expandedOrders, setExpandedOrders] = useState(new Set());
    const [showGeneralOrderModal, setShowGeneralOrderModal] = useState(false);
    const [editingGeneralOrder, setEditingGeneralOrder] = useState(null);
    const [generalOrderForm, setGeneralOrderForm] = useState({
        title: '',
        description: '',
        deadline: '',
        opening_time: '',
        schedule_opening: false
    });
    const [generalOrderLoading, setGeneralOrderLoading] = useState(false);
    const [autoCloseLoading, setAutoCloseLoading] = useState(false);
    const [emailTestLoading, setEmailTestLoading] = useState(false);
    const [testOrderId, setTestOrderId] = useState('');
    const [customEmailTestLoading, setCustomEmailTestLoading] = useState(false);
    const [testEmailAddress, setTestEmailAddress] = useState('');
    const [testEmailType, setTestEmailType] = useState('password_reset');
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [summaryEmailLoading, setSummaryEmailLoading] = useState(null);
    const [emailProgress, setEmailProgress] = useState({ current: 0, total: 0, percentage: 0 });
    // Removed shopSettings, shopSettingsLoading, showShopSettingsModal - no longer needed (using static settings)
    const [systemStatus, setSystemStatus] = useState(null);
    const [systemStatusLoading, setSystemStatusLoading] = useState(false);
    const [statusRefreshInterval, setStatusRefreshInterval] = useState(null);
    const [manualCronLoading, setManualCronLoading] = useState(false);
    
    // WhatsApp Settings State
    const [whatsappUrl, setWhatsappUrl] = useState('');
    const [whatsappUrlLoading, setWhatsappUrlLoading] = useState(false);
    const [whatsappUrlSaving, setWhatsappUrlSaving] = useState(false);
    
    // Visitor Stats State
    const [visitorStats, setVisitorStats] = useState({ total: 0, today: 0, thisWeek: 0, thisMonth: 0 });
    const [visitorStatsLoading, setVisitorStatsLoading] = useState(false);
    
    // Notifications State
    const [notifications, setNotifications] = useState([]);
    const [notificationsLoading, setNotificationsLoading] = useState(false);
    const [notificationStats, setNotificationStats] = useState({});
    const [showNotificationModal, setShowNotificationModal] = useState(false);
    const [notificationForm, setNotificationForm] = useState({
        title: '',
        message: '',
        audience: 'all',
        userIds: [],
        scheduledAt: '',
        icon: '',
        image: '',
        url: '',
        template: ''
    });
    const [notificationTemplates, setNotificationTemplates] = useState([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [availableUsers, setAvailableUsers] = useState([]);
    const [usersForNotificationLoading, setUsersForNotificationLoading] = useState(false);
    const [sendNotificationLoading, setSendNotificationLoading] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    
    // Confirmation Modal State
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmAction, setConfirmAction] = useState(null);
    const [confirmTitle, setConfirmTitle] = useState('');
    const [confirmMessage, setConfirmMessage] = useState('');
    const [confirmButtonText, setConfirmButtonText] = useState('אישור');
    const [confirmButtonClass, setConfirmButtonClass] = useState('admin-btn-primary');
    
    const router = useRouter();

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const currentUser = await getCurrentUser();
                if (!currentUser) {
                    router.push('/auth/login');
                    return;
                }
                if (currentUser.role !== 'admin') {
                    router.push('/shop');
                    return;
                }
                setUser(currentUser);
                setLoading(false);
            } catch (error) {
                console.error('Error checking auth:', error);
                router.push('/auth/login');
            }
        };
        
        checkAuth();
    }, [router]);

    const handleLogout = async () => {
        await signOut();
        router.push('/');
    };

    const toggleMobileNav = () => {
        setMobileNavOpen(!mobileNavOpen);
    };

    const closeMobileNav = () => {
        setMobileNavOpen(false);
    };

    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        closeMobileNav(); // Close mobile nav when tab changes
    };

    const fetchUsers = async () => {
        try {
            setUsersLoading(true);
            const response = await fetch('/api/admin/users');
            if (response.ok) {
                const data = await response.json();
                setUsers(data.users || []);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setUsersLoading(false);
        }
    };

    const fetchVisitorStats = async () => {
        try {
            setVisitorStatsLoading(true);
            const response = await fetch('/api/admin/visitor-stats');
            if (response.ok) {
                const data = await response.json();
                setVisitorStats(data);
            }
        } catch (error) {
            console.error('Error fetching visitor stats:', error);
        } finally {
            setVisitorStatsLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            console.log('[ADMIN] Fetching stats...');
            const response = await fetch('/api/admin/stats');
            if (response.ok) {
                const data = await response.json();
                console.log('[ADMIN] Stats received:', data);
                setStats(data);
            } else {
                console.error('[ADMIN] Stats fetch failed:', response.status);
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const fetchRecentActivity = async (showLoader = true) => {
        try {
            // Prevent any scroll behavior during refresh
            const currentScrollTop = window.scrollY || document.documentElement.scrollTop;
            
            if (showLoader) {
                setActivityLoading(true);
            } else {
                setActivitySilentRefresh(true);
            }
            
            const response = await fetch('/api/admin/activity');
            console.log('Activity API response status:', response.status);
            if (response.ok) {
                const data = await response.json();
                console.log('Activity API response data:', data);
                
                // Add a small delay for smoother transition only for manual refresh
                if (showLoader) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
                
                setRecentActivity(data.activities || data || []);
                setLastRefresh(new Date().toLocaleTimeString('he-IL'));
                
                // Maintain scroll position after refresh
                window.scrollTo(0, currentScrollTop);
            } else {
                console.error('Activity API error:', response.status, response.statusText);
                setRecentActivity([{
                    type: 'system',
                    description: 'שגיאה בטעינת פעילות אחרונה',
                    time: 'כעת',
                    status: 'error'
                }]);
            }
        } catch (error) {
            console.error('Error fetching activity:', error);
            setRecentActivity([{
                type: 'system',
                description: 'שגיאה בחיבור לשרת',
                time: 'כעת',
                status: 'error'
            }]);
        } finally {
            if (showLoader) {
                setActivityLoading(false);
            } else {
                setActivitySilentRefresh(false);
            }
        }
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

    const handleAddProduct = () => {
        setEditingProduct(null);
        setProductForm({
            name: '',
            description: '',
            price: '',
            category: '',
            image_url: ''
        });
        setImagePreview('');
        setShowProductModal(true);
    };

    const handleEditProduct = (product) => {
        setEditingProduct(product);
        setProductForm({
            name: product.name || '',
            description: product.description || '',
            price: product.price || '',
            category: product.category || '',
            image_url: product.image_url || ''
        });
        setImagePreview(product.image_url || '');
        setShowProductModal(true);
    };

    const handleCloseProductModal = () => {
        setShowProductModal(false);
        setEditingProduct(null);
        setProductForm({
            name: '',
            description: '',
            price: '',
            image_url: ''
        });
        setImagePreview('');
    };

    const handleProductFormChange = (e) => {
        const { name, value } = e.target;
        setProductForm(prev => ({
            ...prev,
            [name]: value
        }));

        // Update image preview when URL changes
        if (name === 'image_url') {
            setImagePreview(value);
        }
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Create a preview URL
            const previewUrl = URL.createObjectURL(file);
            setImagePreview(previewUrl);
            
            // For this implementation, we'll use a simple approach
            // In production, you'd upload to a cloud service like Supabase Storage, AWS S3, etc.
            // For now, we'll let users enter image URLs manually
            showToast('להעלאה מלאה של תמונות נדרש שירות אחסון נוסף. נא להכניס כתובת URL של התמונה בשדה "קישור לתמונה"', 'warning');
        }
    };

    const handleSubmitProduct = async (e) => {
        e.preventDefault();
        if (!productForm.name || !productForm.price) {
            showToast('נא למלא את כל השדות הנדרשים (שם ומחיר)', 'warning');
            return;
        }

        try {
            setProductLoading(true);
            const method = editingProduct ? 'PUT' : 'POST';
            const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
            
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(productForm)
            });

            if (response.ok) {
                await fetchProducts(); // Refresh the products list
                handleCloseProductModal();
                showToast(editingProduct ? 'המוצר עודכן בהצלחה!' : 'המוצר נוסף בהצלחה!', 'success');
            } else {
                const error = await response.json();
                showToast(`שגיאה: ${error.error}`, 'error');
            }
        } catch (error) {
            console.error('Error saving product:', error);
            showToast('שגיאה בשמירת המוצר', 'error');
        } finally {
            setProductLoading(false);
        }
    };

    const showConfirmation = (title, message, onConfirm, buttonText = 'אישור', buttonClass = 'admin-btn-primary') => {
        setConfirmTitle(title);
        setConfirmMessage(message);
        setConfirmAction(() => onConfirm);
        setConfirmButtonText(buttonText);
        setConfirmButtonClass(buttonClass);
        setShowConfirmModal(true);
    };

    const handleConfirmAction = async () => {
        setShowConfirmModal(false);
        if (confirmAction) {
            await confirmAction();
        }
    };

    const handleToggleProductStatus = async (product) => {
        const newStatus = !product.is_active;
        const action = newStatus ? 'להפעיל' : 'להשהות';
        
        showConfirmation(
            `${action} מוצר`,
            `האם אתה בטוח שברצונך ${action} את המוצר "${product.name}"?`,
            async () => {
                try {
                    const response = await fetch(`/api/products/${product.id}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ is_active: newStatus })
                    });

                    if (response.ok) {
                        await fetchProducts();
                        showToast(newStatus ? 'המוצר הופעל בהצלחה!' : 'המוצר הושהה בהצלחה!', 'success');
                    } else {
                        const error = await response.json();
                        showToast(`שגיאה בעדכון סטטוס המוצר: ${error.error}`, 'error');
                    }
                } catch (error) {
                    console.error('Error toggling product status:', error);
                    showToast('שגיאה בעדכון סטטוס המוצר', 'error');
                }
            },
            newStatus ? 'הפעל' : 'השהה',
            newStatus ? 'admin-btn-primary' : 'bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold transition-all'
        );
    };

    const handleDeleteProduct = async (productId, productName) => {
        showConfirmation(
            'מחיקת מוצר',
            `האם אתה בטוח שברצונך למחוק את המוצר "${productName}"? פעולה זו אינה ניתנת לביטול!`,
            async () => {
                try {
                    const response = await fetch(`/api/products/${productId}`, {
                        method: 'DELETE'
                    });

                    if (response.ok) {
                        await fetchProducts();
                        showToast('המוצר נמחק בהצלחה!', 'success');
                    } else {
                        const error = await response.json();
                        showToast(`שגיאה במחיקת המוצר: ${error.error}`, 'error');
                    }
                } catch (error) {
                    console.error('Error deleting product:', error);
                    showToast('שגיאה במחיקת המוצר', 'error');
                }
            },
            'מחק',
            'bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-bold transition-all'
        );
    };

    const handleDeleteUser = async (userId, userRole, userName) => {
        if (!confirm(`האם אתה בטוח שברצונך למחוק את המשתמש "${userName}"? פעולה זו אינה ניתנת לביטול!`)) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (response.ok) {
                await fetchUsers(); // Refresh the users list
                showToast('המשתמש נמחק בהצלחה!', 'success');
            } else {
                showToast(`שגיאה במחיקת המשתמש: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            showToast('שגיאה במחיקת המשתמש', 'error');
        }
    };

    const handleViewUserOrders = async (user) => {
        setSelectedUser(user);
        setShowUserOrdersModal(true);
        setOrdersLoading(true);
        
        try {
            const response = await fetch(`/api/admin/users/${user.id}/orders`);
            if (response.ok) {
                const data = await response.json();
                setUserOrders(data.orders || []);
            } else {
                console.error('Failed to fetch user orders');
                setUserOrders([]);
            }
        } catch (error) {
            console.error('Error fetching user orders:', error);
            setUserOrders([]);
        } finally {
            setOrdersLoading(false);
        }
    };

    const handleCloseUserOrdersModal = () => {
        setShowUserOrdersModal(false);
        setSelectedUser(null);
        setUserOrders([]);
    };

    const handleEditUser = (user) => {
        setEditingUser(user);
        setEditForm({
            full_name: user.full_name || '',
            username: user.username || '',
            email: user.email || '',
            phone: user.phone || '',
            role: user.role || 'user'
        });
        setShowEditModal(true);
    };

    const handleCloseEditModal = () => {
        setShowEditModal(false);
        setEditingUser(null);
        setEditForm({
            full_name: '',
            username: '',
            email: '',
            phone: '',
            role: 'user'
        });
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setEditForm(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        if (!editingUser) return;

        try {
            setUpdateLoading(true);
            const response = await fetch(`/api/admin/users/${editingUser.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(editForm)
            });

            if (response.ok) {
                // Update the user in the local state
                setUsers(prev => prev.map(user => 
                    user.id === editingUser.id 
                        ? { ...user, ...editForm }
                        : user
                ));
                handleCloseEditModal();
                // Optionally show success message
            } else {
                console.error('Failed to update user');
                // Optionally show error message
            }
        } catch (error) {
            console.error('Error updating user:', error);
        } finally {
            setUpdateLoading(false);
        }
    };

    const handleResetPassword = (user) => {
        setResetUser(user);
        // Generate a random temporary password
        const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
        setNewPassword(tempPassword);
        setShowResetModal(true);
    };

    const confirmResetPassword = async () => {
        if (!resetUser || !newPassword) return;

        try {
            setResetPasswordLoading(resetUser.id);
            const response = await fetch(`/api/admin/users/${resetUser.id}/reset-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    newPassword,
                    forceChange: true,
                    sendEmail: true,
                    userEmail: resetUser.email,
                    userName: resetUser.full_name
                })
            });

            const result = await response.json();

            if (response.ok) {
                setShowResetModal(false);
                setResetUser(null);
                setNewPassword('');
                // Show success message
                showToast(`הסיסמה אופסה בהצלחה!\nאימייל נשלח ל: ${resetUser.email}`, 'success');
            } else {
                console.error('Failed to reset password:', result.error);
                showToast(`שגיאה באיפוס הסיסמה: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error resetting password:', error);
            showToast('שגיאה באיפוס הסיסמה', 'error');
        } finally {
            setResetPasswordLoading(null);
        }
    };

    const handleCloseResetModal = () => {
        setShowResetModal(false);
        setResetUser(null);
        setNewPassword('');
    };

    // General Orders Functions
    const fetchGeneralOrders = async () => {
        setGeneralOrdersLoading(true);
        try {
            const response = await fetch('/api/admin/general-orders');
            if (response.ok) {
                const data = await response.json();
                // Fix: API returns { orders: [...] }, not the array directly
                setGeneralOrders(data.orders || []);
                console.log('Fetched general orders:', data.orders?.length || 0, 'orders');
            } else {
                console.error('Failed to fetch general orders');
            }
        } catch (error) {
            console.error('Error fetching general orders:', error);
        } finally {
            setGeneralOrdersLoading(false);
        }
    };

    // All Orders Functions
    const fetchAllOrders = async () => {
        setAllOrdersLoading(true);
        try {
            const response = await fetch('/api/admin/orders');
            if (response.ok) {
                const data = await response.json();
                setAllOrders(data.orders || []);
                console.log('Fetched all orders:', data.orders?.length || 0, 'orders');
            } else {
                console.error('Failed to fetch all orders');
            }
        } catch (error) {
            console.error('Error fetching all orders:', error);
        } finally {
            setAllOrdersLoading(false);
        }
    };

    const handleViewOrderDetails = (order) => {
        // Toggle order expansion
        const newExpandedOrders = new Set(expandedOrders);
        if (newExpandedOrders.has(order.id)) {
            newExpandedOrders.delete(order.id);
        } else {
            newExpandedOrders.add(order.id);
        }
        setExpandedOrders(newExpandedOrders);
    };

    const handleUpdateOrderStatus = (order) => {
        // TODO: Implement status update modal
        showToast(`עדכון סטטוס עבור הזמנה #${order.id.slice(0, 8)}\nסטטוס נוכחי: ${order.status}`, 'info');
    };

    const handleDeleteOrder = async (order) => {
        if (!confirm(`❌ האם אתה בטוח שברצונך למחוק את ההזמנה של ${order.user?.full_name}?\n\nפעולה זו אינה ניתנת לביטול!`)) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/orders/${order.id}`, {
                method: 'DELETE',
                headers: await getAuthHeaders()
            });

            if (response.ok) {
                showToast('ההזמנה נמחקה בהצלחה! ✅', 'success');
                fetchAllOrders();
            } else {
                const error = await response.json();
                showToast(`שגיאה במחיקת ההזמנה: ${error.error}`, 'error');
            }
        } catch (error) {
            console.error('Error deleting order:', error);
            showToast('שגיאה במחיקת ההזמנה', 'error');
        }
    };

    // PDF Generation Functions
    const handleGenerateAdminPDF = async (order) => {
        try {
            setGeneralOrderLoading(true);
            
            const response = await fetch('/api/admin/generate-pdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    orderId: order.id,
                    reportType: 'admin'
                })
            });

            if (response.ok) {
                // Get the PDF blob
                const blob = await response.blob();
                
                // Create download link
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                
                // Format filename with date
                const date = new Date(order.deadline).toISOString().slice(0, 19).replace(/:/g, '-');
                link.download = `admin_report_${date}.pdf`;
                
                // Trigger download
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                
                showToast('דוח מנהל נוצר בהצלחה!', 'success');
            } else {
                const error = await response.json();
                showToast(`שגיאה ביצירת דוח מנהל: ${error.error}`, 'error');
            }
        } catch (error) {
            console.error('Error generating admin PDF:', error);
            showToast('שגיאה ביצירת דוח מנהל', 'error');
        } finally {
            setGeneralOrderLoading(false);
        }
    };

    const handleGenerateSupplierPDF = async (order) => {
        try {
            setGeneralOrderLoading(true);
            
            const response = await fetch('/api/admin/generate-pdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    orderId: order.id,
                    reportType: 'supplier'
                })
            });

            if (response.ok) {
                // Get the PDF blob
                const blob = await response.blob();
                
                // Create download link
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                
                // Format filename with date
                const date = new Date(order.deadline).toISOString().slice(0, 19).replace(/:/g, '-');
                link.download = `supplier_report_${date}.pdf`;
                
                // Trigger download
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                
                showToast('דוח ספק נוצר בהצלחה!', 'success');
            } else {
                const error = await response.json();
                showToast(`שגיאה ביצירת דוח ספק: ${error.error}`, 'error');
            }
        } catch (error) {
            console.error('Error generating supplier PDF:', error);
            showToast('שגיאה ביצירת דוח ספק', 'error');
        } finally {
            setGeneralOrderLoading(false);
        }
    };

    const handleSendSummaryEmail = async (order) => {
        if (!confirm(`האם אתה בטוח שברצונך לשלוח אימייל סיכום למנהלים עבור הזמנה: "${order.title}"?\n\nהאימייל יכלול את שני הדוחות PDF (מנהל וספק).`)) {
            return;
        }

        try {
            setSummaryEmailLoading(order.id);
            setEmailProgress({ current: 0, total: 0, percentage: 0 });
            
            // First, let's get the number of admins to show proper progress
            const adminResponse = await fetch('/api/admin/users');
            let totalAdmins = 1; // default fallback
            if (adminResponse.ok) {
                const adminData = await adminResponse.json();
                const admins = adminData.users?.filter(user => user.role === 'admin') || [];
                totalAdmins = Math.max(1, admins.length);
            }

            // Set initial progress
            setEmailProgress({ current: 0, total: totalAdmins, percentage: 0 });

            // Simulate progress during PDF generation (first 30%)
            let currentProgress = 0;
            const progressInterval = setInterval(() => {
                if (currentProgress < 30) {
                    currentProgress += 2;
                    setEmailProgress(prev => ({ 
                        ...prev, 
                        percentage: currentProgress 
                    }));
                }
            }, 100);

            const response = await fetch('/api/admin/send-summary-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    orderId: order.id
                })
            });

            clearInterval(progressInterval);

            const result = await response.json();

            if (response.ok) {
                // Show completion progress with real numbers
                const finalProgress = {
                    current: result.recipients || 0,
                    total: result.totalAdmins || totalAdmins,
                    percentage: result.totalAdmins > 0 ? Math.round(((result.recipients || 0) / result.totalAdmins) * 100) : 100
                };
                
                setEmailProgress(finalProgress);
                
                // Keep progress visible for 3 seconds before clearing
                setTimeout(() => {
                    setEmailProgress({ current: 0, total: 0, percentage: 0 });
                }, 3000);

                if (result.failedSends && result.failedSends.length > 0) {
                    showToast(`📧 אימיילים נשלחו ל-${result.recipients} מנהלים\n❌ ${result.failedSends.length} נכשלו: ${result.failedSends.map(f => f.name).join(', ')}`, 'warning');
                } else {
                    showToast(`✅ אימייל סיכום נשלח בהצלחה ל-${result.recipients} מנהלים!\n📎 כולל ${result.attachments} דוחות PDF`, 'success');
                }
            } else {
                setEmailProgress({ current: 0, total: 0, percentage: 0 });
                showToast(`❌ שגיאה בשליחת אימייל הסיכום: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error sending summary email:', error);
            setEmailProgress({ current: 0, total: 0, percentage: 0 });
            showToast('❌ שגיאה בשליחת אימייל הסיכום', 'error');
        } finally {
            setSummaryEmailLoading(null);
        }
    };

    const handleCreateGeneralOrder = () => {
        setEditingGeneralOrder(null);
        setGeneralOrderForm({
            title: '',
            description: '',
            deadline: '',
            opening_time: '',
            schedule_opening: false
        });
        setShowGeneralOrderModal(true);
    };

    const handleEditGeneralOrder = (order) => {
        setEditingGeneralOrder(order);
        setGeneralOrderForm({
            title: order.title,
            description: order.description || '',
            deadline: formatDateTimeLocalInput(new Date(order.deadline)),
            opening_time: order.opening_time ? formatDateTimeLocalInput(new Date(order.opening_time)) : '',
            schedule_opening: !!order.opening_time
        });
        setShowGeneralOrderModal(true);
    };

    const handleGeneralOrderFormChange = (e) => {
        const { name, value } = e.target;
        setGeneralOrderForm(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmitGeneralOrder = async (e) => {
        e.preventDefault();
        if (!generalOrderForm.title || !generalOrderForm.deadline) {
            showToast('נא למלא את כל השדות הנדרשים (כותרת ותאריך סגירה)', 'warning');
            return;
        }

        // Validate opening time if scheduled opening is enabled
        if (generalOrderForm.schedule_opening && !generalOrderForm.opening_time) {
            showToast('נא לבחור תאריך ושעת פתיחה עבור הזמנה מתוזמנת', 'warning');
            return;
        }

        // Validate that opening time is before deadline
        if (generalOrderForm.schedule_opening && generalOrderForm.opening_time && generalOrderForm.deadline) {
            const openingTime = new Date(generalOrderForm.opening_time);
            const deadline = new Date(generalOrderForm.deadline);
            if (openingTime >= deadline) {
                showToast('תאריך הפתיחה חייב להיות לפני תאריך הסגירה', 'warning');
                return;
            }
        }

        setGeneralOrderLoading(true);
        try {
            const url = editingGeneralOrder 
                ? `/api/admin/general-orders/${editingGeneralOrder.id}`
                : '/api/admin/general-orders';
            
            const method = editingGeneralOrder ? 'PUT' : 'POST';
            
            const payload = {
                title: generalOrderForm.title,
                description: generalOrderForm.description || null,
                created_by: user.id,
                // Convert local datetime to UTC for storage
                deadline: new Date(generalOrderForm.deadline).toISOString(),
                // Set opening_time to UTC if scheduling, null otherwise
                opening_time: generalOrderForm.schedule_opening && generalOrderForm.opening_time 
                    ? new Date(generalOrderForm.opening_time).toISOString() 
                    : null
            };

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (response.ok) {
                setShowGeneralOrderModal(false);
                fetchGeneralOrders();
                showToast(editingGeneralOrder ? 'הזמנה קבוצתית עודכנה בהצלחה' : 'הזמנה קבוצתית נוצרה בהצלחה', 'success');
            } else {
                showToast(result.error || 'שגיאה בשמירת הזמנה קבוצתית', 'error');
            }
        } catch (error) {
            console.error('Error saving general order:', error);
            showToast('שגיאה בשמירת הזמנה קבוצתית', 'error');
        } finally {
            setGeneralOrderLoading(false);
        }
    };

    const handleCloseGeneralOrder = async (orderId) => {
        if (!confirm('האם אתה בטוח שברצונך לסגור את ההזמנה הקבוצתית?')) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/general-orders/${orderId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: 'closed' })
            });

            if (response.ok) {
                fetchGeneralOrders();
                showToast('הזמנה קבוצתית נסגרה בהצלחה', 'success');
            } else {
                const result = await response.json();
                showToast(result.error || 'שגיאה בסגירת הזמנה קבוצתית', 'error');
            }
        } catch (error) {
            console.error('Error closing general order:', error);
            showToast('שגיאה בסגירת הזמנה קבוצתית', 'error');
        }
    };

    const handleDeleteGeneralOrder = async (orderId) => {
        // Get order details first to show proper warning
        const orderToDelete = generalOrders.find(order => order.id === orderId);
        const participantCount = orderToDelete?.total_orders || 0;
        
        const confirmMessage = participantCount > 0 
            ? `האם אתה בטוח שברצונך למחוק את ההזמנה הקבוצתית?\n\n⚠️ פעולה זו תמחק גם:\n• ${participantCount} הזמנות של משתמשים\n• את כל פריטי ההזמנות\n\nפעולה זו לא ניתנת לביטול!`
            : 'האם אתה בטוח שברצונך למחוק את ההזמנה הקבוצתית? פעולה זו לא ניתנת לביטול.';

        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/general-orders/${orderId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (response.ok) {
                fetchGeneralOrders();
                const deletedCount = result.deletedOrders || 0;
                if (deletedCount > 0) {
                    showToast(`הזמנה קבוצתית נמחקה בהצלחה!\n${deletedCount} הזמנות קשורות נמחקו גם כן.`, 'success');
                } else {
                    alert('הזמנה קבוצתית נמחקה בהצלחה');
                }
            } else {
                alert(result.error || 'שגיאה במחיקת הזמנה קבוצתית');
            }
        } catch (error) {
            console.error('Error deleting general order:', error);
            alert('שגיאה במחיקת הזמנה קבוצתית');
        }
    };

    const handleAutoCloseOrders = async () => {
        if (!confirm('האם אתה בטוח שברצונך לסגור את כל הזמנות הקבוצתיות שחרג תאריך הסגירה שלהן?')) {
            return;
        }

        setAutoCloseLoading(true);

        try {
            const response = await fetch('/api/admin/auto-close', {
                method: 'POST'
            });

            const result = await response.json();

            if (response.ok) {
                fetchGeneralOrders(); // Refresh the orders list
                if (result.closedOrders.length > 0) {
                    alert(`${result.closedOrders.length} הזמנות קבוצתיות נסגרו אוטומטית`);
                } else {
                    alert('לא נמצאו הזמנות פגות תוקף לסגירה');
                }
            } else {
                alert(result.error || 'שגיאה בסגירה אוטומטית');
            }
        } catch (error) {
            console.error('Error in auto-close:', error);
            alert('שגיאה בסגירה אוטומטית');
        } finally {
            setAutoCloseLoading(false);
        }
    };

    const handleTestOrderEmail = async () => {
        if (!testOrderId.trim()) {
            showToast('אנא הזן מספר הזמנה', 'error');
            return;
        }

        setEmailTestLoading(true);

        try {
            const response = await fetch('/api/admin/test-order-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ orderId: testOrderId })
            });

            const result = await response.json();

            if (response.ok) {
                showToast('אימייל נשלח בהצלחה!', 'success');
                setTestOrderId('');
            } else {
                showToast(result.error || 'שגיאה בשליחת האימייל', 'error');
            }
        } catch (error) {
            console.error('Error testing order email:', error);
            showToast('שגיאה בשליחת האימייל', 'error');
        } finally {
            setEmailTestLoading(false);
        }
    };

    const handleTestCustomEmail = async () => {
        if (!testEmailAddress.trim()) {
            showToast('אנא הזן כתובת אימייל', 'error');
            return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(testEmailAddress)) {
            showToast('אנא הזן כתובת אימייל תקינה', 'error');
            return;
        }

        setCustomEmailTestLoading(true);

        try {
            const authHeaders = getAuthHeaders();
            const response = await fetch('/api/admin/test-custom-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders
                },
                body: JSON.stringify({ 
                    email: testEmailAddress,
                    emailType: testEmailType 
                })
            });

            const result = await response.json();

            if (response.ok) {
                showToast(`אימייל ${testEmailType === 'password_reset' ? 'איפוס סיסמה' : 'בדיקה כללי'} נשלח בהצלחה ל-${testEmailAddress}!`, 'success');
                setTestEmailAddress('');
            } else {
                showToast(result.error || 'שגיאה בשליחת האימייל', 'error');
            }
        } catch (error) {
            console.error('Error testing custom email:', error);
            showToast('שגיאה בשליחת האימייל', 'error');
        } finally {
            setCustomEmailTestLoading(false);
        }
    };

    // WhatsApp Settings Functions
    const fetchWhatsappUrl = async () => {
        try {
            setWhatsappUrlLoading(true);
            const response = await fetch('/api/admin/settings/whatsapp-url');
            if (response.ok) {
                const data = await response.json();
                setWhatsappUrl(data.url || '');
            }
        } catch (error) {
            console.error('Error fetching WhatsApp URL:', error);
        } finally {
            setWhatsappUrlLoading(false);
        }
    };

    const saveWhatsappUrl = async () => {
        try {
            setWhatsappUrlSaving(true);
            const response = await fetch('/api/admin/settings/whatsapp-url', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({ url: whatsappUrl })
            });

            const data = await response.json();
            
            if (data.success) {
                showToast('קישור WhatsApp עודכן בהצלחה', 'success');
            } else {
                showToast(data.error || 'שגיאה בעדכון הקישור', 'error');
            }
        } catch (error) {
            console.error('Error saving WhatsApp URL:', error);
            showToast('שגיאה בעדכון הקישור', 'error');
        } finally {
            setWhatsappUrlSaving(false);
        }
    };

    // Shop settings functions removed - using static settings in shop page
    // fetchShopSettings, saveShopSettings, addInstruction, removeInstruction, updateInstruction
    // are no longer needed since shop closure message is now static

    const fetchSystemStatus = async (showLoader = true) => {
        try {
            if (showLoader) {
                setSystemStatusLoading(true);
            }
            
            const response = await fetch('/api/admin/system-status-real');
            if (response.ok) {
                const data = await response.json();
                setSystemStatus(data.status);
            } else {
                console.error('Failed to fetch system status');
                setSystemStatus(null);
            }
        } catch (error) {
            console.error('Error fetching system status:', error);
            setSystemStatus(null);
        } finally {
            if (showLoader) {
                setSystemStatusLoading(false);
            }
        }
    };

    const triggerManualCron = async () => {
        setManualCronLoading(true);
        
        try {
            const response = await fetch('/api/admin/manual-cron', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                setToast({ message: 'Cron job executed successfully!', type: 'success' });
                // Refresh system status to show updated results
                setTimeout(() => fetchSystemStatus(true), 1000);
            } else {
                setToast({ message: `Cron job failed: ${data.error}`, type: 'error' });
            }
        } catch (error) {
            console.error('Error triggering manual cron:', error);
            setToast({ message: 'Failed to trigger cron job', type: 'error' });
        } finally {
            setManualCronLoading(false);
        }
    };

    const startStatusAutoRefresh = () => {
        // Clear existing interval
        if (statusRefreshInterval) {
            clearInterval(statusRefreshInterval);
        }
        
        // Set up auto-refresh every 30 seconds for system status
        const interval = setInterval(() => {
            fetchSystemStatus(false); // Silent refresh
        }, 30000);
        
        setStatusRefreshInterval(interval);
    };

    const stopStatusAutoRefresh = () => {
        if (statusRefreshInterval) {
            clearInterval(statusRefreshInterval);
            setStatusRefreshInterval(null);
        }
    };

    const handleCloseGeneralOrderModal = () => {
        setShowGeneralOrderModal(false);
        setEditingGeneralOrder(null);
        setGeneralOrderForm({
            title: '',
            description: '',
            deadline: '',
            opening_time: '',
            schedule_opening: false
        });
    };

    // Notification Functions
    const fetchNotifications = async () => {
        try {
            setNotificationsLoading(true);
            const response = await fetch('/api/admin/notifications');
            if (response.ok) {
                const data = await response.json();
                setNotifications(data.notifications || []);
                setNotificationStats(data.stats || {});
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setNotificationsLoading(false);
        }
    };

    const fetchNotificationTemplates = async () => {
        try {
            setTemplatesLoading(true);
            const response = await fetch('/api/admin/notifications/templates');
            if (response.ok) {
                const data = await response.json();
                setNotificationTemplates(data.templates || []);
            }
        } catch (error) {
            console.error('Error fetching templates:', error);
        } finally {
            setTemplatesLoading(false);
        }
    };

    const fetchUsersForNotifications = async (role = null) => {
        try {
            console.log('fetchUsersForNotifications called with role:', role);
            setUsersForNotificationLoading(true);
            
            // Always use the main users endpoint (it works!)
            const response = await fetch('/api/admin/users');
            
            if (response.ok) {
                const data = await response.json();
                console.log('Received data:', data);
                let users = data.users || [];
                console.log('Users before filter:', users.length);
                
                // Filter by role if needed
                if (role && users.length > 0) {
                    // Filter based on role: 'customer' or 'admin'
                    users = users.filter(user => {
                        const userRole = user.role || 'customer'; // Default to 'customer' if role is null
                        return userRole === role;
                    });
                    console.log(`Users after role filter (${role}):`, users.length);
                }
                
                // Map to consistent format
                const mappedUsers = users.map(user => ({
                    id: user.id,
                    name: user.full_name || user.name,
                    email: user.email,
                    phone: user.phone || 'N/A',
                    role: user.role || 'customer'
                }));
                
                console.log('Setting available users:', mappedUsers.length);
                setAvailableUsers(mappedUsers);
            } else {
                console.error('Failed to fetch users, status:', response.status);
                setAvailableUsers([]);
                showToast('לא ניתן לטעון רשימת משתמשים', 'error');
            }
        } catch (error) {
            console.error('Error fetching users for notifications:', error);
            setAvailableUsers([]);
            showToast('שגיאה בטעינת משתמשים', 'error');
        } finally {
            console.log('fetchUsersForNotifications finished');
            setUsersForNotificationLoading(false);
        }
    };

    const handleCreateNotification = () => {
        setNotificationForm({
            title: '',
            message: '',
            audience: 'all',
            userIds: [],
            scheduledAt: '',
            icon: '',
            image: '',
            url: '',
            template: ''
        });
        setSelectedTemplate(null);
        setShowNotificationModal(true);
        fetchNotificationTemplates();
        fetchUsersForNotifications();
    };

    const replacePlaceholders = (text) => {
        if (!text) return text;
        
        // Calculate actual time left from active general orders
        let timeLeft = '24 שעות';
        if (generalOrders && generalOrders.length > 0) {
            const activeOrder = generalOrders.find(order => order.status === 'active');
            if (activeOrder && activeOrder.deadline) {
                const deadline = new Date(activeOrder.deadline);
                const now = new Date();
                const diffMs = deadline - now;
                const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                const diffDays = Math.floor(diffHours / 24);
                
                if (diffDays > 0) {
                    timeLeft = `${diffDays} ימים`;
                } else if (diffHours > 0) {
                    timeLeft = `${diffHours} שעות`;
                } else {
                    const diffMinutes = Math.floor(diffMs / (1000 * 60));
                    timeLeft = `${diffMinutes} דקות`;
                }
            }
        }
        
        // Replace {shop_name} with actual shop name
        const shopName = 'Vape Shop Israel';
        
        // Replace {product_name} with dynamic product (get latest product)
        const productName = products && products.length > 0 
            ? products[0].name 
            : 'מוצר חדש';
        
        // Replace {order_title} with active order title
        const orderTitle = generalOrders && generalOrders.length > 0
            ? generalOrders.find(o => o.status === 'active')?.title || 'הזמנה קבוצתית'
            : 'הזמנה קבוצתית';
        
        return text
            .replace(/\{time_left\}/g, timeLeft)
            .replace(/\{shop_name\}/g, shopName)
            .replace(/\{product_name\}/g, productName)
            .replace(/\{order_title\}/g, orderTitle)
            .replace(/\{user_name\}/g, user?.full_name || 'משתמש')
            .replace(/\{order_number\}/g, '#12345');
    };

    const handleSelectTemplate = (template) => {
        setSelectedTemplate(template);
        setNotificationForm(prev => ({
            ...prev,
            title: replacePlaceholders(template.title),
            message: replacePlaceholders(template.body),
            icon: template.icon,
            url: template.url,
            template: template.id
        }));
    };

    const handleNotificationFormChange = (e) => {
        const { name, value } = e.target;
        setNotificationForm(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleAudienceChange = (audience) => {
        console.log('Audience changed to:', audience);
        setNotificationForm(prev => ({
            ...prev,
            audience,
            userIds: audience !== 'specific_users' ? [] : prev.userIds
        }));
        
        if (audience === 'specific_users') {
            console.log('Fetching customers...');
            fetchUsersForNotifications('customer');
        } else if (audience === 'admins_only') {
            console.log('Fetching admins...');
            fetchUsersForNotifications('admin');
        }
    };

    const handleUserSelection = (userId, isSelected) => {
        setNotificationForm(prev => ({
            ...prev,
            userIds: isSelected 
                ? [...prev.userIds, userId]
                : prev.userIds.filter(id => id !== userId)
        }));
    };

    const handleSendNotification = async (e) => {
        e.preventDefault();
        
        if (!notificationForm.title || !notificationForm.message) {
            showToast('נא למלא כותרת והודעה', 'error');
            return;
        }

        if (notificationForm.audience === 'specific_users' && notificationForm.userIds.length === 0) {
            showToast('נא לבחור לפחות משתמש אחד', 'error');
            return;
        }

        try {
            setSendNotificationLoading(true);
            
            console.log('📤 SENDING NOTIFICATION - START');
            console.log('   Title:', notificationForm.title);
            console.log('   Message:', notificationForm.message);
            console.log('   Audience:', notificationForm.audience);
            console.log('   User IDs:', notificationForm.userIds);
            
            const response = await fetch('/api/admin/notifications', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: notificationForm.title,
                    message: notificationForm.message,
                    audience: notificationForm.audience,
                    userIds: notificationForm.userIds,
                    scheduledAt: notificationForm.scheduledAt || null,
                    icon: notificationForm.icon,
                    image: notificationForm.image,
                    url: notificationForm.url,
                    createdBy: user?.id
                })
            });

            const result = await response.json();
            
            console.log('📥 NOTIFICATION API RESPONSE:');
            console.log('   Status:', response.status);
            console.log('   Response:', result);
            console.log('   Sent Count:', result.notification?.sent_count);
            console.log('   OneSignal ID:', result.notification?.onesignal_id);

            if (response.ok) {
                setShowNotificationModal(false);
                fetchNotifications();
                showToast(
                    notificationForm.scheduledAt 
                        ? `🕐 התראה תוזמנה ל-${new Date(notificationForm.scheduledAt).toLocaleString('he-IL')}`
                        : `✅ התראה נשלחה ל-${result.notification?.sent_count || 0} משתמשים!`, 
                    'success'
                );
                console.log('✅✅✅ NOTIFICATION SENT SUCCESSFULLY ✅✅✅');
            } else {
                console.error('❌ NOTIFICATION API ERROR:', result.error);
                showToast(`שגיאה בשליחת ההתראה: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('❌ NOTIFICATION SEND EXCEPTION:', error);
            showToast('שגיאה בשליחת ההתראה', 'error');
        } finally {
            setSendNotificationLoading(false);
        }
    };

    const handleDeleteNotification = async (notificationId) => {
        if (!confirm('האם אתה בטוח שברצונך למחוק את ההתראה?')) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/notifications?id=${notificationId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                fetchNotifications();
                showToast('התראה נמחקה בהצלחה!', 'success');
            } else {
                const result = await response.json();
                showToast(`שגיאה במחיקת ההתראה: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error deleting notification:', error);
            showToast('שגיאה במחיקת ההתראה', 'error');
        }
    };

    const handleCloseNotificationModal = () => {
        setShowNotificationModal(false);
        setNotificationForm({
            title: '',
            message: '',
            audience: 'all',
            userIds: [],
            scheduledAt: '',
            icon: '',
            image: '',
            url: '',
            template: ''
        });
        setSelectedTemplate(null);
    };

    // Auto-refresh only for Recent Activity section
    useEffect(() => {
        let interval;
        if (activeTab === 'dashboard') {
            // Set up auto-refresh every 30 seconds without showing loader
            interval = setInterval(() => {
                fetchRecentActivity(false); // Silent refresh
                fetchStats(); // Also refresh stats silently
            }, 30000);
        }
        
        return () => {
            if (interval) {
                clearInterval(interval);
            }
        };
    }, [activeTab]);

    // Fetch data when tab changes (initial load only)
    useEffect(() => {
        if (activeTab === 'users') {
            fetchUsers();
        } else if (activeTab === 'dashboard') {
            fetchStats();
            fetchVisitorStats();
            fetchRecentActivity(true); // Initial load with spinner
            // fetchShopSettings(); // Removed - shop settings now static
            fetchWhatsappUrl();
        } else if (activeTab === 'products') {
            fetchProducts();
        } else if (activeTab === 'orders') {
            fetchAllOrders();
        } else if (activeTab === 'group-orders') {
            fetchGeneralOrders();
        } else if (activeTab === 'notifications') {
            fetchNotifications();
        } else if (activeTab === 'system-status') {
            fetchSystemStatus(true); // Initial load with spinner
            startStatusAutoRefresh();
        }
        
        // Clean up auto-refresh when leaving system-status tab
        if (activeTab !== 'system-status') {
            stopStatusAutoRefresh();
        }
    }, [activeTab]);

    // Clean up intervals on component unmount
    useEffect(() => {
        return () => {
            stopStatusAutoRefresh();
        };
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
            </div>
        );
    }

    const tabs = [
        { id: 'dashboard', name: 'דשבורד', icon: '📊' },
        { id: 'users', name: 'משתמשים', icon: '👥' },
        { id: 'products', name: 'מוצרים', icon: '📦' },
        { id: 'orders', name: 'הזמנות', icon: '🛒' },
        { id: 'group-orders', name: 'הזמנות קבוצתיות', icon: '👥🛒' },
        { id: 'notifications', name: 'התראות פוש', icon: '🔔' },
        { id: 'system-status', name: 'סטטוס מערכת', icon: '🖥️' },
        { id: 'settings', name: 'הגדרות', icon: '⚙️' }
    ];

    return (
        <div className="min-h-screen admin-page">
            {/* Background */}
            <div className="fixed inset-0 bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 z-0"></div>
            <div className="fixed inset-0 bg-pattern opacity-5 z-0"></div>

            {/* Header */}
            <header className="relative z-10 admin-header">
                <div className="container mx-auto px-6 py-4">
                    <div className="flex items-center justify-between admin-header-content">
                        {/* Mobile Navigation Toggle */}
                        <button 
                            className="mobile-nav-toggle"
                            onClick={toggleMobileNav}
                            aria-label="תפריט ניווט"
                        >
                            {mobileNavOpen ? '✕' : '☰'}
                        </button>

                        <div className="flex items-center space-x-4 space-x-reverse">
                            <div className="admin-logo">
                                <span className="text-2xl">⚡</span>
                            </div>
                            <div>
                                <h1 className="admin-title">
                                    פאנל ניהול - הוייפ שופ
                                </h1>
                                <p className="admin-welcome">שלום מנהל מערכת</p>
                            </div>
                        </div>
                        
                        <nav className="desktop-nav">
                            <Link href="/shop" className="admin-nav-link">
                                <span className="ml-2">🏪</span>
                                <span>חזרה לחנות</span>
                            </Link>
                            <button 
                                onClick={handleLogout}
                                className="admin-nav-link admin-logout"
                            >
                                <span className="ml-2">🚪</span>
                                <span>יציאה</span>
                            </button>
                        </nav>
                    </div>
                </div>
            </header>

            <div className="relative z-10 flex">
                {/* Mobile Sidebar Overlay */}
                <div 
                    className={`mobile-sidebar-overlay md:hidden ${mobileNavOpen ? 'active' : ''}`}
                    onClick={closeMobileNav}
                ></div>

                {/* Sidebar */}
                <aside className={`admin-sidebar ${mobileNavOpen ? 'mobile-open' : ''}`}>
                    <div className="admin-sidebar-header">
                        <div className="flex items-center justify-between">
                            <h3>תפריט ניווט</h3>
                            {/* Close button for mobile only */}
                            <button 
                                className="mobile-close-btn"
                                onClick={closeMobileNav}
                                aria-label="סגור תפריט"
                            >
                                ✕
                            </button>
                        </div>
                        {/* Mobile Navigation Links - Only show on mobile */}
                        <div className="mobile-nav-links">
                            <Link href="/shop" className="admin-nav-link w-full" onClick={closeMobileNav}>
                                <span className="ml-2">🏪</span>
                                <span>חזרה לחנות</span>
                            </Link>
                            <button 
                                onClick={() => {
                                    handleLogout();
                                    closeMobileNav();
                                }}
                                className="admin-nav-link admin-logout w-full"
                            >
                                <span className="ml-2">🚪</span>
                                <span>יציאה</span>
                            </button>
                        </div>
                    </div>
                    <nav className="admin-nav">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id)}
                                className={`admin-nav-item ${
                                    activeTab === tab.id ? 'active' : ''
                                }`}
                            >
                                <span className="admin-nav-icon">{tab.icon}</span>
                                <span className="admin-nav-text">{tab.name}</span>
                            </button>
                        ))}
                    </nav>
                </aside>

                {/* Main Content */}
                <main className="admin-main">
                    {activeTab === 'dashboard' && (
                        <div className="admin-content">
                            <div className="admin-page-header">
                                <div>
                                    <h2 className="admin-page-title">דשבורד ניהול</h2>
                                    <p className="admin-page-subtitle">סקירה כללית של המערכת</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => fetchStats()}
                                    className="admin-btn-primary"
                                    style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                                >
                                    🔄 רענן סטטיסטיקות
                                </button>
                            </div>
                            
                            {/* Stats Cards */}
                            <div className="admin-stats-grid">
                                <div className="admin-stat-card users">
                                    <div className="admin-stat-icon">👥</div>
                                    <div className="admin-stat-content">
                                        <div className="admin-stat-number">{stats.users}</div>
                                        <div className="admin-stat-label">משתמשים</div>
                                    </div>
                                </div>
                                <div className="admin-stat-card products">
                                    <div className="admin-stat-icon">📦</div>
                                    <div className="admin-stat-content">
                                        <div className="admin-stat-number">{stats.products}</div>
                                        <div className="admin-stat-label">מוצרים</div>
                                    </div>
                                </div>
                                <div className="admin-stat-card orders">
                                    <div className="admin-stat-icon">🛒</div>
                                    <div className="admin-stat-content">
                                        <div className="admin-stat-number">{stats.orders}</div>
                                        <div className="admin-stat-label">הזמנות</div>
                                    </div>
                                </div>
                                <div className="admin-stat-card general-orders">
                                    <div className="admin-stat-icon">👥🛒</div>
                                    <div className="admin-stat-content">
                                        <div className="admin-stat-number">{stats.generalOrders}</div>
                                        <div className="admin-stat-label">הזמנות קבוצתיות</div>
                                    </div>
                                </div>
                                <div className="admin-stat-card revenue">
                                    <div className="admin-stat-icon">💰</div>
                                    <div className="admin-stat-content">
                                        <div className="admin-stat-number">₪{stats.revenue.toLocaleString('en-US')}</div>
                                        <div className="admin-stat-label">הכנסות</div>
                                    </div>
                                </div>
                                <div className="admin-stat-card visitors">
                                    <div className="admin-stat-icon">👁️</div>
                                    <div className="admin-stat-content">
                                        <div className="admin-stat-number">{visitorStatsLoading ? '...' : visitorStats.total.toLocaleString('en-US')}</div>
                                        <div className="admin-stat-label">ביקורים באתר</div>
                                    </div>
                                </div>
                            </div>

                            {/* Visitor Stats Details */}
                            <div className="admin-section">
                                <div className="admin-section-header">
                                    <h3 className="admin-section-title">
                                        <span className="admin-section-icon">📊</span>
                                        סטטיסטיקות ביקורים
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={fetchVisitorStats}
                                        disabled={visitorStatsLoading}
                                        className="admin-btn-secondary text-sm"
                                    >
                                        {visitorStatsLoading ? '⏳ מעדכן...' : '🔄 רענן'}
                                    </button>
                                </div>
                                <div className="visitor-stats-grid">
                                    <div className="visitor-stat-card today">
                                        <div className="visitor-stat-icon">📅</div>
                                        <div className="visitor-stat-content">
                                            <div className="visitor-stat-number">{visitorStatsLoading ? '...' : visitorStats.today}</div>
                                            <div className="visitor-stat-label">היום</div>
                                        </div>
                                    </div>
                                    <div className="visitor-stat-card week">
                                        <div className="visitor-stat-icon">📆</div>
                                        <div className="visitor-stat-content">
                                            <div className="visitor-stat-number">{visitorStatsLoading ? '...' : visitorStats.thisWeek}</div>
                                            <div className="visitor-stat-label">השבוע</div>
                                        </div>
                                    </div>
                                    <div className="visitor-stat-card month">
                                        <div className="visitor-stat-icon">📊</div>
                                        <div className="visitor-stat-content">
                                            <div className="visitor-stat-number">{visitorStatsLoading ? '...' : visitorStats.thisMonth}</div>
                                            <div className="visitor-stat-label">החודש</div>
                                        </div>
                                    </div>
                                    <div className="visitor-stat-card total">
                                        <div className="visitor-stat-icon">🌐</div>
                                        <div className="visitor-stat-content">
                                            <div className="visitor-stat-number">{visitorStatsLoading ? '...' : visitorStats.total.toLocaleString('en-US')}</div>
                                            <div className="visitor-stat-label">סה״כ ביקורים</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Recent Activity */}
                            <div className="admin-section">
                                <div className="admin-section-header">
                                    <div className="flex items-center justify-between w-full">
                                        <h3 className="admin-section-title">פעילות אחרונה</h3>
                                        <div className="activity-controls">
                                            {lastRefresh && (
                                                <span className="text-xs text-gray-500">
                                                    עודכן: {lastRefresh}
                                                </span>
                                            )}
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    fetchRecentActivity(true);
                                                }}
                                                disabled={activityLoading}
                                                className="activity-refresh-btn"
                                                title="רענן כעת"
                                            >
                                                {activityLoading ? '⏳ מרענן...' : '🔄 רענן'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                {activityLoading ? (
                                    <div className="activity-loading">
                                        <div className="loading-spinner"></div>
                                        <p>טוען פעילות אחרונה...</p>
                                    </div>
                                ) : recentActivity && recentActivity.length > 0 ? (
                                    <div>
                                        <div className={`activity-feed ${activitySilentRefresh ? 'silent-refreshing' : ''}`}>
                                            {recentActivity.map((activity, index) => (
                                                <div key={`${activity.type}-${index}`} className="activity-item">
                                                    <div className="activity-icon">
                                                        {activity.type === 'order' && '📋'}
                                                        {activity.type === 'user' && '👤'}
                                                        {activity.type === 'product' && '📦'}
                                                        {activity.type === 'password_reset' && '🔑'}
                                                        {activity.type === 'user_update' && '✏️'}
                                                        {activity.type === 'system' && '⚙️'}
                                                    </div>
                                                    <div className="activity-content">
                                                        <p className="activity-description">{activity.description}</p>
                                                        <p className="activity-time">{activity.time}</p>
                                                    </div>
                                                    <div className={`activity-status ${activity.status || ''}`}>
                                                        {activity.status === 'new' && 'חדש'}
                                                        {activity.status === 'pending' && 'ממתין'}
                                                        {activity.status === 'completed' && 'הושלם'}
                                                        {activity.status === 'error' && 'שגיאה'}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="activity-status-footer">
                                            <div className="activity-status-info">
                                                <span>
                                                    🔄 רענון אוטומטי כל 30 שניות 
                                                    {activitySilentRefresh && <span className="silent-refresh-indicator">• מתעדכן...</span>}
                                                </span>
                                                <span>עדכון אחרון: {lastRefresh || 'טרם עודכן'} | סה&quot;כ: {recentActivity.length}</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="admin-empty-state">
                                        <div className="admin-empty-icon">📊</div>
                                        <p className="admin-empty-text">אין פעילות אחרונה</p>
                                        <p className="admin-empty-subtext">כאשר תהיה פעילות במערכת, היא תוצג כאן</p>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                fetchRecentActivity(true);
                                            }}
                                            disabled={activityLoading}
                                            className="admin-btn-primary mt-3"
                                        >
                                            {activityLoading ? 'טוען...' : 'רענן נתונים'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'users' && (
                        <div className="admin-content">
                            <div className="admin-page-header">
                                <div>
                                    <h2 className="admin-page-title">ניהול משתמשים</h2>
                                    <p className="admin-page-subtitle">ניהול וצפייה במשתמשי המערכת</p>
                                </div>
                                <div className="admin-page-actions">
                                    <button 
                                        onClick={fetchUsers}
                                        className="admin-btn-secondary"
                                    >
                                        <span className="ml-2">🔄</span>
                                        רענן
                                    </button>
                                </div>
                            </div>
                            <div className="admin-section">
                                {usersLoading ? (
                                    <div className="admin-loading">
                                        <div className="spinner"></div>
                                        <p>טוען רשימת משתמשים...</p>
                                    </div>
                                ) : users.length > 0 ? (
                                    <div className="admin-table-container">
                                        <table className="admin-table">
                                            <thead>
                                                <tr>
                                                    <th>שם מלא</th>
                                                    <th className="hide-mobile">שם משתמש</th>
                                                    <th>אימייל</th>
                                                    <th className="hide-mobile">טלפון</th>
                                                    <th>תפקיד</th>
                                                    <th className="hide-mobile">תאריך הצטרפות</th>
                                                    <th>פעולות</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {users.map((userData) => (
                                                    <tr 
                                                        key={userData.id} 
                                                        className="user-table-row"
                                                        onClick={() => handleViewUserOrders(userData)}
                                                        style={{cursor: 'pointer'}}
                                                        title="לחץ לצפייה בהזמנות המשתמש"
                                                    >
                                                        <td>{userData.full_name}</td>
                                                        <td className="hide-mobile">{userData.username}</td>
                                                        <td>{userData.email}</td>
                                                        <td className="hide-mobile">{userData.phone || 'לא צוין'}</td>
                                                        <td>
                                                            <span className={`role-badge ${userData.role}`}>
                                                                {userData.role === 'admin' ? 'מנהל' : 'משתמש'}
                                                            </span>
                                                        </td>
                                                        <td className="hide-mobile">{new Date(userData.created_at).toLocaleDateString('he-IL')}</td>
                                                        <td>
                                                            <div className="admin-table-actions">
                                                                <button 
                                                                    className="admin-btn-small edit"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleEditUser(userData);
                                                                    }}
                                                                    title="ערוך משתמש"
                                                                >
                                                                    ✏️
                                                                </button>
                                                                <button 
                                                                    className="admin-btn-small reset"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleResetPassword(userData);
                                                                    }}
                                                                    title="איפוס סיסמה"
                                                                    disabled={resetPasswordLoading === userData.id}
                                                                >
                                                                    {resetPasswordLoading === userData.id ? '⏳' : '🔑'}
                                                                </button>
                                                                <button 
                                                                    className="admin-btn-small delete"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteUser(userData.id, userData.role, userData.full_name);
                                                                    }}
                                                                    title="מחק משתמש"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="admin-empty-state">
                                        <div className="admin-empty-icon">👥</div>
                                        <p className="admin-empty-text">אין משתמשים במערכת</p>
                                        <p className="admin-empty-subtext">משתמשים חדשים יופיעו כאן לאחר ההרשמה למערכת</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'products' && (
                        <div className="admin-content">
                            <div className="admin-page-header">
                                <div>
                                    <h2 className="admin-page-title">ניהול מוצרים</h2>
                                    <p className="admin-page-subtitle">הוספה, עריכה ומחיקה של מוצרים</p>
                                </div>
                                <div className="admin-page-actions">
                                    <button 
                                        onClick={fetchProducts}
                                        className="admin-btn-secondary"
                                    >
                                        <span className="ml-2">🔄</span>
                                        רענן
                                    </button>
                                    <button 
                                        onClick={handleAddProduct}
                                        className="admin-btn-primary"
                                    >
                                        <span className="ml-2">+</span>
                                        הוסף מוצר חדש
                                    </button>
                                </div>
                            </div>
                            <div className="admin-section">
                                {productsLoading ? (
                                    <div className="admin-loading">
                                        <div className="spinner"></div>
                                        <p>טוען רשימת מוצרים...</p>
                                    </div>
                                ) : products.length > 0 ? (
                                    <div className="admin-table-container">
                                        <table className="admin-table">
                                            <thead>
                                                <tr>
                                                    <th>תמונה</th>
                                                    <th>שם המוצר</th>
                                                    <th className="hide-mobile">קטגוריה</th>
                                                    <th className="hide-mobile">תיאור</th>
                                                    <th>מחיר</th>
                                                    <th>סטטוס</th>
                                                    <th className="hide-mobile">תאריך יצירה</th>
                                                    <th>פעולות</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {products.map((product) => (
                                                    <tr key={product.id} style={{ opacity: product.is_active ? 1 : 0.6 }}>
                                                        <td>
                                                            {product.image_url ? (
                                                                <img 
                                                                    src={product.image_url} 
                                                                    alt={product.name}
                                                                    className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                                                                    onError={(e) => {
                                                                        e.target.style.display = 'none';
                                                                        e.target.nextSibling.style.display = 'flex';
                                                                    }}
                                                                />
                                                            ) : null}
                                                            <div 
                                                                className="w-16 h-16 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 text-sm"
                                                                style={{display: product.image_url ? 'none' : 'flex'}}
                                                            >
                                                                📦
                                                            </div>
                                                        </td>
                                                        <td className="font-medium">{product.name}</td>
                                                        <td className="hide-mobile">
                                                            {product.category ? (
                                                                <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                                                                    {product.category}
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-400 text-xs">לא צוין</span>
                                                            )}
                                                        </td>
                                                        <td className="hide-mobile">
                                                            <div className="max-w-xs truncate" title={product.description}>
                                                                {product.description}
                                                            </div>
                                                        </td>
                                                        <td className="font-bold text-green-600">₪{product.price}</td>
                                                        <td>
                                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                                                product.is_active 
                                                                    ? 'bg-green-100 text-green-800' 
                                                                    : 'bg-red-100 text-red-800'
                                                            }`}>
                                                                {product.is_active ? '✓ פעיל' : '✗ מושהה'}
                                                            </span>
                                                        </td>
                                                        <td className="hide-mobile">{new Date(product.created_at).toLocaleDateString('he-IL')}</td>
                                                        <td>
                                                            <div className="admin-table-actions">
                                                                <button 
                                                                    className="admin-btn-small edit"
                                                                    onClick={() => handleEditProduct(product)}
                                                                    title="ערוך מוצר"
                                                                >
                                                                    ✏️
                                                                </button>
                                                                <button 
                                                                    className={`admin-btn-small ${product.is_active ? 'warning' : 'success'}`}
                                                                    onClick={() => handleToggleProductStatus(product)}
                                                                    title={product.is_active ? 'השהה מוצר' : 'הפעל מוצר'}
                                                                >
                                                                    {product.is_active ? '⏸️' : '▶️'}
                                                                </button>
                                                                <button 
                                                                    className="admin-btn-small delete"
                                                                    onClick={() => handleDeleteProduct(product.id, product.name)}
                                                                    title="מחק מוצר"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="admin-empty-state">
                                        <div className="admin-empty-icon">📦</div>
                                        <p className="admin-empty-text">אין מוצרים במערכת</p>
                                        <p className="admin-empty-subtext">הוסף מוצרים חדשים כדי להתחיל למכור</p>
                                        <button 
                                            onClick={handleAddProduct}
                                            className="admin-btn-primary mt-4"
                                        >
                                            <span className="ml-2">+</span>
                                            הוסף מוצר ראשון
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'orders' && (
                        <div className="admin-content">
                            <div className="admin-page-header">
                                <div>
                                    <h2 className="admin-page-title">ניהול הזמנות</h2>
                                    <p className="admin-page-subtitle">מעקב ועדכון סטטוס כל ההזמנות במערכת</p>
                                </div>
                                <div className="admin-page-actions">
                                    <button 
                                        onClick={fetchAllOrders}
                                        className="admin-btn-secondary"
                                    >
                                        <span className="ml-2">🔄</span>
                                        רענן
                                    </button>
                                </div>
                            </div>
                            <div className="admin-section">
                                {allOrdersLoading ? (
                                    <div className="admin-loading">
                                        <div className="spinner"></div>
                                        <p>טוען הזמנות...</p>
                                    </div>
                                ) : allOrders.length > 0 ? (
                                    <div className="admin-table-container">
                                        <table className="admin-table">
                                            <thead>
                                                <tr>
                                                    <th>משתמש</th>
                                                    <th className="hide-mobile">הזמנה קבוצתית</th>
                                                    <th>סה"כ</th>
                                                    <th className="hide-mobile">תאריך</th>
                                                    <th>פעולות</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {allOrders.map((order) => (
                                                    <React.Fragment key={order.id}>
                                                        <tr 
                                                            className={`cursor-pointer hover:bg-gray-50 ${expandedOrders.has(order.id) ? 'bg-blue-50' : ''}`}
                                                            onClick={() => handleViewOrderDetails(order)}
                                                        >
                                                            <td>
                                                                <div className="flex items-center">
                                                                    <span className="mr-2">
                                                                        {expandedOrders.has(order.id) ? '▼' : '▶'}
                                                                    </span>
                                                                    <div>
                                                                        <div className="font-medium">{order.user?.full_name || 'לא ידוע'}</div>
                                                                        <div className="text-sm text-gray-600">{order.user?.phone || 'לא צוין'}</div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td>
                                                                {order.general_order_id && order.general_orders ? (
                                                                    <span className="text-blue-600 font-medium">
                                                                        📦 {order.general_orders.title}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-gray-400">
                                                                        - לא קבוצתית -
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="font-bold text-green-600">
                                                                ₪{order.total_amount || 0}
                                                            </td>
                                                            <td className="hide-mobile">
                                                                <div className="text-sm">
                                                                    {new Date(order.created_at).toLocaleDateString('he-IL')}
                                                                    <br />
                                                                    {new Date(order.created_at).toLocaleTimeString('he-IL', {
                                                                        hour: '2-digit',
                                                                        minute: '2-digit'
                                                                    })}
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <div className="admin-table-actions">
                                                                    <button 
                                                                        className="admin-btn-small edit"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleUpdateOrderStatus(order);
                                                                        }}
                                                                        title="עדכן סטטוס"
                                                                    >
                                                                        ✏️
                                                                    </button>
                                                                    <button 
                                                                        className="admin-btn-small delete"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDeleteOrder(order);
                                                                        }}
                                                                        title="מחק הזמנה"
                                                                    >
                                                                        🗑️
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        {expandedOrders.has(order.id) && (
                                                            <tr className="bg-gray-50">
                                                                <td colSpan="5" className="p-0">
                                                                    <div className="p-6 border-l-4 border-blue-400">
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                            {/* Order Details */}
                                                                            <div>
                                                                                <h4 className="font-semibold text-lg mb-3 text-gray-800">
                                                                                    📋 פרטי הזמנה
                                                                                </h4>
                                                                                <div className="space-y-2 text-sm">
                                                                                    <div className="flex justify-between">
                                                                                        <span className="text-gray-600">מזהה הזמנה:</span>
                                                                                        <span className="font-mono">#{order.id}</span>
                                                                                    </div>
                                                                                    <div className="flex justify-between">
                                                                                        <span className="text-gray-600">משתמש:</span>
                                                                                        <span>{order.user?.full_name} ({order.user?.username})</span>
                                                                                    </div>
                                                                                    <div className="flex justify-between">
                                                                                        <span className="text-gray-600">אימייל:</span>
                                                                                        <span>{order.user?.phone || 'לא צוין'}</span>
                                                                                    </div>
                                                                                    <div className="flex justify-between">
                                                                                        <span className="text-gray-600">סטטוס:</span>
                                                                                        <span className={`status-badge ${order.status}`}>
                                                                                            {order.status === 'open' ? 'פתוח' : 
                                                                                             order.status === 'pending' ? 'ממתין' : 
                                                                                             order.status === 'confirmed' ? 'מאושר' : 
                                                                                             order.status === 'completed' ? 'הושלם' : 
                                                                                             order.status === 'cancelled' ? 'בוטל' : order.status}
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex justify-between">
                                                                                        <span className="text-gray-600">תאריך הזמנה:</span>
                                                                                        <span>{new Date(order.created_at).toLocaleString('he-IL')}</span>
                                                                                    </div>
                                                                                    {order.general_order?.title && (
                                                                                        <div className="flex justify-between">
                                                                                            <span className="text-gray-600">הזמנה קבוצתית:</span>
                                                                                            <span className="text-blue-600 font-medium">{order.general_order.title}</span>
                                                                                        </div>
                                                                                    )}
                                                                                    {order.notes && (
                                                                                        <div className="mt-3">
                                                                                            <span className="text-gray-600">הערות:</span>
                                                                                            <p className="mt-1 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                                                                                                {order.notes}
                                                                                            </p>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>

                                                                            {/* Order Items */}
                                                                            <div>
                                                                                <h4 className="font-semibold text-lg mb-3 text-gray-800">
                                                                                    🛍️ פריטים בהזמנה ({order.order_items?.length || 0})
                                                                                </h4>
                                                                                {order.order_items && order.order_items.length > 0 ? (
                                                                                    <div className="space-y-3">
                                                                                        {order.order_items.map((item, index) => (
                                                                                            <div key={item.id || index} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                                                                                                <div className="flex items-start justify-between">
                                                                                                    <div className="flex-1">
                                                                                                        <div className="font-medium text-gray-800">
                                                                                                            {item.products?.name || `מוצר ${item.product_id.slice(0, 8)}`}
                                                                                                        </div>
                                                                                                        {item.products?.description && (
                                                                                                            <div className="text-sm text-gray-600 mt-1">
                                                                                                                {item.products.description}
                                                                                                            </div>
                                                                                                        )}
                                                                                                        <div className="flex items-center gap-4 mt-2 text-sm">
                                                                                                            <span className="text-gray-600">
                                                                                                                כמות: <span className="font-medium">{item.quantity}</span>
                                                                                                            </span>
                                                                                                            <span className="text-gray-600">
                                                                                                                מחיר יחידה: <span className="font-medium text-green-600">₪{item.unit_price || item.products?.price || 0}</span>
                                                                                                            </span>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                    <div className="text-right">
                                                                                                        <div className="font-bold text-green-600 text-lg">
                                                                                                            ₪{item.total_price || 0}
                                                                                                        </div>
                                                                                                        {item.products?.image_url && (
                                                                                                            <img 
                                                                                                                src={item.products.image_url} 
                                                                                                                alt={item.products.name}
                                                                                                                className="w-12 h-12 object-cover rounded mt-2 border border-gray-200"
                                                                                                                onError={(e) => {
                                                                                                                    e.target.style.display = 'none';
                                                                                                                }}
                                                                                                            />
                                                                                                        )}
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>
                                                                                        ))}
                                                                                        
                                                                                        {/* Order Total */}
                                                                                        <div className="border-t pt-3 mt-4">
                                                                                            <div className="flex justify-between items-center">
                                                                                                <span className="font-semibold text-gray-800">סך הכל:</span>
                                                                                                <span className="font-bold text-xl text-green-600">₪{order.total_amount || 0}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="text-center py-4 text-gray-500">
                                                                                        <div className="text-2xl mb-2">📦</div>
                                                                                        <p>אין פריטים בהזמנה זו</p>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="admin-empty-state">
                                        <div className="admin-empty-icon">🛒</div>
                                        <p className="admin-empty-text">אין הזמנות במערכת</p>
                                        <p className="admin-empty-subtext">הזמנות שיתקבלו יופיעו כאן לניהול</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'group-orders' && (
                        <div className="admin-content">
                            <div className="admin-page-header">
                                <div>
                                    <h2 className="admin-page-title">ניהול הזמנות קבוצתיות</h2>
                                    <p className="admin-page-subtitle">יצירה וניהול של הזמנות קבוצתיות</p>
                                </div>
                                <div className="admin-page-actions">
                                    <button 
                                        onClick={handleAutoCloseOrders}
                                        className="admin-btn-secondary"
                                        disabled={autoCloseLoading}
                                        title="סגור הזמנות שחרג תאריך הסגירה שלהן"
                                    >
                                        {autoCloseLoading ? (
                                            <span className="spinner-sm"></span>
                                        ) : (
                                            <span className="ml-2">⏰</span>
                                        )}
                                        סגירה אוטומטית
                                    </button>
                                    <button 
                                        onClick={handleCreateGeneralOrder}
                                        className="admin-btn-primary"
                                    >
                                        <span className="ml-2">+</span>
                                        צור הזמנה קבוצתית חדשה
                                    </button>
                                </div>
                            </div>
                            <div className="admin-section">
                                {generalOrdersLoading ? (
                                    <div className="admin-loading">
                                        <div className="spinner"></div>
                                        <p>טוען הזמנות קבוצתיות...</p>
                                    </div>
                                ) : generalOrders.length > 0 ? (
                                    <div className="admin-table-container">
                                        <table className="admin-table">
                                            <thead>
                                                <tr>
                                                    <th>כותרת</th>
                                                    <th>סטטוס</th>
                                                    <th>זמן פתיחה</th>
                                                    <th>זמן סגירה</th>
                                                    <th>משתתפים</th>
                                                    <th>סה&ldquo;כ</th>
                                                    <th>פעולות</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {generalOrders.map((order) => (
                                                    <tr key={order.id}>
                                                        <td>
                                                            <div className="font-medium">{order.title}</div>
                                                            {order.description && (
                                                                <div className="text-sm text-gray-600 truncate max-w-xs">
                                                                    {order.description}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td>
                                                            <span className={`status-badge ${order.real_time_status || order.status}`}>
                                                                {(order.real_time_status || order.status) === 'open' ? 'פתוח' : 
                                                                 (order.real_time_status || order.status) === 'closed' ? 'סגור' : 
                                                                 (order.real_time_status || order.status) === 'scheduled' ? 'מתוזמן' : 
                                                                 (order.real_time_status || order.status) === 'processing' ? 'בעיבוד' : 
                                                                 (order.real_time_status || order.status) === 'completed' ? 'הושלם' : (order.real_time_status || order.status)}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            {order.opening_time ? (
                                                                <div className="text-sm">
                                                                    {new Date(order.opening_time).toLocaleDateString('he-IL')}
                                                                    <br />
                                                                    {new Date(order.opening_time).toLocaleTimeString('he-IL', {
                                                                        hour: '2-digit',
                                                                        minute: '2-digit'
                                                                    })}
                                                                </div>
                                                            ) : (
                                                                <span className="text-gray-400">מיידי</span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            <div className="text-sm">
                                                                {new Date(order.deadline).toLocaleDateString('he-IL')}
                                                                <br />
                                                                {new Date(order.deadline).toLocaleTimeString('he-IL', {
                                                                    hour: '2-digit',
                                                                    minute: '2-digit'
                                                                })}
                                                            </div>
                                                        </td>
                                                        <td className="text-center">
                                                            <span className="font-bold">{order.total_orders || 0}</span>
                                                        </td>
                                                        <td className="font-bold text-green-600">
                                                            ₪{order.total_amount || 0}
                                                        </td>
                                                        <td>
                                                            <div className="admin-table-actions">
                                                                <button 
                                                                    className="admin-btn-small edit"
                                                                    onClick={() => handleEditGeneralOrder(order)}
                                                                    title="ערוך הזמנה"
                                                                >
                                                                    ✏️
                                                                </button>
                                                                {(order.real_time_status || order.status) === 'open' && (
                                                                    <button 
                                                                        className="admin-btn-small close"
                                                                        onClick={() => handleCloseGeneralOrder(order.id)}
                                                                        title="סגור הזמנה"
                                                                    >
                                                                        🔒
                                                                    </button>
                                                                )}
                                                                <button 
                                                                    className="admin-btn-small pdf"
                                                                    onClick={() => handleGenerateAdminPDF(order)}
                                                                    title="דוח מנהל (PDF)"
                                                                    style={{backgroundColor: '#e3f2fd', color: '#1976d2'}}
                                                                >
                                                                    📊
                                                                </button>
                                                                <button 
                                                                    className="admin-btn-small pdf"
                                                                    onClick={() => handleGenerateSupplierPDF(order)}
                                                                    title="דוח ספק (PDF)"
                                                                    style={{backgroundColor: '#f3e5f5', color: '#7b1fa2'}}
                                                                >
                                                                    📦
                                                                </button>
                                                                <button 
                                                                    className="admin-btn-small email"
                                                                    onClick={() => handleSendSummaryEmail(order)}
                                                                    title="שלח אימייל סיכום למנהלים (עם דוחות PDF)"
                                                                    style={{
                                                                        backgroundColor: summaryEmailLoading === order.id ? '#f5f5f5' : '#e8f5e8', 
                                                                        color: summaryEmailLoading === order.id ? '#666' : '#2e7d32',
                                                                        position: 'relative',
                                                                        minWidth: '40px',
                                                                        minHeight: '40px'
                                                                    }}
                                                                    disabled={summaryEmailLoading === order.id}
                                                                >
                                                                    {summaryEmailLoading === order.id ? (
                                                                        <div style={{ 
                                                                            display: 'flex', 
                                                                            flexDirection: 'column', 
                                                                            alignItems: 'center', 
                                                                            justifyContent: 'center',
                                                                            fontSize: '10px',
                                                                            lineHeight: '1'
                                                                        }}>
                                                                            <div style={{
                                                                                width: '20px',
                                                                                height: '20px',
                                                                                border: '2px solid #e3e3e3',
                                                                                borderTop: '2px solid #2e7d32',
                                                                                borderRadius: '50%',
                                                                                animation: 'spin 1s linear infinite',
                                                                                marginBottom: '2px'
                                                                            }}></div>
                                                                            {emailProgress.total > 0 && (
                                                                                <span style={{ fontSize: '8px', color: '#2e7d32', fontWeight: 'bold' }}>
                                                                                    {emailProgress.percentage}%
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        '📧'
                                                                    )}
                                                                </button>
                                                                <button 
                                                                    className="admin-btn-small delete"
                                                                    onClick={() => handleDeleteGeneralOrder(order.id)}
                                                                    title="מחק הזמנה"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="admin-empty-state">
                                        <div className="admin-empty-icon">�👥🛒</div>
                                        <p className="admin-empty-text">אין הזמנות קבוצתיות</p>
                                        <p className="admin-empty-subtext">צור הזמנות קבוצתיות לחיסכון ומכירה מואצת</p>
                                        <button 
                                            onClick={handleCreateGeneralOrder}
                                            className="admin-btn-primary mt-4"
                                        >
                                            <span className="ml-2">+</span>
                                            צור הזמנה קבוצתית ראשונה
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'system-status' && (
                        <div className="admin-content">
                            <div className="admin-page-header">
                                <div>
                                    <h2 className="admin-page-title">סטטוס מערכת</h2>
                                    <p className="admin-page-subtitle">מעקב אחר cron jobs וסטטוס אימיילים</p>
                                </div>
                                <div className="admin-page-actions">
                                    <button 
                                        onClick={() => fetchSystemStatus(true)}
                                        disabled={systemStatusLoading}
                                        className="admin-btn-secondary"
                                    >
                                        {systemStatusLoading ? (
                                            <span className="spinner-sm"></span>
                                        ) : (
                                            <span className="ml-2">🔄</span>
                                        )}
                                        רענן סטטוס
                                    </button>
                                    <button 
                                        onClick={triggerManualCron}
                                        disabled={manualCronLoading}
                                        className="admin-btn-primary"
                                        style={{ marginRight: '10px' }}
                                    >
                                        {manualCronLoading ? (
                                            <span className="spinner-sm"></span>
                                        ) : (
                                            <span className="ml-2">🤖</span>
                                        )}
                                        הפעל Cron ידנית
                                    </button>
                                </div>
                            </div>
                            
                            {systemStatusLoading ? (
                                <div className="admin-loading">
                                    <div className="spinner"></div>
                                    <p>טוען סטטוס המערכת...</p>
                                </div>
                            ) : systemStatus ? (
                                <div className="admin-section">
                                    {/* Cron Jobs Status */}
                                    <div className="admin-section">
                                        <div className="admin-section-header">
                                            <h3 className="admin-section-title">
                                                <span className="admin-section-icon">🤖</span>
                                                סטטוס Cron Jobs
                                            </h3>
                                            <p className="admin-section-subtitle">מעקב אחר הפעלת המשימות האוטומטיות</p>
                                        </div>
                                        
                                        <div className="system-status-grid">
                                            {/* Auto Order Opening */}
                                            <div className="system-status-card">
                                                <div className="status-card-header">
                                                    <div className="status-card-title">
                                                        <span className="status-icon">🔓</span>
                                                        <h4>פתיחת הזמנות אוטומטית</h4>
                                                    </div>
                                                    <div className={`status-badge ${systemStatus.cronJobs?.autoOrderOpening?.status || 'unknown'}`}>
                                                        {systemStatus.cronJobs?.autoOrderOpening?.status === 'active' ? 'פעיל' : 
                                                         systemStatus.cronJobs?.autoOrderOpening?.status === 'error' ? 'שגיאה' : 'לא ידוע'}
                                                    </div>
                                                </div>
                                                <div className="status-card-content">
                                                    {systemStatus.cronJobs?.autoOrderOpening?.lastRun && (
                                                        <div className="status-info-item">
                                                            <span className="status-label">הרצה אחרונה:</span>
                                                            <span className="status-value">
                                                                {new Date(systemStatus.cronJobs.autoOrderOpening.lastRun).toLocaleString('he-IL')}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div className="status-info-item">
                                                        <span className="status-label">הזמנות שעובדו:</span>
                                                        <span className="status-value">{systemStatus.cronJobs?.autoOrderOpening?.totalProcessed || 0}</span>
                                                    </div>
                                                    {systemStatus.cronJobs?.autoOrderOpening?.nextScheduled && systemStatus.cronJobs.autoOrderOpening.nextScheduled.length > 0 && (
                                                        <div className="status-scheduled-items">
                                                            <span className="status-label">הזמנות מתוזמנות הבאות:</span>
                                                            {systemStatus.cronJobs.autoOrderOpening.nextScheduled.map(order => (
                                                                <div key={order.id} className="scheduled-item">
                                                                    <span className="scheduled-title">{order.title}</span>
                                                                    <span className="scheduled-time">
                                                                        {new Date(order.scheduledFor).toLocaleString('he-IL')}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Auto Order Closing */}
                                            <div className="system-status-card">
                                                <div className="status-card-header">
                                                    <div className="status-card-title">
                                                        <span className="status-icon">🔒</span>
                                                        <h4>סגירת הזמנות אוטומטית</h4>
                                                    </div>
                                                    <div className={`status-badge ${systemStatus.cronJobs?.autoOrderClosing?.status || 'unknown'}`}>
                                                        {systemStatus.cronJobs?.autoOrderClosing?.status === 'active' ? 'פעיל' : 
                                                         systemStatus.cronJobs?.autoOrderClosing?.status === 'error' ? 'שגיאה' : 'לא ידוע'}
                                                    </div>
                                                </div>
                                                <div className="status-card-content">
                                                    {systemStatus.cronJobs?.autoOrderClosing?.lastRun && (
                                                        <div className="status-info-item">
                                                            <span className="status-label">הרצה אחרונה:</span>
                                                            <span className="status-value">
                                                                {new Date(systemStatus.cronJobs.autoOrderClosing.lastRun).toLocaleString('he-IL')}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div className="status-info-item">
                                                        <span className="status-label">הזמנות שנסגרו:</span>
                                                        <span className="status-value">{systemStatus.cronJobs?.autoOrderClosing?.totalProcessed || 0}</span>
                                                    </div>
                                                    {systemStatus.cronJobs?.autoOrderClosing?.expiredOrders && systemStatus.cronJobs.autoOrderClosing.expiredOrders.length > 0 && (
                                                        <div className="status-expired-items">
                                                            <span className="status-label">הזמנות פגות תוקף:</span>
                                                            {systemStatus.cronJobs.autoOrderClosing.expiredOrders.map(order => (
                                                                <div key={order.id} className="expired-item">
                                                                    <span className="expired-title">{order.title}</span>
                                                                    <span className="expired-time">
                                                                        פג ב: {new Date(order.expiredAt).toLocaleString('he-IL')}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Reminder Emails */}
                                            <div className="system-status-card">
                                                <div className="status-card-header">
                                                    <div className="status-card-title">
                                                        <span className="status-icon">⏰</span>
                                                        <h4>אימיילי תזכורת</h4>
                                                    </div>
                                                    <div className={`status-badge ${systemStatus.cronJobs?.reminderEmails?.status || 'unknown'}`}>
                                                        {systemStatus.cronJobs?.reminderEmails?.status === 'active' ? 'פעיל' : 
                                                         systemStatus.cronJobs?.reminderEmails?.status === 'error' ? 'שגיאה' : 'לא ידוע'}
                                                    </div>
                                                </div>
                                                <div className="status-card-content">
                                                    {systemStatus.cronJobs?.reminderEmails?.lastRun && (
                                                        <div className="status-info-item">
                                                            <span className="status-label">הרצה אחרונה:</span>
                                                            <span className="status-value">
                                                                {new Date(systemStatus.cronJobs.reminderEmails.lastRun).toLocaleString('he-IL')}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div className="status-info-item">
                                                        <span className="status-label">תזכורות שנשלחו:</span>
                                                        <span className="status-value">{systemStatus.cronJobs?.reminderEmails?.remindersSent || 0}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Email Queue */}
                                            <div className="system-status-card">
                                                <div className="status-card-header">
                                                    <div className="status-card-title">
                                                        <span className="status-icon">📧</span>
                                                        <h4>תור אימיילים</h4>
                                                    </div>
                                                    <div className={`status-badge ${systemStatus.cronJobs?.emailQueue?.status || 'unknown'}`}>
                                                        {systemStatus.cronJobs?.emailQueue?.status === 'active' ? 'פעיל' : 
                                                         systemStatus.cronJobs?.emailQueue?.status === 'error' ? 'שגיאה' : 'לא ידוע'}
                                                    </div>
                                                </div>
                                                <div className="status-card-content">
                                                    {systemStatus.cronJobs?.emailQueue?.lastRun && (
                                                        <div className="status-info-item">
                                                            <span className="status-label">הרצה אחרונה:</span>
                                                            <span className="status-value">
                                                                {new Date(systemStatus.cronJobs.emailQueue.lastRun).toLocaleString('he-IL')}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div className="status-info-item">
                                                        <span className="status-label">אימיילים שעובדו:</span>
                                                        <span className="status-value">{systemStatus.cronJobs?.emailQueue?.emailsProcessed || 0}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Email Status */}
                                    <div className="admin-section">
                                        <div className="admin-section-header">
                                            <h3 className="admin-section-title">
                                                <span className="admin-section-icon">📨</span>
                                                סטטוס אימיילים
                                            </h3>
                                            <p className="admin-section-subtitle">מעקב אחר אימיילים שנשלחו ומצבם</p>
                                        </div>
                                        
                                        {/* Email Summary */}
                                        <div className="email-status-summary">
                                            <div className="email-stat-card sent">
                                                <div className="email-stat-icon">📤</div>
                                                <div className="email-stat-content">
                                                    <div className="email-stat-number">{systemStatus.emails?.summary?.totalSent24h || 0}</div>
                                                    <div className="email-stat-label">נשלחו היום</div>
                                                </div>
                                            </div>
                                            <div className="email-stat-card delivered">
                                                <div className="email-stat-icon">✅</div>
                                                <div className="email-stat-content">
                                                    <div className="email-stat-number">{systemStatus.emails?.summary?.totalDelivered24h || 0}</div>
                                                    <div className="email-stat-label">נמסרו היום</div>
                                                </div>
                                            </div>
                                            <div className="email-stat-card failed">
                                                <div className="email-stat-icon">❌</div>
                                                <div className="email-stat-content">
                                                    <div className="email-stat-number">{systemStatus.emails?.summary?.totalFailed24h || 0}</div>
                                                    <div className="email-stat-label">נכשלו היום</div>
                                                </div>
                                            </div>
                                            <div className="email-stat-card weekly">
                                                <div className="email-stat-icon">📊</div>
                                                <div className="email-stat-content">
                                                    <div className="email-stat-number">{systemStatus.emails?.summary?.totalSent7d || 0}</div>
                                                    <div className="email-stat-label">סה"כ השבוע</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Recent Emails */}
                                        {systemStatus.emails?.recentEmails && systemStatus.emails.recentEmails.length > 0 && (
                                            <div className="recent-emails-section">
                                                <h4 className="recent-emails-title">אימיילים אחרונים</h4>
                                                <div className="recent-emails-list">
                                                    {systemStatus.emails.recentEmails.map((email, index) => (
                                                        <div key={email.id || index} className="email-item">
                                                            <div className="email-item-header">
                                                                <div className="email-type">
                                                                    <span className="email-type-icon">
                                                                        {email.type === 'איפוס סיסמה' && '🔑'}
                                                                        {email.type === 'אישור הזמנה' && '📋'}
                                                                        {email.type === 'תזכורת' && '⏰'}
                                                                        {email.type === 'דוח סיכום' && '📊'}
                                                                        {email.type === 'ברוכים הבאים' && '👋'}
                                                                        {!['איפוס סיסמה', 'אישור הזמנה', 'תזכורת', 'דוח סיכום', 'ברוכים הבאים'].includes(email.type) && '📧'}
                                                                    </span>
                                                                    <span className="email-type-text">{email.type}</span>
                                                                </div>
                                                                <div className={`email-status-badge ${email.status}`}>
                                                                    {email.status}
                                                                </div>
                                                            </div>
                                                            <div className="email-item-content">
                                                                <div className="email-recipient">
                                                                    <span className="email-label">נמען:</span>
                                                                    <span className="email-value">{email.recipient}</span>
                                                                </div>
                                                                <div className="email-timestamp">
                                                                    <span className="email-label">זמן:</span>
                                                                    <span className="email-value">
                                                                        {new Date(email.timestamp).toLocaleString('he-IL')}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Email Queue Status */}
                                        <div className="email-queue-section">
                                            <h4 className="email-queue-title">מצב תור האימיילים</h4>
                                            <div className="email-queue-stats">
                                                <div className="queue-stat-item">
                                                    <span className="queue-stat-label">ממתינים בתור:</span>
                                                    <span className="queue-stat-value">{systemStatus.emails?.queue?.pending || 0}</span>
                                                </div>
                                                <div className="queue-stat-item">
                                                    <span className="queue-stat-label">בעיבוד:</span>
                                                    <span className="queue-stat-value">{systemStatus.emails?.queue?.processing || 0}</span>
                                                </div>
                                                <div className="queue-stat-item error">
                                                    <span className="queue-stat-label">כשלונות:</span>
                                                    <span className="queue-stat-value">{systemStatus.emails?.queue?.failed || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Auto Refresh Info */}
                                    <div className="system-status-footer">
                                        <div className="auto-refresh-info">
                                            <span className="refresh-indicator">🔄</span>
                                            <span>רענון אוטומטי כל 30 שניות</span>
                                            <span className="last-update">
                                                עדכון אחרון: {new Date(systemStatus.lastUpdate).toLocaleTimeString('he-IL')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="admin-empty-state">
                                    <div className="admin-empty-icon">🖥️</div>
                                    <p className="admin-empty-text">לא ניתן לטעון סטטוס המערכת</p>
                                    <p className="admin-empty-subtext">בדוק את החיבור לשרת ונסה שוב</p>
                                    <button 
                                        onClick={() => fetchSystemStatus(true)}
                                        className="admin-btn-primary mt-4"
                                    >
                                        🔄 נסה שוב
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'notifications' && (
                        <div className="admin-content">
                            <div className="admin-page-header">
                                <div>
                                    <h2 className="admin-page-title">ניהול התראות פוש</h2>
                                    <p className="admin-page-subtitle">שליחת התראות לאפליקציה ומעקב אחר ביצועים</p>
                                </div>
                                <div className="admin-page-actions">
                                    <button 
                                        onClick={fetchNotifications}
                                        className="admin-btn-secondary"
                                    >
                                        <span className="ml-2">🔄</span>
                                        רענן
                                    </button>
                                    <button 
                                        onClick={handleCreateNotification}
                                        className="admin-btn-primary"
                                    >
                                        <span className="ml-2">🔔</span>
                                        שלח התראה חדשה
                                    </button>
                                </div>
                            </div>

                            {/* Notification Stats */}
                            <div className="admin-stats-grid" style={{gridTemplateColumns: 'repeat(5, 1fr)'}}>
                                <div className="admin-stat-card notifications-total">
                                    <div className="admin-stat-icon">📊</div>
                                    <div className="admin-stat-content">
                                        <div className="admin-stat-number">{notificationStats.total || 0}</div>
                                        <div className="admin-stat-label">סה"כ התראות</div>
                                    </div>
                                </div>
                                <div className="admin-stat-card notifications-sent">
                                    <div className="admin-stat-icon">✅</div>
                                    <div className="admin-stat-content">
                                        <div className="admin-stat-number">{notificationStats.sent || 0}</div>
                                        <div className="admin-stat-label">נשלחו</div>
                                    </div>
                                </div>
                                <div className="admin-stat-card notifications-scheduled">
                                    <div className="admin-stat-icon">⏰</div>
                                    <div className="admin-stat-content">
                                        <div className="admin-stat-number">{notificationStats.scheduled || 0}</div>
                                        <div className="admin-stat-label">מתוזמנות</div>
                                    </div>
                                </div>
                                <div className="admin-stat-card notifications-delivered">
                                    <div className="admin-stat-icon">📲</div>
                                    <div className="admin-stat-content">
                                        <div className="admin-stat-number">{notificationStats.totalSent || 0}</div>
                                        <div className="admin-stat-label">הגיעו למשתמשים</div>
                                    </div>
                                </div>
                                <div className="admin-stat-card notifications-clicks">
                                    <div className="admin-stat-icon">👆</div>
                                    <div className="admin-stat-content">
                                        <div className="admin-stat-number">{notificationStats.clickRate || 0}%</div>
                                        <div className="admin-stat-label">שיעור לחיצות</div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Notifications List */}
                            <div className="admin-section">
                                <div className="admin-section-header">
                                    <h3 className="admin-section-title">היסטוריית התראות</h3>
                                </div>
                                {notificationsLoading ? (
                                    <div className="admin-loading">
                                        <div className="spinner"></div>
                                        <p>טוען התראות...</p>
                                    </div>
                                ) : notifications.length > 0 ? (
                                    <div className="notifications-list">
                                        {notifications.map((notification) => (
                                            <div key={notification.id} className={`notification-card ${notification.status}`}>
                                                <div className="notification-header">
                                                    <div className="notification-title-section">
                                                        <div className="notification-icon">
                                                            {notification.icon || '🔔'}
                                                        </div>
                                                        <div className="notification-info">
                                                            <h4 className="notification-title">{notification.title}</h4>
                                                            <p className="notification-body">{notification.body}</p>
                                                            <div className="notification-meta">
                                                                <span className="notification-date">
                                                                    {new Date(notification.created_at).toLocaleString('he-IL')}
                                                                </span>
                                                                <span className="notification-audience">
                                                                    {notification.audience === 'all' && '🌐 כל המשתמשים'}
                                                                    {notification.audience === 'specific_users' && `👥 ${notification.userIds?.length || 0} משתמשים נבחרים`}
                                                                    {notification.audience === 'admins_only' && '👑 מנהלים בלבד'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="notification-status">
                                                        <div className={`status-badge ${notification.status}`}>
                                                            {notification.status === 'sent' && '✅ נשלח'}
                                                            {notification.status === 'scheduled' && '⏰ מתוזמן'}
                                                            {notification.status === 'failed' && '❌ נכשל'}
                                                        </div>
                                                        <button 
                                                            className="admin-btn-small delete"
                                                            onClick={() => handleDeleteNotification(notification.id)}
                                                            title="מחק התראה"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="notification-stats">
                                                    <div className="stat-item">
                                                        <span className="stat-label">נשלח:</span>
                                                        <span className="stat-value">{notification.sent_count || 0}</span>
                                                    </div>
                                                    <div className="stat-item">
                                                        <span className="stat-label">הגיע:</span>
                                                        <span className="stat-value">{notification.delivered_count || 0}</span>
                                                    </div>
                                                    <div className="stat-item">
                                                        <span className="stat-label">לחצו:</span>
                                                        <span className="stat-value">{notification.clicked_count || 0}</span>
                                                    </div>
                                                    {notification.url && (
                                                        <div className="stat-item">
                                                            <span className="stat-label">קישור:</span>
                                                            <a href={notification.url} className="stat-link" target="_blank" rel="noopener noreferrer">
                                                                {notification.url}
                                                            </a>
                                                        </div>
                                                    )}
                                                    {notification.scheduled_at && notification.status === 'scheduled' && (
                                                        <div className="stat-item">
                                                            <span className="stat-label">מתוזמן ל:</span>
                                                            <span className="stat-value scheduled-time">
                                                                {new Date(notification.scheduled_at).toLocaleString('he-IL')}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="admin-empty-state">
                                        <div className="admin-empty-icon">🔔</div>
                                        <p className="admin-empty-text">אין התראות נשלחות</p>
                                        <p className="admin-empty-subtext">שלח התראה ראשונה למשתמשי האפליקציה</p>
                                        <button 
                                            onClick={handleCreateNotification}
                                            className="admin-btn-primary mt-4"
                                        >
                                            <span className="ml-2">🔔</span>
                                            שלח התראה ראשונה
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="admin-content">
                            <div className="admin-page-header">
                                <div>
                                    <h2 className="admin-page-title">הגדרות מערכת</h2>
                                    <p className="admin-page-subtitle">תצורה כללית של המערכת ובדיקת מערכות</p>
                                </div>
                            </div>
                            
                            {/* Email Testing Section */}
                            <div className="admin-section">
                                <div className="admin-section-header">
                                    <h3 className="admin-section-title">
                                        <span className="admin-section-icon">📧</span>
                                        בדיקת מערכת אימיילים
                                    </h3>
                                    <p className="admin-section-subtitle">בדוק שליחת אימיילי אישור הזמנה</p>
                                </div>
                                
                                <div className="admin-settings-grid">
                                    <div className="admin-settings-card">
                                        <div className="admin-settings-card-header">
                                            <h4>בדיקת אימייל מותאם אישית</h4>
                                            <p>שלח אימיילי בדיקה לכתובת שתבחר</p>
                                        </div>
                                        <div className="admin-settings-card-content">
                                            <div className="form-group">
                                                <label htmlFor="test_email_address">כתובת אימייל לבדיקה</label>
                                                <input
                                                    type="email"
                                                    id="test_email_address"
                                                    value={testEmailAddress}
                                                    onChange={(e) => setTestEmailAddress(e.target.value)}
                                                    placeholder="example@domain.com"
                                                    className="admin-input"
                                                    dir="ltr"
                                                />
                                                <small className="form-help">
                                                    הזן כתובת אימייל תקינה לשליחת אימייל בדיקה
                                                </small>
                                            </div>
                                            <div className="form-group">
                                                <label htmlFor="test_email_type">סוג אימייל</label>
                                                <select
                                                    id="test_email_type"
                                                    value={testEmailType}
                                                    onChange={(e) => setTestEmailType(e.target.value)}
                                                    className="admin-input"
                                                >
                                                    <option value="password_reset">🔑 איפוס סיסמה</option>
                                                    <option value="general_test">📧 בדיקה כללית</option>
                                                    <option value="welcome">👋 ברוכים הבאים</option>
                                                    <option value="order_confirmation">✅ אישור הזמנה</option>
                                                </select>
                                                <small className="form-help">
                                                    בחר סוג האימייל שברצונך לבדוק
                                                </small>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleTestCustomEmail}
                                                disabled={customEmailTestLoading}
                                                className="admin-btn admin-btn-primary"
                                            >
                                                {customEmailTestLoading ? (
                                                    <>
                                                        <span className="spinner"></span>
                                                        שולח...
                                                    </>
                                                ) : (
                                                    <>
                                                        🚀 שלח אימייל בדיקה
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="admin-settings-card">
                                        <div className="admin-settings-card-header">
                                            <h4>בדיקת אימייל אישור הזמנה</h4>
                                            <p>שלח אימייל אישור הזמנה לבדיקה</p>
                                        </div>
                                        <div className="admin-settings-card-content">
                                            <div className="form-group">
                                                <label htmlFor="test_order_id">מספר הזמנה לבדיקה</label>
                                                <input
                                                    type="text"
                                                    id="test_order_id"
                                                    value={testOrderId}
                                                    onChange={(e) => setTestOrderId(e.target.value)}
                                                    placeholder="הזן מספר הזמנה קיים"
                                                    className="admin-input"
                                                />
                                                <small className="form-help">
                                                    הזן מספר הזמנה קיים במערכת לבדיקת שליחת אימייל
                                                </small>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleTestOrderEmail}
                                                disabled={emailTestLoading}
                                                className="admin-btn admin-btn-secondary"
                                            >
                                                {emailTestLoading ? (
                                                    <>
                                                        <span className="spinner"></span>
                                                        שולח...
                                                    </>
                                                ) : (
                                                    <>
                                                        📧 שלח אימייל הזמנה
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="admin-settings-card">
                                        <div className="admin-settings-card-header">
                                            <h4>מידע על מערכת האימיילים</h4>
                                            <p>פרטים טכניים על תצורת האימיילים</p>
                                        </div>
                                        <div className="admin-settings-card-content">
                                            <div className="settings-info-grid">
                                                <div className="settings-info-item">
                                                    <span className="settings-info-label">שירות SMTP:</span>
                                                    <span className="settings-info-value">Gmail</span>
                                                </div>
                                                <div className="settings-info-item">
                                                    <span className="settings-info-label">תמיכה בעברית:</span>
                                                    <span className="settings-info-value">✅ מופעל</span>
                                                </div>
                                                <div className="settings-info-item">
                                                    <span className="settings-info-label">תבניות אימייל:</span>
                                                    <span className="settings-info-value">HTML + RTL</span>
                                                </div>
                                                <div className="settings-info-item">
                                                    <span className="settings-info-label">אישור הזמנות:</span>
                                                    <span className="settings-info-value">✅ אוטומטי</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Database Backup Section */}
                            <div className="admin-section">
                                <div className="admin-section-header">
                                    <h3 className="admin-section-title">
                                        <span className="admin-section-icon">💾</span>
                                        גיבוי מסד נתונים
                                    </h3>
                                    <p className="admin-section-subtitle">הורד גיבוי מלא של כל הנתונים במערכת</p>
                                </div>
                                
                                <div className="admin-settings-grid">
                                    <div className="admin-settings-card">
                                        <div className="admin-settings-card-header">
                                            <h4>יצירת גיבוי</h4>
                                            <p>הורד קובץ עם כל נתוני המסד</p>
                                        </div>
                                        <div className="admin-settings-card-content">
                                            <div className="settings-info-grid mb-4">
                                                <div className="settings-info-item">
                                                    <span className="settings-info-label">כולל:</span>
                                                    <span className="settings-info-value">משתמשים, מוצרים, הזמנות</span>
                                                </div>
                                                <div className="settings-info-item">
                                                    <span className="settings-info-label">פורמט:</span>
                                                    <span className="settings-info-value">SQL / JSON</span>
                                                </div>
                                                <div className="settings-info-item">
                                                    <span className="settings-info-label">תדירות מומלצת:</span>
                                                    <span className="settings-info-value">שבועי</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <a
                                                    href="/api/admin/backup?format=sql"
                                                    download
                                                    className="admin-btn admin-btn-primary w-full"
                                                    style={{display: 'inline-block', textAlign: 'center', textDecoration: 'none'}}
                                                >
                                                    💾 הורד גיבוי SQL (מומלץ)
                                                </a>
                                                <small className="form-help text-center">
                                                    קובץ SQL שניתן להריץ ישירות ב-Supabase SQL Editor
                                                </small>
                                                <a
                                                    href="/api/admin/backup?format=json"
                                                    download
                                                    className="admin-btn admin-btn-secondary w-full"
                                                    style={{display: 'inline-block', textAlign: 'center', textDecoration: 'none', marginTop: '0.5rem'}}
                                                >
                                                    📄 הורד גיבוי JSON
                                                </a>
                                                <small className="form-help text-center">
                                                    קובץ JSON לשמירה ארכיונית
                                                </small>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="admin-settings-card">
                                        <div className="admin-settings-card-header">
                                            <h4>⚠️ חשוב לדעת</h4>
                                            <p>הנחיות לגיבוי והחזרת נתונים</p>
                                        </div>
                                        <div className="admin-settings-card-content">
                                            <ul className="settings-tips-list">
                                                <li>✅ גיבוי SQL ניתן להריץ ישירות ב-Supabase</li>
                                                <li>✅ פשוט העתק והדבק את תוכן הקובץ ל-SQL Editor</li>
                                                <li>✅ צור גיבוי לפני שינויים משמעותיים</li>
                                                <li>✅ שמור גיבויים מרובים (לא רק את האחרון)</li>
                                                <li>⚠️ קובץ הגיבוי מכיל נתונים רגישים</li>
                                                <li>⚠️ אל תשתף את הקובץ בפומבי</li>
                                                <li>🔄 השחזור ימחק נתונים קיימים!</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* WhatsApp Settings Section */}
                            <div className="admin-section">
                                <div className="admin-section-header">
                                    <h3 className="admin-section-title">
                                        <span className="admin-section-icon">💬</span>
                                        הגדרות WhatsApp
                                    </h3>
                                    <p className="admin-section-subtitle">נהל את קישור קבוצת העדכונים ב-WhatsApp</p>
                                </div>
                                
                                <div className="admin-settings-grid">
                                    <div className="admin-settings-card">
                                        <div className="admin-settings-card-header">
                                            <h4>קישור קבוצת WhatsApp</h4>
                                            <p>עדכן את הקישור לקבוצת העדכונים</p>
                                        </div>
                                        <div className="admin-settings-card-content">
                                            {whatsappUrlLoading ? (
                                                <div className="text-center py-4">
                                                    <span className="spinner"></span>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="form-group">
                                                        <label htmlFor="whatsapp_url">קישור קבוצת WhatsApp</label>
                                                        <input
                                                            type="url"
                                                            id="whatsapp_url"
                                                            value={whatsappUrl}
                                                            onChange={(e) => setWhatsappUrl(e.target.value)}
                                                            placeholder="https://chat.whatsapp.com/..."
                                                            className="admin-input"
                                                            dir="ltr"
                                                        />
                                                        <small className="form-help">
                                                            הזן את הקישור המלא לקבוצת WhatsApp (מתחיל ב-https://chat.whatsapp.com/)
                                                        </small>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={saveWhatsappUrl}
                                                            disabled={whatsappUrlSaving}
                                                            className="admin-btn admin-btn-primary"
                                                        >
                                                            {whatsappUrlSaving ? (
                                                                <>
                                                                    <span className="spinner"></span>
                                                                    שומר...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    💾 שמור שינויים
                                                                </>
                                                            )}
                                                        </button>
                                                        {whatsappUrl && (
                                                            <a
                                                                href={whatsappUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="admin-btn admin-btn-secondary"
                                                            >
                                                                🔗 בדוק קישור
                                                            </a>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="admin-settings-card">
                                        <div className="admin-settings-card-header">
                                            <h4>📋 מידע</h4>
                                            <p>הנחיות לשימוש</p>
                                        </div>
                                        <div className="admin-settings-card-content">
                                            <ul className="settings-tips-list">
                                                <li>✅ הקישור יופיע בראש דף החנות</li>
                                                <li>✅ לקוחות יוכלו להצטרף לקבוצה בלחיצה</li>
                                                <li>✅ מתאים לעדכונים על איסוף הזמנות</li>
                                                <li>💡 יש ליצור קבוצת WhatsApp ולהעתיק את קישור ההזמנה</li>
                                                <li>💡 הקישור צריך להתחיל ב-https://chat.whatsapp.com/</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Shop Settings Section Removed - Using static settings in shop page */}
                        </div>
                    )}
                </main>
            </div>

            {/* Shop Settings Modal Removed - Using static settings in shop page */}

            {/* Edit User Modal */}
            {showEditModal && (
                <div className="admin-modal-overlay" onClick={handleCloseEditModal}>
                    <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="admin-modal-header">
                            <h3>עריכת משתמש</h3>
                            <button 
                                className="admin-modal-close"
                                onClick={handleCloseEditModal}
                            >
                                ✕
                            </button>
                        </div>
                        
                        <form onSubmit={handleUpdateUser} className="admin-modal-form">
                            <div className="form-group">
                                <label htmlFor="edit_full_name">שם מלא *</label>
                                <input
                                    type="text"
                                    id="edit_full_name"
                                    name="full_name"
                                    value={editForm.full_name}
                                    onChange={handleFormChange}
                                    required
                                    dir="auto"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="edit_username">שם משתמש *</label>
                                <input
                                    type="text"
                                    id="edit_username"
                                    name="username"
                                    value={editForm.username}
                                    onChange={handleFormChange}
                                    required
                                    dir="auto"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="edit_email">אימייל *</label>
                                <input
                                    type="email"
                                    id="edit_email"
                                    name="email"
                                    value={editForm.email}
                                    onChange={handleFormChange}
                                    required
                                    dir="ltr"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="edit_phone">טלפון</label>
                                <input
                                    type="tel"
                                    id="edit_phone"
                                    name="phone"
                                    value={editForm.phone}
                                    onChange={handleFormChange}
                                    dir="ltr"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="edit_role">תפקיד *</label>
                                <select
                                    id="edit_role"
                                    name="role"
                                    value={editForm.role}
                                    onChange={handleFormChange}
                                    required
                                >
                                    <option value="user">משתמש</option>
                                    <option value="admin">מנהל</option>
                                </select>
                            </div>

                            <div className="admin-modal-actions">
                                <button 
                                    type="button"
                                    className="admin-btn-secondary"
                                    onClick={handleCloseEditModal}
                                >
                                    ביטול
                                </button>
                                <button 
                                    type="submit"
                                    className="admin-btn-primary"
                                    disabled={updateLoading}
                                >
                                    {updateLoading ? 'שומר...' : 'שמור שינויים'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {showResetModal && resetUser && (
                <div className="admin-modal-overlay" onClick={handleCloseResetModal}>
                    <div className="admin-modal reset-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="admin-modal-header">
                            <h3>איפוס סיסמה</h3>
                            <button 
                                className="admin-modal-close"
                                onClick={handleCloseResetModal}
                            >
                                ✕
                            </button>
                        </div>
                        
                        <div className="reset-modal-content">
                            <div className="reset-user-info">
                                <p>אתה עומד לאפס את הסיסמה עבור:</p>
                                <div className="user-card">
                                    <strong>{resetUser.full_name}</strong>
                                    <span>({resetUser.username})</span>
                                </div>
                            </div>

                            <div className="new-password-section">
                                <label>סיסמה חד-פעמית:</label>
                                <div className="password-display">
                                    <input 
                                        type="text" 
                                        value={newPassword} 
                                        readOnly 
                                        className="temp-password"
                                    />
                                    <button 
                                        type="button"
                                        className="copy-btn"
                                        onClick={() => {
                                            navigator.clipboard.writeText(newPassword);
                                            alert('הסיסמה הועתקה!');
                                        }}
                                        title="העתק"
                                    >
                                        📋
                                    </button>
                                </div>
                                <div className="email-info">
                                    <p className="email-notice">
                                        📧 אימייל יישלח אוטומטית ל: <strong>{resetUser.email}</strong>
                                    </p>
                                    <p className="password-note">
                                        ⚠️ המשתמש יקבל את הסיסמה החד-פעמית באימייל<br/>
                                        ויתבקש לשנות אותה בכניסה הראשונה
                                    </p>
                                </div>
                            </div>

                            <div className="admin-modal-actions">
                                <button 
                                    type="button"
                                    className="admin-btn-secondary"
                                    onClick={handleCloseResetModal}
                                >
                                    ביטול
                                </button>
                                <button 
                                    type="button"
                                    className="admin-btn-danger"
                                    onClick={confirmResetPassword}
                                    disabled={resetPasswordLoading}
                                >
                                    {resetPasswordLoading ? 'מאפס...' : 'אשר איפוס'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Product Modal */}
            {showProductModal && (
                <div className="admin-modal-overlay" onClick={handleCloseProductModal}>
                    <div className="admin-modal product-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="admin-modal-header">
                            <h3>{editingProduct ? 'עריכת מוצר' : 'הוסף מוצר חדש'}</h3>
                            <button 
                                className="admin-modal-close"
                                onClick={handleCloseProductModal}
                            >
                                ✕
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmitProduct} className="admin-modal-form">
                            <div className="form-group">
                                <label htmlFor="product_name">שם המוצר *</label>
                                <input
                                    type="text"
                                    id="product_name"
                                    name="name"
                                    value={productForm.name}
                                    onChange={handleProductFormChange}
                                    required
                                    dir="auto"
                                    placeholder="הכנס שם מוצר"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="product_category">קטגוריה</label>
                                <input
                                    type="text"
                                    id="product_category"
                                    name="category"
                                    value={productForm.category}
                                    onChange={handleProductFormChange}
                                    dir="auto"
                                    placeholder="לדוגמה: Pod, נוזלים, אביזרים"
                                />
                                <small className="form-help">
                                    הקטגוריה תוצג בחנות ובדוחות
                                </small>
                            </div>

                            <div className="form-group">
                                <label htmlFor="product_description">תיאור המוצר</label>
                                <textarea
                                    id="product_description"
                                    name="description"
                                    value={productForm.description}
                                    onChange={handleProductFormChange}
                                    dir="auto"
                                    rows={3}
                                    placeholder="הכנס תיאור מפורט של המוצר (אופציונלי)"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="product_price">מחיר (₪) *</label>
                                <input
                                    type="number"
                                    id="product_price"
                                    name="price"
                                    value={productForm.price}
                                    onChange={handleProductFormChange}
                                    required
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="product_image_url">קישור לתמונה</label>
                                <input
                                    type="url"
                                    id="product_image_url"
                                    name="image_url"
                                    value={productForm.image_url}
                                    onChange={handleProductFormChange}
                                    dir="ltr"
                                    placeholder="https://cdn.shopify.com/product-image.jpg"
                                />
                                <small className="form-help">
                                    הכנס קישור לתמונת המוצר או העלה תמונה למטה
                                </small>
                            </div>

                            <div className="form-group">
                                <label>העלאת תמונה</label>
                                <div className="image-upload-container">
                                    <input
                                        type="file"
                                        id="product_image_file"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        className="image-file-input"
                                    />
                                    <label htmlFor="product_image_file" className="image-upload-label">
                                        <span className="upload-icon">📷</span>
                                        <span>לחץ לבחירת תמונה</span>
                                        <small>PNG, JPG, GIF עד 5MB</small>
                                    </label>
                                </div>
                                
                                {imagePreview && (
                                    <div className="image-preview">
                                        <img 
                                            src={imagePreview} 
                                            alt="תצוגה מקדימה" 
                                            className="preview-image"
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                setImagePreview('');
                                                setProductForm(prev => ({...prev, image_url: ''}));
                                            }}
                                            className="remove-image-btn"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="admin-modal-actions">
                                <button 
                                    type="button"
                                    className="admin-btn-secondary"
                                    onClick={handleCloseProductModal}
                                >
                                    ביטול
                                </button>
                                <button 
                                    type="submit"
                                    className="admin-btn-primary"
                                    disabled={productLoading}
                                >
                                    {productLoading ? 'שומר...' : (editingProduct ? 'עדכן מוצר' : 'הוסף מוצר')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* User Orders Modal */}
            {showUserOrdersModal && selectedUser && (
                <div className="admin-modal-overlay" onClick={handleCloseUserOrdersModal}>
                    <div className="admin-modal user-orders-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="admin-modal-header">
                            <h3>הזמנות של {selectedUser.full_name}</h3>
                            <button 
                                className="admin-modal-close"
                                onClick={handleCloseUserOrdersModal}
                            >
                                ✕
                            </button>
                        </div>
                        
                        <div className="user-orders-content">
                            <div className="user-info-summary">
                                <div className="user-detail">
                                    <strong>שם:</strong> {selectedUser.full_name}
                                </div>
                                <div className="user-detail">
                                    <strong>אימייל:</strong> {selectedUser.email}
                                </div>
                                <div className="user-detail">
                                    <strong>טלפון:</strong> {selectedUser.phone || 'לא צוין'}
                                </div>
                                <div className="user-detail">
                                    <strong>תאריך הצטרפות:</strong> {new Date(selectedUser.created_at).toLocaleDateString('he-IL')}
                                </div>
                            </div>

                            <div className="orders-section">
                                <h4>היסטוריית הזמנות ({userOrders.length})</h4>
                                
                                {ordersLoading ? (
                                    <div className="orders-loading">
                                        <div className="spinner"></div>
                                        <p>טוען הזמנות...</p>
                                    </div>
                                ) : userOrders.length > 0 ? (
                                    <div className="orders-list">
                                        {userOrders.map((order) => (
                                            <div key={order.id} className="order-card">
                                                <div className="order-header">
                                                    <div className="order-id">
                                                        <strong>הזמנה #{order.id.slice(0, 8)}</strong>
                                                    </div>
                                                    <div className="order-date">
                                                        {new Date(order.created_at).toLocaleDateString('he-IL', {
                                                            year: 'numeric',
                                                            month: 'long',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </div>
                                                </div>
                                                
                                                <div className="order-details">
                                                    <div className="order-status">
                                                        <span className={`status-badge ${order.status}`}>
                                                            {order.status === 'pending' ? 'ממתין' : 
                                                             order.status === 'confirmed' ? 'מאושר' : 
                                                             order.status === 'delivered' ? 'נמסר' : 
                                                             order.status === 'cancelled' ? 'בוטל' : order.status}
                                                        </span>
                                                    </div>
                                                    <div className="order-total">
                                                        <strong>₪{order.total_amount}</strong>
                                                    </div>
                                                </div>

                                                {order.delivery_address && (
                                                    <div className="delivery-info">
                                                        <strong>כתובת משלוח:</strong> {order.delivery_address}
                                                    </div>
                                                )}

                                                {order.items && order.items.length > 0 && (
                                                    <div className="order-items">
                                                        <strong>פריטים:</strong>
                                                        <ul className="items-list">
                                                            {order.items.map((item, index) => (
                                                                <li key={index} className="order-item">
                                                                    <span className="item-name">{item.name}</span>
                                                                    <span className="item-details">
                                                                        כמות: {item.quantity} × ₪{item.price}
                                                                    </span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}

                                                {order.notes && (
                                                    <div className="order-notes">
                                                        <strong>הערות:</strong> {order.notes}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="no-orders">
                                        <div className="no-orders-icon">📦</div>
                                        <p>המשתמש לא ביצע הזמנות עדיין</p>
                                        <small>הזמנות שיבוצעו יופיעו כאן</small>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* General Order Modal */}
            {showGeneralOrderModal && (
                <div className="admin-modal-overlay" onClick={handleCloseGeneralOrderModal}>
                    <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="admin-modal-header">
                            <h3>{editingGeneralOrder ? 'עריכת הזמנה קבוצתית' : 'יצירת הזמנה קבוצתית חדשה'}</h3>
                            <button 
                                className="admin-modal-close"
                                onClick={handleCloseGeneralOrderModal}
                            >
                                ✕
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmitGeneralOrder} className="admin-modal-form">
                            <div className="form-group">
                                <label htmlFor="general_order_title">כותרת ההזמנה *</label>
                                <input
                                    type="text"
                                    id="general_order_title"
                                    name="title"
                                    value={generalOrderForm.title}
                                    onChange={handleGeneralOrderFormChange}
                                    required
                                    dir="auto"
                                    placeholder="הכנס כותרת להזמנה הקבוצתית"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="general_order_description">תיאור ההזמנה</label>
                                <textarea
                                    id="general_order_description"
                                    name="description"
                                    value={generalOrderForm.description}
                                    onChange={handleGeneralOrderFormChange}
                                    dir="auto"
                                    rows={3}
                                    placeholder="הכנס תיאור מפורט של ההזמנה הקבוצתית (אופציונלי)"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="general_order_deadline">תאריך וזמן סגירה *</label>
                                <input
                                    type="datetime-local"
                                    id="general_order_deadline"
                                    name="deadline"
                                    value={generalOrderForm.deadline}
                                    onChange={handleGeneralOrderFormChange}
                                    required
                                />
                                <small className="form-help">
                                    בחר תאריך וזמן שבהם ההזמנה הקבוצתית תיסגר אוטומטית
                                </small>
                            </div>

                            <div className="form-group">
                                <div className="checkbox-group">
                                    <input
                                        type="checkbox"
                                        id="schedule_opening"
                                        name="schedule_opening"
                                        checked={generalOrderForm.schedule_opening}
                                        onChange={(e) => {
                                            setGeneralOrderForm(prev => ({
                                                ...prev,
                                                schedule_opening: e.target.checked,
                                                // Clear opening_time if unchecking
                                                opening_time: e.target.checked ? prev.opening_time : ''
                                            }));
                                        }}
                                    />
                                    <label htmlFor="schedule_opening">תזמן פתיחה אוטומטית</label>
                                </div>
                                <small className="form-help">
                                    אם תבחר באפשרות זו, ההזמנה תישאר סגורה עד למועד הפתיחה שתקבע
                                </small>
                            </div>

                            {generalOrderForm.schedule_opening && (
                                <div className="form-group">
                                    <label htmlFor="general_order_opening_time">תאריך וזמן פתיחה *</label>
                                    <input
                                        type="datetime-local"
                                        id="general_order_opening_time"
                                        name="opening_time"
                                        value={generalOrderForm.opening_time}
                                        onChange={handleGeneralOrderFormChange}
                                        required={generalOrderForm.schedule_opening}
                                    />
                                    <small className="form-help">
                                        בחר תאריך וזמן שבהם ההזמנה הקבוצתית תיפתח אוטומטית למשתמשים
                                    </small>
                                </div>
                            )}

                            <div className="admin-modal-actions">
                                <button 
                                    type="button"
                                    className="admin-btn-secondary"
                                    onClick={handleCloseGeneralOrderModal}
                                >
                                    ביטול
                                </button>
                                <button 
                                    type="submit"
                                    className="admin-btn-primary"
                                    disabled={generalOrderLoading}
                                >
                                    {generalOrderLoading ? 'שומר...' : (editingGeneralOrder ? 'עדכן הזמנה' : 'צור הזמנה קבוצתית')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Notification Modal */}
            {showNotificationModal && (
                <div className="admin-modal-overlay" onClick={handleCloseNotificationModal}>
                    <div className="admin-modal notification-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="admin-modal-header">
                            <h3>🔔 שליחת התראת פוש</h3>
                            <button 
                                className="admin-modal-close"
                                onClick={handleCloseNotificationModal}
                            >
                                ✕
                            </button>
                        </div>
                        
                        <form onSubmit={handleSendNotification} className="admin-modal-form">
                            {/* Template Selection */}
                            {!templatesLoading && notificationTemplates.length > 0 && (
                                <div className="form-group">
                                    <label>תבניות מוכנות (אופציונלי)</label>
                                    <div className="templates-grid">
                                        {notificationTemplates.map((template) => (
                                            <button
                                                key={template.id}
                                                type="button"
                                                className={`template-button ${selectedTemplate?.id === template.id ? 'selected' : ''}`}
                                                onClick={() => handleSelectTemplate(template)}
                                            >
                                                <span className="template-icon">{template.icon}</span>
                                                <span className="template-name">{template.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                    {selectedTemplate && (
                                        <small className="form-help success">
                                            ✅ נבחרה תבנית: {selectedTemplate.name}
                                        </small>
                                    )}
                                </div>
                            )}

                            {/* Title */}
                            <div className="form-group">
                                <label htmlFor="notification_title">כותרת ההתראה *</label>
                                <input
                                    type="text"
                                    id="notification_title"
                                    name="title"
                                    value={notificationForm.title}
                                    onChange={handleNotificationFormChange}
                                    required
                                    dir="auto"
                                    placeholder="כותרת קצרה ומושכת"
                                    maxLength="50"
                                />
                                <small className="form-help">
                                    {notificationForm.title.length}/50 תווים
                                </small>
                            </div>

                            {/* Message */}
                            <div className="form-group">
                                <label htmlFor="notification_message">תוכן ההודעה *</label>
                                <textarea
                                    id="notification_message"
                                    name="message"
                                    value={notificationForm.message}
                                    onChange={handleNotificationFormChange}
                                    required
                                    dir="auto"
                                    placeholder="התוכן המלא של ההתראה"
                                    rows="3"
                                    maxLength="200"
                                />
                                <small className="form-help">
                                    {notificationForm.message.length}/200 תווים
                                </small>
                            </div>

                            {/* Audience Selection */}
                            <div className="form-group">
                                <label>קהל יעד *</label>
                                <div className="audience-options">
                                    <label className="radio-option">
                                        <input
                                            type="radio"
                                            name="audience"
                                            value="all"
                                            checked={notificationForm.audience === 'all'}
                                            onChange={(e) => handleAudienceChange(e.target.value)}
                                        />
                                        <span className="radio-label">
                                            🌐 כל המשתמשים
                                        </span>
                                    </label>
                                    <label className="radio-option">
                                        <input
                                            type="radio"
                                            name="audience"
                                            value="specific_users"
                                            checked={notificationForm.audience === 'specific_users'}
                                            onChange={(e) => handleAudienceChange(e.target.value)}
                                        />
                                        <span className="radio-label">
                                            👥 משתמשים נבחרים
                                        </span>
                                    </label>
                                    <label className="radio-option">
                                        <input
                                            type="radio"
                                            name="audience"
                                            value="admins_only"
                                            checked={notificationForm.audience === 'admins_only'}
                                            onChange={(e) => handleAudienceChange(e.target.value)}
                                        />
                                        <span className="radio-label">
                                            👑 מנהלים בלבד
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* User Selection for Specific Users */}
                            {notificationForm.audience === 'specific_users' && (
                                <div className="form-group">
                                    <label>בחר משתמשים</label>
                                    {usersForNotificationLoading ? (
                                        <div className="users-loading">
                                            <span className="spinner-sm"></span>
                                            <span>טוען משתמשים...</span>
                                        </div>
                                    ) : availableUsers.length > 0 ? (
                                        <div className="users-selection">
                                            {availableUsers.map((user) => (
                                                <label key={user.id} className="user-checkbox">
                                                    <input
                                                        type="checkbox"
                                                        checked={notificationForm.userIds.includes(user.id)}
                                                        onChange={(e) => handleUserSelection(user.id, e.target.checked)}
                                                    />
                                                    <span className="user-info">
                                                        <span className="user-name">{user.name}</span>
                                                        <span className="user-email">{user.email}</span>
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="users-loading" style={{color: '#ef4444'}}>
                                            <span>❌</span>
                                            <span>לא נמצאו משתמשים. אנא רענן את העמוד ונסה שוב.</span>
                                        </div>
                                    )}
                                    <small className="form-help">
                                        נבחרו {notificationForm.userIds.length} משתמשים
                                    </small>
                                </div>
                            )}

                            {/* Additional Options */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="notification_icon">אייקון (אופציונלי)</label>
                                    <input
                                        type="text"
                                        id="notification_icon"
                                        name="icon"
                                        value={notificationForm.icon}
                                        onChange={handleNotificationFormChange}
                                        dir="ltr"
                                        placeholder="🔔 או URL לתמונה"
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="notification_url">קישור (אופציונלי)</label>
                                    <input
                                        type="url"
                                        id="notification_url"
                                        name="url"
                                        value={notificationForm.url}
                                        onChange={handleNotificationFormChange}
                                        dir="ltr"
                                        placeholder="/shop או https://..."
                                    />
                                </div>
                            </div>

                            {/* Scheduled Sending */}
                            <div className="form-group">
                                <label htmlFor="notification_scheduled_at">תזמון שליחה (אופציונלי)</label>
                                <input
                                    type="datetime-local"
                                    id="notification_scheduled_at"
                                    name="scheduledAt"
                                    value={notificationForm.scheduledAt}
                                    onChange={handleNotificationFormChange}
                                    min={new Date().toISOString().slice(0, 16)}
                                />
                                <small className="form-help">
                                    השאר ריק לשליחה מיידית או בחר תאריך ושעה לשליחה מתוזמנת
                                </small>
                            </div>

                            {/* Preview */}
                            {(notificationForm.title || notificationForm.message) && (
                                <div className="form-group">
                                    <label>תצוגה מקדימה</label>
                                    <div className="notification-preview">
                                        <div className="preview-header">
                                            <span className="preview-icon">
                                                {notificationForm.icon || '🔔'}
                                            </span>
                                            <span className="preview-title">
                                                {notificationForm.title || 'כותרת ההתראה'}
                                            </span>
                                        </div>
                                        <div className="preview-body">
                                            {notificationForm.message || 'תוכן ההתראה יופיע כאן...'}
                                        </div>
                                        <div className="preview-meta">
                                            <span>וייפ שופ • כעת</span>
                                            {notificationForm.audience === 'all' && ' • לכל המשתמשים'}
                                            {notificationForm.audience === 'specific_users' && ` • ל-${notificationForm.userIds.length} משתמשים`}
                                            {notificationForm.audience === 'admins_only' && ' • למנהלים בלבד'}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="admin-modal-actions">
                                <button 
                                    type="button"
                                    className="admin-btn-secondary"
                                    onClick={handleCloseNotificationModal}
                                >
                                    ביטול
                                </button>
                                <button 
                                    type="submit"
                                    className="admin-btn-primary"
                                    disabled={sendNotificationLoading || !notificationForm.title || !notificationForm.message}
                                >
                                    {sendNotificationLoading ? (
                                        <>
                                            <span className="spinner-sm"></span>
                                            שולח...
                                        </>
                                    ) : (
                                        <>
                                            <span className="ml-2">
                                                {notificationForm.scheduledAt ? '⏰' : '🚀'}
                                            </span>
                                            {notificationForm.scheduledAt ? 'תזמן התראה' : 'שלח כעת'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {showConfirmModal && (
                <div className="admin-modal-overlay" onClick={() => setShowConfirmModal(false)}>
                    <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="admin-modal-header">
                            <h3 className="admin-modal-title">{confirmTitle}</h3>
                            <button 
                                className="admin-modal-close"
                                onClick={() => setShowConfirmModal(false)}
                            >
                                ✕
                            </button>
                        </div>
                        <div className="admin-modal-body">
                            <div className="confirm-modal-content">
                                <div className="confirm-icon">⚠️</div>
                                <p className="confirm-message">{confirmMessage}</p>
                            </div>
                        </div>
                        <div className="admin-modal-actions">
                            <button 
                                type="button"
                                className="admin-btn-secondary"
                                onClick={() => setShowConfirmModal(false)}
                            >
                                ביטול
                            </button>
                            <button 
                                type="button"
                                className={confirmButtonClass}
                                onClick={handleConfirmAction}
                            >
                                {confirmButtonText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}