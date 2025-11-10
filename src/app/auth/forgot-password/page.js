'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [emailSent, setEmailSent] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setMessage('');

        try {
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (response.ok) {
                setEmailSent(true);
                setMessage('ניתן לסגור את החלון ולהמשיך מהמייל');
            } else {
                setError(data.error || 'שגיאה בשליחת האימייל');
            }
        } catch (error) {
            setError('שגיאה בשליחת האימייל');
        }

        setIsLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 auth-page">
            {/* Forgot Password Form */}
            <div className="relative w-full max-w-md animate-slide-up">
                <div className="auth-card p-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold auth-title mb-2">
                            שכחת סיסמה?
                        </h1>
                        {!emailSent && (
                            <p className="auth-subtitle">
                                הזן את כתובת האימייל שלך ונשלח לך קישור לאיפוס הסיסמה
                            </p>
                        )}
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="auth-error text-center">
                            {error}
                        </div>
                    )}

                    {/* Success Message - Show only after email sent */}
                    {emailSent ? (
                        <div className="text-center space-y-6 animate-scale-in">
                            <div className="glass-card p-6 neon-border">
                                <div className="text-lg font-semibold mb-2 neon-text">
                                    ✅ האימייל נשלח בהצלחה!
                                </div>
                                <p className="text-sm" style={{color: 'var(--text-secondary)'}}>
                                    {message}
                                </p>
                            </div>
                            
                            {/* Back to login link */}
                            <div className="pt-4">
                                <Link 
                                    href="/auth/login" 
                                    className="auth-link text-lg"
                                >
                                    חזרה לכניסה למערכת
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Forgot Password Form - Show only if email not sent */}
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label htmlFor="email">
                                        כתובת אימייל
                                    </label>
                                    <input
                                        type="email"
                                        id="email"
                                        name="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        placeholder="הזן כתובת אימייל"
                                        dir="ltr"
                                        className="text-left"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="btn-auth-primary"
                                >
                                    {isLoading ? (
                                        <div className="flex items-center justify-center">
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white ml-2"></div>
                                            שולח...
                                        </div>
                                    ) : (
                                        'שלח קישור לאיפוס סיסמה'
                                    )}
                                </button>
                            </form>

                            {/* Footer Links - Show only if email not sent */}
                            <div className="mt-8 text-center space-y-4">
                                <Link 
                                    href="/auth/login" 
                                    className="auth-link"
                                >
                                    זוכר את הסיסמה? כניסה למערכת
                                </Link>
                                
                                <div>
                                    <Link 
                                        href="/auth/register" 
                                        className="auth-link"
                                    >
                                        אין לך חשבון? הירשם כאן
                                    </Link>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}