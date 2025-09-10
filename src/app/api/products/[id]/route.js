import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';

// GET - Fetch single product
export async function GET(request, { params }) {
    try {
        const { id } = await params;

        const { data: product, error } = await supabaseAdmin
            .from('products')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !product) {
            return NextResponse.json(
                { error: 'המוצר לא נמצא' },
                { status: 404 }
            );
        }

        return NextResponse.json({ product });

    } catch (error) {
        console.error('Get product error:', error);
        return NextResponse.json(
            { error: 'שגיאה בשרת' },
            { status: 500 }
        );
    }
}

// PUT - Update product
export async function PUT(request, { params }) {
    try {
        const { id } = await params;
        const updates = await request.json();

        // Log the update data to help debug
        console.log('Product update data:', updates);
        
        // Check field lengths to identify the problematic field
        const fieldLengths = {};
        Object.keys(updates).forEach(key => {
            if (typeof updates[key] === 'string') {
                fieldLengths[key] = updates[key].length;
            }
        });
        console.log('Field lengths:', fieldLengths);

        // Validate and truncate field lengths against known limits
        const fieldLimits = {
            name: 255,
            category: 100,
            sku: 50,
            status: 20,
            // description is TEXT (unlimited)
            // image_url is TEXT (unlimited)
        };

        const truncatedUpdates = { ...updates };
        let truncationWarnings = [];

        for (const [field, limit] of Object.entries(fieldLimits)) {
            if (truncatedUpdates[field] && truncatedUpdates[field].length > limit) {
                truncatedUpdates[field] = truncatedUpdates[field].substring(0, limit);
                truncationWarnings.push(`השדה "${field}" קוצר ל-${limit} תווים`);
            }
        }

        // Special handling for potential 500-char limit fields
        // Check for any string field longer than 500 chars and truncate
        for (const [field, value] of Object.entries(truncatedUpdates)) {
            if (typeof value === 'string' && value.length > 500 && !fieldLimits[field]) {
                console.warn(`Auto-truncating field '${field}' from ${value.length} to 500 characters`);
                truncatedUpdates[field] = value.substring(0, 500);
                truncationWarnings.push(`השדה "${field}" קוצר ל-500 תווים`);
            }
        }

        const { data: product, error } = await supabaseAdmin
            .from('products')
            .update({
                ...truncatedUpdates,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating product:', error);
            return NextResponse.json(
                { error: 'שגיאה בעדכון המוצר: ' + error.message },
                { status: 500 }
            );
        }

        const response = { 
            product,
            message: 'המוצר עודכן בהצלחה'
        };

        if (truncationWarnings.length > 0) {
            response.warnings = truncationWarnings;
            response.message += ' (חלק מהשדות קוצרו)';
        }

        return NextResponse.json(response);

    } catch (error) {
        console.error('Update product error:', error);
        return NextResponse.json(
            { error: 'שגיאה בשרת' },
            { status: 500 }
        );
    }
}

// DELETE - Delete product
export async function DELETE(request, { params }) {
    try {
        const { id } = await params;

        const { error } = await supabaseAdmin
            .from('products')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting product:', error);
            return NextResponse.json(
                { error: 'שגיאה במחיקת המוצר' },
                { status: 500 }
            );
        }

        return NextResponse.json({ 
            message: 'המוצר נמחק בהצלחה'
        });

    } catch (error) {
        console.error('Delete product error:', error);
        return NextResponse.json(
            { error: 'שגיאה בשרת' },
            { status: 500 }
        );
    }
}