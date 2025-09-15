import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET - Get shop status
export async function GET() {
  try {
    // Get the first/latest shop status record instead of using .single()
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
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching shop status:', error);
      return NextResponse.json(
        { error: 'שגיאה בטעינת סטטוס החנות' },
        { status: 500 }
      );
    }

    // If no shop status exists, create a default one
    if (!shopStatus || shopStatus.length === 0) {
      const { data: newStatus, error: createError } = await supabase
        .from('shop_status')
        .insert({ 
          is_open: false, 
          message: 'החנות סגורה כרגע' 
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating default shop status:', createError);
        return NextResponse.json(
          { error: 'שגיאה ביצירת סטטוס החנות' },
          { status: 500 }
        );
      }

      return NextResponse.json(newStatus);
    }

    return NextResponse.json(shopStatus[0]);

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

    // If only message is provided, update message directly
    if (message !== undefined && is_open === undefined) {
      // Get the latest shop status record
      const { data: currentStatus, error: fetchError } = await supabase
        .from('shop_status')
        .select('id')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (fetchError || !currentStatus || currentStatus.length === 0) {
        console.error('Error fetching shop status:', fetchError);
        return NextResponse.json(
          { error: 'שגיאה בטעינת סטטוס החנות' },
          { status: 500 }
        );
      }

      // Parse the message if it contains JSON data for instructions
      let messageToSave = message;
      if (typeof message === 'object') {
        // If message is an object, stringify it to save structured data
        messageToSave = JSON.stringify(message);
      }

      // Update the message using the correct UUID
      const { error } = await supabase
        .from('shop_status')
        .update({ 
          message: messageToSave,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentStatus[0].id);

      if (error) {
        console.error('Error updating shop message:', error);
        return NextResponse.json(
          { error: 'שגיאה בעדכון הודעת החנות' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: 'הודעת החנות עודכנה בהצלחה'
      });
    }

    // Otherwise use the RPC function for full status toggle
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