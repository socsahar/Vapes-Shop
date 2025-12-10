import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';

// GET - Fetch all products
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const category = searchParams.get('category');

        let query = supabaseAdmin
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        if (category) {
            query = query.eq('category', category);
        }

        const { data: products, error } = await query;

        if (error) {
            console.error('Error fetching products:', error);
            return NextResponse.json(
                { error: 'שגיאה בטעינת המוצרים' },
                { status: 500 }
            );
        }

        return NextResponse.json({ products });

    } catch (error) {
        console.error('Products API error:', error);
        return NextResponse.json(
            { error: 'שגיאה בשרת' },
            { status: 500 }
        );
    }
}

// POST - Create new product
export async function POST(request) {
    try {
        const product = await request.json();

        const { name, description, price, category, image_url } = product;

        if (!name || !price) {
            return NextResponse.json(
                { error: 'שם ומחיר הם שדות חובה' },
                { status: 400 }
            );
        }

        const { data: newProduct, error } = await supabaseAdmin
            .from('products')
            .insert([{
                name,
                description: description || '',
                price: parseFloat(price),
                category: category || null,
                stock_quantity: 999, // Default large stock
                image_url: image_url || null
            }])
            .select()
            .single();

        if (error) {
            console.error('Error creating product:', error);
            return NextResponse.json(
                { error: 'שגיאה ביצירת המוצר' },
                { status: 500 }
            );
        }

        return NextResponse.json({ 
            product: newProduct,
            message: 'המוצר נוצר בהצלחה'
        }, { status: 201 });

    } catch (error) {
        console.error('Create product error:', error);
        return NextResponse.json(
            { error: 'שגיאה בשרת' },
            { status: 500 }
        );
    }
}