import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

// Tailwind CSS class merging utility
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

// Date formatting utilities
export const formatDate = (date) => {
  const d = new Date(date)
  return d.toLocaleDateString('he-IL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Jerusalem',
  })
}

export const formatDateTime = (date) => {
  const d = new Date(date)
  return d.toLocaleString('he-IL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jerusalem',
  })
}

export const formatTime = (date) => {
  const d = new Date(date)
  return d.toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jerusalem',
  })
}

// Currency formatting
export const formatCurrency = (amount, currency = 'ILS') => {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency,
  }).format(amount)
}

// Number formatting
export const formatNumber = (num) => {
  return new Intl.NumberFormat('he-IL').format(num)
}

// String utilities
export const truncateText = (text, maxLength) => {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

export const capitalizeFirst = (text) => {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export const slugify = (text) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Validation utilities
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const isValidPhone = (phone) => {
  const phoneRegex = /^[0-9\-\+\s\(\)]+$/
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10
}

export const isValidPassword = (password) => {
  // At least 8 characters, one uppercase, one lowercase, one number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/
  return passwordRegex.test(password)
}

// Array utilities
export const groupBy = (list, getKey) => {
  return list.reduce((groups, item) => {
    const key = getKey(item)
    if (!groups[key]) {
      groups[key] = []
    }
    groups[key].push(item)
    return groups
  }, {})
}

export const sortBy = (array, key, direction = 'asc') => {
  return [...array].sort((a, b) => {
    const aVal = a[key]
    const bVal = b[key]
    
    if (aVal < bVal) return direction === 'asc' ? -1 : 1
    if (aVal > bVal) return direction === 'asc' ? 1 : -1
    return 0
  })
}

export const unique = (array) => {
  return [...new Set(array)]
}

export const paginate = (array, page, limit) => {
  const startIndex = (page - 1) * limit
  const endIndex = startIndex + limit
  
  return {
    data: array.slice(startIndex, endIndex),
    total: array.length,
    totalPages: Math.ceil(array.length / limit),
  }
}

// Object utilities
export const omit = (obj, keys) => {
  const result = { ...obj }
  keys.forEach(key => delete result[key])
  return result
}

export const pick = (obj, keys) => {
  const result = {}
  keys.forEach(key => {
    if (key in obj) {
      result[key] = obj[key]
    }
  })
  return result
}

// URL utilities
export const buildUrl = (base, params) => {
  const url = new URL(base, window.location.origin)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  })
  return url.toString()
}

export const getUrlParams = (url) => {
  const urlObj = new URL(url)
  const params = {}
  urlObj.searchParams.forEach((value, key) => {
    params[key] = value
  })
  return params
}

// Local storage utilities
export const storage = {
  get: (key, defaultValue) => {
    if (typeof window === 'undefined') return defaultValue || null
    
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : defaultValue || null
    } catch {
      return defaultValue || null
    }
  },
  
  set: (key, value) => {
    if (typeof window === 'undefined') return
    
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      console.error('Failed to save to localStorage:', error)
    }
  },
  
  remove: (key) => {
    if (typeof window === 'undefined') return
    localStorage.removeItem(key)
  },
  
  clear: () => {
    if (typeof window === 'undefined') return
    localStorage.clear()
  }
}

// Debounce utility
export const debounce = (func, wait) => {
  let timeout
  
  return (...args) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// Throttle utility
export const throttle = (func, limit) => {
  let inThrottle
  
  return (...args) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

// Sleep utility
export const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Error handling
export const handleError = (error) => {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'אירעה שגיאה לא צפויה'
}

// Status utilities
export const getStatusColor = (status) => {
  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    open: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-800',
    sent: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800',
  }
  
  return statusColors[status] || 'bg-gray-100 text-gray-800'
}

export const getStatusText = (status) => {
  const statusTexts = {
    pending: 'בהמתנה',
    confirmed: 'אושר',
    completed: 'הושלם',
    cancelled: 'בוטל',
    open: 'פתוח',
    closed: 'סגור',
    sent: 'נשלח',
    failed: 'נכשל',
    active: 'פעיל',
    inactive: 'לא פעיל',
  }
  
  return statusTexts[status] || status
}

// File utilities
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export const getFileExtension = (filename) => {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2)
}

// Generate unique ID
export const generateId = () => {
  return Math.random().toString(36).substr(2, 9)
}