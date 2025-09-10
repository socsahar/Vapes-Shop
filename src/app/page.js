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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-700">מפנה לעמוד התחברות...</h2>
        <p className="text-gray-500 mt-2">Loading...</p>
      </div>
    </div>
  )
}