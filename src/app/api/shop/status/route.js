import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET - Get shop status
export async function GET() {
  try {
    const { data: shopStatus, error } = await supabase
      .from('shop_status')
      .select(`
        *,
        current_general_order:current_general_order_id(
          id,
          title,
          description,
          deadline,
          status
        )
      `)
      .single();

    if (error) {
      console.error('Error fetching shop status:', error);
      return NextResponse.json(
        { error: 'שגיאה בטעינת סטטוס החנות' },
        { status: 500 }
      );
    }

    return NextResponse.json(shopStatus);

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'שגיאה בשרת' },
      { status: 500 }
    );
  }
}

// PUT - Update shop status (admin only)
export async function PUT(request) {
  try {
    const body = await request.json();
    const { is_open, current_general_order_id, message } = body;

    const { error } = await supabase
      .rpc('toggle_shop_status', {
        open_status: is_open,
        general_order_id: current_general_order_id || null,
        status_message: message
      });

    if (error) {
      console.error('Error updating shop status:', error);
      return NextResponse.json(
        { error: 'שגיאה בעדכון סטטוס החנות' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'סטטוס החנות עודכן בהצלחה'
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'שגיאה בשרת' },
      { status: 500 }
    );
  }
}