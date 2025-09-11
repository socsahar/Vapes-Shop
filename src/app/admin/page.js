'use client';

import React, { useState, useEffect } from 'react';
import { getCurrentUser, signOut, getAuthHeaders } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { showToast } from '../../components/Toast';

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
    const router = useRouter();

    useEffect(() => {
        const currentUser = getCurrentUser();
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
    }, [router]);

    const handleLogout = async () => {
        await signOut();
        router.push('/');
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

    const fetchStats = async () => {
        try {
            const response = await fetch('/api/admin/stats');
            if (response.ok) {
                const data = await response.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const fetchRecentActivity = async () => {
        try {
            setActivityLoading(true);
            const response = await fetch('/api/admin/activity');
            if (response.ok) {
                const data = await response.json();
                setRecentActivity(data.activities || []);
            }
        } catch (error) {
            console.error('Error fetching activity:', error);
        } finally {
            setActivityLoading(false);
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

    const handleDeleteProduct = async (productId) => {
        if (!confirm('האם אתה בטוח שברצונך למחוק את המוצר?')) {
            return;
        }

        try {
            const response = await fetch(`/api/products/${productId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await fetchProducts(); // Refresh the products list
                showToast('המוצר נמחק בהצלחה!', 'success');
            } else {
                const error = await response.json();
                showToast(`שגיאה במחיקת המוצר: ${error.error}`, 'error');
            }
        } catch (error) {
            console.error('Error deleting product:', error);
            showToast('שגיאה במחיקת המוצר', 'error');
        }
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
            deadline: new Date(order.deadline).toISOString().slice(0, 16),
            opening_time: order.opening_time ? new Date(order.opening_time).toISOString().slice(0, 16) : '',
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
                ...generalOrderForm,
                created_by: user.id,
                // Set opening_time to null if not scheduling
                opening_time: generalOrderForm.schedule_opening ? generalOrderForm.opening_time : null
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

    // Fetch data when tab changes
    useEffect(() => {
        if (activeTab === 'users') {
            fetchUsers();
        } else if (activeTab === 'dashboard') {
            fetchStats();
            fetchRecentActivity();
        } else if (activeTab === 'products') {
            fetchProducts();
        } else if (activeTab === 'orders') {
            fetchAllOrders();
        } else if (activeTab === 'group-orders') {
            fetchGeneralOrders();
        }
    }, [activeTab]);

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


                        <div className="flex items-center space-x-4 space-x-reverse -ml-20">
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
                        
                        <nav className="flex items-center space-x-4 space-x-reverse">
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
                {/* Sidebar */}
                <aside className="admin-sidebar">
                    <div className="admin-sidebar-header">
                        <h3>תפריט ניווט</h3>
                    </div>
                    <nav className="admin-nav">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
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
                                <div className="admin-stat-card revenue">
                                    <div className="admin-stat-icon">💰</div>
                                    <div className="admin-stat-content">
                                        <div className="admin-stat-number">₪{stats.revenue}</div>
                                        <div className="admin-stat-label">הכנסות</div>
                                    </div>
                                </div>
                            </div>

                            {/* Recent Activity */}
                            <div className="admin-section">
                                <div className="admin-section-header">
                                    <h3 className="admin-section-title">פעילות אחרונה</h3>
                                </div>
                                {activityLoading ? (
                                    <div className="admin-loading">
                                        <div className="loading-spinner"></div>
                                        <p>טוען נתונים...</p>
                                    </div>
                                ) : recentActivity && recentActivity.length > 0 ? (
                                    <div className="activity-feed">
                                        {recentActivity.map((activity, index) => (
                                            <div key={index} className="activity-item">
                                                <div className="activity-icon">
                                                    {activity.type === 'order' && '📋'}
                                                    {activity.type === 'user' && '👤'}
                                                    {activity.type === 'product' && '📦'}
                                                    {activity.type === 'password_reset' && '🔑'}
                                                    {activity.type === 'user_update' && '✏️'}
                                                </div>
                                                <div className="activity-content">
                                                    <p className="activity-description">{activity.description}</p>
                                                    <p className="activity-time">{activity.time}</p>
                                                </div>
                                                <div className={`activity-status ${activity.status || ''}`}>
                                                    {activity.status === 'new' && 'חדש'}
                                                    {activity.status === 'pending' && 'ממתין'}
                                                    {activity.status === 'completed' && 'הושלם'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="admin-empty-state">
                                        <div className="admin-empty-icon">📊</div>
                                        <p className="admin-empty-text">אין פעילות אחרונה</p>
                                        <p className="admin-empty-subtext">כאשר תהיה פעילות במערכת, היא תוצג כאן</p>
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
                                                    <th className="hide-mobile">תיאור</th>
                                                    <th>מחיר</th>
                                                    <th className="hide-mobile">תאריך יצירה</th>
                                                    <th>פעולות</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {products.map((product) => (
                                                    <tr key={product.id}>
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
                                                            <div className="max-w-xs truncate" title={product.description}>
                                                                {product.description}
                                                            </div>
                                                        </td>
                                                        <td className="font-bold text-green-600">₪{product.price}</td>
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
                                                                    className="admin-btn-small delete"
                                                                    onClick={() => handleDeleteProduct(product.id)}
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
                                                    <th className="hide-mobile">סוג הזמנה</th>
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
                                                                {order.general_order_id ? (
                                                                    <span className="text-blue-600 font-medium">
                                                                        📦 הזמנה קבוצתית
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-gray-600">
                                                                        🛒 הזמנה רגילה
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
                        </div>
                    )}
                </main>
            </div>

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
        </div>
    );
}