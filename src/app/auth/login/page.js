'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signInWithPassword } from '../../../lib/supabase';

export default function LoginPage() {
    const [formData, setFormData] = useState({
        username: '',
        password: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const { data, error } = await signInWithPassword(formData.username, formData.password);
            
            if (error) {
                setError(error.message || 'שגיאה בכניסה למערכת');
                return;
            }

            if (data?.user) {
                // Redirect based on user role
                if (data.user.role === 'admin') {
                    router.push('/admin');
                } else {
                    router.push('/shop');
                }
            }
        } catch (err) {
            setError('שגיאה בכניסה למערכת');
            console.error('Login error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 auth-page">
            {/* Login Form */}
            <div className="relative w-full max-w-md">
                <div className="auth-card p-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold auth-title mb-2">
                            כניסה למערכת
                        </h1>
                        <p className="auth-subtitle">
                            הזן את פרטי החשבון שלך
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="auth-error text-center">
                            {error}
                        </div>
                    )}

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="username">
                                שם משתמש
                            </label>
                            <input
                                type="text"
                                id="username"
                                name="username"
                                value={formData.username}
                                onChange={handleInputChange}
                                required
                                placeholder="הזן שם משתמש"
                                dir="auto"
                            />
                        </div>

                        <div>
                            <label htmlFor="password">
                                סיסמה
                            </label>
                            <input
                                type="password"
                                id="password"
                                name="password"
                                value={formData.password}
                                onChange={handleInputChange}
                                required
                                placeholder="הזן סיסמה"
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
                                    מתחבר...
                                </div>
                            ) : (
                                'כניסה'
                            )}
                        </button>
                    </form>

                    {/* Footer Links */}
                    <div className="mt-8 text-center space-y-4">
                        <Link 
                            href="/auth/register" 
                            className="auth-link"
                        >
                            אין לך חשבון? הירשם כאן
                        </Link>
                        
                        <div>
                            <Link 
                                href="/auth/forgot-password" 
                                className="auth-link"
                            >
                                שכחת סיסמה?
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}