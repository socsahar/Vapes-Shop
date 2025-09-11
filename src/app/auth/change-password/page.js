'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ChangePasswordForm() {
    const [formData, setFormData] = useState({
        newPassword: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [token, setToken] = useState('');
    const [tokenValid, setTokenValid] = useState(false);
    const [success, setSuccess] = useState(false);
    
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const tokenParam = searchParams.get('token');
        if (tokenParam) {
            setToken(tokenParam);
            validateToken(tokenParam);
        } else {
            setError('אסימון איפוס סיסמה חסר');
        }
    }, [searchParams]);

    const validateToken = async (tokenValue) => {
        try {
            const response = await fetch('/api/auth/validate-reset-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token: tokenValue }),
            });

            const data = await response.json();
            if (response.ok && data.valid) {
                setTokenValid(true);
            } else {
                setError('הקישור פג תוקף');
            }
        } catch (error) {
            setError('שגיאה בבדיקת הקישור');
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validate passwords
        if (!formData.newPassword || !formData.confirmPassword) {
            setError('אנא מלא את כל השדות');
            return;
        }

        if (formData.newPassword !== formData.confirmPassword) {
            setError('הסיסמאות אינן תואמות');
            return;
        }

        if (formData.newPassword.length < 6) {
            setError('הסיסמה חייבת להכיל לפחות 6 תווים');
            return;
        }

        try {
            setLoading(true);
            const response = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token: token,
                    newPassword: formData.newPassword
                }),
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess(true);
                setTimeout(() => {
                    router.push('/auth/login');
                }, 3000);
            } else {
                setError(data.error || 'שגיאה בשינוי הסיסמה');
            }
        } catch (error) {
            setError('שגיאה בשינוי הסיסמה');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 auth-page">
                <div className="fixed inset-0 bg-gradient-cosmic opacity-50"></div>
                <div className="fixed inset-0 bg-pattern opacity-5"></div>
                
                <div className="relative w-full max-w-md">
                    <div className="auth-card p-8 text-center">
                        <div className="mb-4">
                            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        </div>
                        <h2 className="text-2xl font-bold text-green-600 mb-2">הסיסמה שונתה בהצלחה!</h2>
                        <p className="text-gray-600 mb-4">הסיסמה שלך עודכנה. מעביר אותך לעמוד ההתחברות...</p>
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 auth-page">
            <div className="fixed inset-0 bg-gradient-cosmic opacity-50"></div>
            <div className="fixed inset-0 bg-pattern opacity-5"></div>
            
            <div className="relative w-full max-w-md">
                <div className="auth-card p-8">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-2xl">🔑</span>
                        </div>
                        <h1 className="auth-title mb-2">
                            שינוי סיסמה
                        </h1>
                        <p className="auth-subtitle">
                            {tokenValid ? 'הזן סיסמה חדשה עבור החשבון שלך' : 'בודק אסימון איפוס...'}
                        </p>
                    </div>

                    {error && (
                        <div className="auth-error text-center">
                            {error}
                        </div>
                    )}

                    {tokenValid && (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label htmlFor="newPassword">
                                    סיסמה חדשה *
                                </label>
                                <input
                                    type="password"
                                    id="newPassword"
                                    name="newPassword"
                                    value={formData.newPassword}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="הזן סיסמה חדשה"
                                    minLength={6}
                                />
                            </div>

                            <div>
                                <label htmlFor="confirmPassword">
                                    אישור סיסמה חדשה *
                                </label>
                                <input
                                    type="password"
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="הזן שוב את הסיסמה החדשה"
                                    minLength={6}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="btn-auth-primary"
                            >
                                {loading ? (
                                    <div className="flex items-center justify-center">
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white ml-2"></div>
                                        משנה סיסמה...
                                    </div>
                                ) : (
                                    'שנה סיסמה'
                                )}
                            </button>
                        </form>
                    )}

                    <div className="mt-8 text-center space-y-4">
                        <Link 
                            href="/auth/login" 
                            className="auth-link"
                        >
                            ← חזרה להתחברות
                        </Link>
                        
                        <div className="auth-divider"></div>
                        <Link 
                            href="/" 
                            className="auth-link"
                        >
                            ← חזרה לעמוד הבית
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function ChangePasswordPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ChangePasswordForm />
        </Suspense>
    );
}