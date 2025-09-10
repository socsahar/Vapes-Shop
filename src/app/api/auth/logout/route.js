import { NextResponse } from 'next/server';

export async function POST() {
    try {
        return NextResponse.json(
            { message: 'התנתקת בהצלחה' },
            { status: 200 }
        );
    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json(
            { error: 'שגיאה בהתנתקות' },
            { status: 500 }
        );
    }
}