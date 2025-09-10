import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET - Test endpoint to check general orders in database
export async function GET() {
  try {
    console.log('Testing database connection...');
    
    // Get all general orders regardless of status
    const { data: allOrders, error: allError } = await supabase
      .from('general_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (allError) {
      console.error('Database error:', allError);
      return NextResponse.json({ 
        error: 'Database connection failed', 
        details: allError.message 
      }, { status: 500 });
    }

    // Get only open orders
    const now = new Date().toISOString();
    const { data: openOrders, error: openError } = await supabase
      .from('general_orders')
      .select('*')
      .eq('status', 'open')
      .gte('deadline', now);

    if (openError) {
      console.error('Open orders query error:', openError);
      return NextResponse.json({ 
        error: 'Open orders query failed', 
        details: openError.message 
      }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Database connection successful',
      timestamp: new Date().toISOString(),
      total_orders: allOrders.length,
      open_orders: openOrders.length,
      all_orders: allOrders,
      active_orders: openOrders
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Unexpected error', 
      details: error.message 
    }, { status: 500 });
  }
}