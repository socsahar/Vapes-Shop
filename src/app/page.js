'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to login page immediately
    router.push('/auth/login')
  }, [router])

  // Show a simple loading message while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center auth-page">
      <div className="text-center animate-scale-in">
        <div className="loading-spinner mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold neon-text">מפנה לעמוד התחברות...</h2>
        <p style={{color: 'var(--text-secondary)'}} className="mt-2">Loading...</p>
      </div>
    </div>
  )
}