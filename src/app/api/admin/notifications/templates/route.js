import { NextResponse } from 'next/server';

// Pre-defined notification templates
const notificationTemplates = [
    {
        id: 'new_products',
        name: '🛍️ מוצרים חדשים',
        title: '🎉 מוצרים חדשים הגיעו לחנות!',
        body: 'בואו לבדוק את המוצרים החדשים שהגיעו אלינו השבוע',
        icon: '🛍️',
        url: '/shop',
        category: 'products'
    },
    {
        id: 'group_order_open',
        name: '📦 הזמנה קבוצתית נפתחה',
        title: '📦 הזמנה קבוצתית חדשה!',
        body: 'הזמנה קבוצתית חדשה נפתחה - הצטרפו עד הסגירה!',
        icon: '📦',
        url: '/shop',
        category: 'orders'
    },
    {
        id: 'group_order_reminder',
        name: '⏰ תזכורת הזמנה קבוצתית',
        title: '⏰ הזמנה קבוצתית נסגרת בקרוב!',
        body: 'נותרו {time_left} עד סגירת ההזמנה הקבוצתית',
        icon: '⏰',
        url: '/shop',
        category: 'orders'
    },
    {
        id: 'order_status',
        name: '📋 עדכון סטטוס הזמנה',
        title: '📋 עדכון בהזמנה שלכם',
        body: 'ההזמנה שלכם עודכנה לסטטוס: {status}',
        icon: '📋',
        url: '/orders',
        category: 'orders'
    },
    {
        id: 'special_offer',
        name: '🔥 הצעה מיוחדת',
        title: '🔥 הצעה מיוחדת רק לכם!',
        body: 'זה הזמן לחסוך! הנחות של עד {discount}% על מוצרים נבחרים',
        icon: '🔥',
        url: '/shop',
        category: 'promotions'
    },
    {
        id: 'shop_opening',
        name: '🏪 החנות נפתחה',
        title: '🏪 החנות שלנו נפתחה!',
        body: 'החנות פתוחה וזמינה להזמנות. בואו לקנות!',
        icon: '🏪',
        url: '/shop',
        category: 'system'
    },
    {
        id: 'shop_closing',
        name: '🔒 החנות נסגרת',
        title: '🔒 החנות נסגרת בקרוב',
        body: 'החנות תיסגר בעוד {time_left}. מהרו להזמין!',
        icon: '🔒',
        url: '/shop',
        category: 'system'
    },
    {
        id: 'welcome_new_user',
        name: '👋 ברוכים הבאים',
        title: '👋 ברוכים הבאים לוייפ שופ!',
        body: 'תודה שהצטרפתם אלינו! התחילו לגלות את המוצרים שלנו',
        icon: '👋',
        url: '/shop',
        category: 'system'
    },
    {
        id: 'stock_alert',
        name: '📉 התראת מלאי',
        title: '📉 מלאי נמוך במוצר פופולרי!',
        body: 'מהרו! נותרו רק יחידות בודדות מ{product_name}',
        icon: '📉',
        url: '/shop',
        category: 'products'
    },
    {
        id: 'custom',
        name: '✏️ הודעה מותאמת אישית',
        title: '',
        body: '',
        icon: '💬',
        url: '',
        category: 'custom'
    }
];

export async function GET() {
    try {
        // Group templates by category for better organization
        const categorizedTemplates = {
            orders: notificationTemplates.filter(t => t.category === 'orders'),
            products: notificationTemplates.filter(t => t.category === 'products'),
            promotions: notificationTemplates.filter(t => t.category === 'promotions'),
            system: notificationTemplates.filter(t => t.category === 'system'),
            custom: notificationTemplates.filter(t => t.category === 'custom')
        };
        
        return NextResponse.json({
            success: true,
            templates: notificationTemplates,
            categorized: categorizedTemplates,
            categories: [
                { id: 'orders', name: 'הזמנות', icon: '📦' },
                { id: 'products', name: 'מוצרים', icon: '🛍️' },
                { id: 'promotions', name: 'קידום מכירות', icon: '🔥' },
                { id: 'system', name: 'מערכת', icon: '⚙️' },
                { id: 'custom', name: 'מותאם אישית', icon: '✏️' }
            ]
        });
        
    } catch (error) {
        console.error('Error fetching notification templates:', error);
        return NextResponse.json(
            { error: 'Failed to fetch templates' },
            { status: 500 }
        );
    }
}