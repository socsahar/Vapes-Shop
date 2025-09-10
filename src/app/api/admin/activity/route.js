import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
  try {
    const activities = [];

    // Get recent orders
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, user_id, total_amount, status, created_at, users!orders_user_id_fkey(full_name)')
      .order('created_at', { ascending: false })
      .limit(5);

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
    } else if (orders) {
      orders.forEach(order => {
        activities.push({
          type: 'order',
          description: `הזמנה חדשה מ-${order.users?.full_name || 'משתמש'} בסך ₪${order.total_amount}`,
          time: formatRelativeTime(order.created_at),
          status: order.status === 'pending' ? 'new' : order.status === 'processing' ? 'pending' : 'completed'
        });
      });
    }

    // Get recent users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, full_name, email, created_at')
      .order('created_at', { ascending: false })
      .limit(3);

    if (usersError) {
      console.error('Error fetching users:', usersError);
    } else if (users) {
      users.forEach(user => {
        activities.push({
          type: 'user',
          description: `משתמש חדש נרשם: ${user.full_name}`,
          time: formatRelativeTime(user.created_at),
          status: 'new'
        });
      });
    }

    // Get recent products
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(3);

    if (productsError) {
      console.error('Error fetching products:', productsError);
    } else if (products) {
      products.forEach(product => {
        const isNew = new Date(product.created_at).getTime() === new Date(product.updated_at).getTime();
        activities.push({
          type: 'product',
          description: `${isNew ? 'מוצר חדש נוסף' : 'מוצר עודכן'}: ${product.name}`,
          time: formatRelativeTime(product.updated_at),
          status: isNew ? 'new' : 'completed'
        });
      });
    }

    // Sort all activities by time (most recent first)
    activities.sort((a, b) => {
      // Convert relative time back to timestamp for sorting
      const aTime = convertRelativeToTimestamp(a.time);
      const bTime = convertRelativeToTimestamp(b.time);
      return bTime - aTime;
    });

    // Return the 10 most recent activities
    return NextResponse.json(activities.slice(0, 10));

  } catch (error) {
    console.error('Error fetching activity:', error);
    return NextResponse.json(
      { error: 'שגיאה בטעינת הנתונים' },
      { status: 500 }
    );
  }
}

function formatRelativeTime(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const diffInMinutes = Math.floor((now - date) / (1000 * 60));

  if (diffInMinutes < 1) {
    return 'כעת';
  } else if (diffInMinutes < 60) {
    return `לפני ${diffInMinutes} דקות`;
  } else if (diffInMinutes < 1440) { // 24 hours
    const hours = Math.floor(diffInMinutes / 60);
    return `לפני ${hours} שעות`;
  } else {
    const days = Math.floor(diffInMinutes / 1440);
    return `לפני ${days} ימים`;
  }
}

function convertRelativeToTimestamp(relativeTime) {
  const now = Date.now();
  
  if (relativeTime === 'כעת') {
    return now;
  }
  
  if (relativeTime.includes('דקות')) {
    const minutes = parseInt(relativeTime.match(/\d+/)[0]);
    return now - (minutes * 60 * 1000);
  }
  
  if (relativeTime.includes('שעות')) {
    const hours = parseInt(relativeTime.match(/\d+/)[0]);
    return now - (hours * 60 * 60 * 1000);
  }
  
  if (relativeTime.includes('ימים')) {
    const days = parseInt(relativeTime.match(/\d+/)[0]);
    return now - (days * 24 * 60 * 60 * 1000);
  }
  
  return now;
}