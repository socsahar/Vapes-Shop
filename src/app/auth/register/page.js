'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signUpWithPassword } from '../../../lib/supabase';

export default function RegisterPage() {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        fullName: '',
        phone: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const [redirectUrl, setRedirectUrl] = useState('/shop');

    useEffect(() => {
        // Get redirect parameter from URL
        const redirect = searchParams.get('redirect');
        if (redirect) {
            setRedirectUrl(redirect);
        }
    }, [searchParams]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setSuccess(false);

        // Validation
        if (formData.password !== formData.confirmPassword) {
            setError('הסיסמאות אינן תואמות');
            setIsLoading(false);
            return;
        }

        if (formData.password.length < 6) {
            setError('הסיסמה חייבת להכיל לפחות 6 תווים');
            setIsLoading(false);
            return;
        }

        // Phone validation - Israeli format (10 digits)
        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(formData.phone)) {
            setError('מספר הטלפון חייב להכיל בדיוק 10 ספרות');
            setIsLoading(false);
            return;
        }

        // Username validation - only letters, numbers, and Hebrew characters
        const usernameRegex = /^[a-zA-Z0-9\u0590-\u05FF]+$/;
        if (!usernameRegex.test(formData.username)) {
            setError('שם המשתמש יכול להכיל רק אותיות, מספרים ועברית');
            setIsLoading(false);
            return;
        }

        // Full name validation - only letters, spaces, and Hebrew characters
        const fullNameRegex = /^[a-zA-Z\u0590-\u05FF\s]+$/;
        if (!fullNameRegex.test(formData.fullName)) {
            setError('השם המלא יכול להכיל רק אותיות, רווחים ועברית');
            setIsLoading(false);
            return;
        }

        try {
            const { data, error } = await signUpWithPassword({
                username: formData.username,
                email: formData.email,
                password: formData.password,
                full_name: formData.fullName,
                phone: formData.phone
            });
            
            if (error) {
                setError(error.message || 'שגיאה ברישום למערכת');
                return;
            }

            setSuccess(true);
            setTimeout(() => {
                // Redirect to login with the redirect parameter
                const loginUrl = redirectUrl !== '/shop' 
                    ? `/auth/login?redirect=${encodeURIComponent(redirectUrl)}`
                    : '/auth/login';
                router.push(loginUrl);
            }, 2000);

        } catch (err) {
            setError('שגיאה ברישום למערכת');
            console.error('Registration error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        
        // Special handling for phone number - only allow digits
        if (name === 'phone') {
            const digitsOnly = value.replace(/\D/g, '');
            setFormData(prev => ({
                ...prev,
                [name]: digitsOnly
            }));
        }
        // Special handling for username - only letters, numbers, and Hebrew
        else if (name === 'username') {
            const filteredValue = value.replace(/[^a-zA-Z0-9\u0590-\u05FF]/g, '');
            setFormData(prev => ({
                ...prev,
                [name]: filteredValue
            }));
        }
        // Special handling for full name - only letters, spaces, and Hebrew
        else if (name === 'fullName') {
            const filteredValue = value.replace(/[^a-zA-Z\u0590-\u05FF\s]/g, '');
            setFormData(prev => ({
                ...prev,
                [name]: filteredValue
            }));
        }
        else {
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 auth-page">
                <div className="relative w-full max-w-md animate-scale-in">
                    <div className="auth-card p-8 text-center">
                        <div className="mb-4">
                            <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4 neon-glow">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        </div>
                        <h2 className="text-2xl font-bold neon-text mb-2">רישום הושלם בהצלחה!</h2>
                        <p className="text-secondary mb-4">החשבון שלך נוצר בהצלחה. מעביר אותך לעמוד הכניסה...</p>
                        <div className="loading-spinner mx-auto"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 auth-page">
            {/* Register Form */}
            <div className="relative w-full max-w-md animate-slide-up">
                <div className="auth-card p-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold auth-title mb-2">
                            הרשמה למערכת
                        </h1>
                        <p className="auth-subtitle">
                            צור חשבון חדש להתחלת הקנייה
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="auth-error text-center">
                            {error}
                        </div>
                    )}

                    {/* Register Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label htmlFor="fullName">
                                    שם מלא *
                                </label>
                                <input
                                    type="text"
                                    id="fullName"
                                    name="fullName"
                                    value={formData.fullName}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="הזן שם מלא"
                                    pattern="[a-zA-Z\u0590-\u05FF\s]+"
                                    title="השם המלא יכול להכיל רק אותיות, רווחים ועברית"
                                    dir="auto"
                                />
                            </div>

                            <div>
                                <label htmlFor="username">
                                    שם משתמש *
                                </label>
                                <input
                                    type="text"
                                    id="username"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="בחר שם משתמש"
                                    pattern="[a-zA-Z0-9\u0590-\u05FF]+"
                                    title="שם המשתמש יכול להכיל רק אותיות, מספרים ועברית"
                                    dir="auto"
                                />
                            </div>

                            <div>
                                <label htmlFor="email">
                                    כתובת אימייל *
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="your-email@gmail.com"
                                    dir="ltr"
                                />
                            </div>

                            <div>
                                <label htmlFor="phone">
                                    טלפון *
                                </label>
                                <input
                                    type="tel"
                                    id="phone"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="0501234567"
                                    pattern="\d{10}"
                                    maxLength="10"
                                    dir="ltr"
                                    className="text-left"
                                />
                            </div>

                            <div>
                                <label htmlFor="password">
                                    סיסמה *
                                </label>
                                <input
                                    type="password"
                                    id="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="בחר סיסמה חזקה"
                                />
                            </div>

                            <div>
                                <label htmlFor="confirmPassword">
                                    אישור סיסמה *
                                </label>
                                <input
                                    type="password"
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="הזן שוב את הסיסמה"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn-auth-primary"
                        >
                            {isLoading ? (
                                <div className="flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white ml-2"></div>
                                    נרשם...
                                </div>
                            ) : (
                                'הרשמה'
                            )}
                        </button>
                    </form>

                    {/* Footer Links */}
                    <div className="mt-8 text-center space-y-4">
                        <Link 
                            href="/auth/login" 
                            className="auth-link"
                        >
                            יש לך כבר חשבון? התחבר כאן
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}