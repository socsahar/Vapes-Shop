import './globals.css'
import { ToastProvider } from '../components/Toast'

export const metadata = {
  title: 'Vape Shop Israel - החנות הטובה ביותר לווייפ בישראל',
  description: 'מגוון ענק של מוצרי ווייפ איכותיים, מחירים הוגנים, משלוח מהיר לכל הארץ. Pod, נוזלים, אביזרים ועוד.',
  keywords: ['ווייפ', 'Pod', 'נוזלים', 'סיגריה אלקטרונית', 'ישראל', 'vape', 'e-cigarette'],
  authors: [{ name: 'Vape Shop Israel' }],
  creator: 'Vape Shop Israel',
  robots: 'index, follow',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#8b4513" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Vape Shop" />
      </head>
      <body className="min-h-screen font-sans">
        <ToastProvider>
          <div className="relative min-h-screen">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden" style={{ pointerEvents: 'none' }}>
              <div className="absolute animate-float" style={{
                top: '-10rem',
                right: '-10rem',
                width: '20rem',
                height: '20rem',
                background: 'var(--gradient-primary)',
                borderRadius: '50%',
                mixBlendMode: 'multiply',
                filter: 'blur(40px)',
                opacity: '0.2'
              }}></div>
              <div className="absolute animate-float" style={{
                bottom: '-10rem',
                left: '-10rem',
                width: '20rem',
                height: '20rem',
                background: 'var(--gradient-secondary)',
                borderRadius: '50%',
                mixBlendMode: 'multiply',
                filter: 'blur(40px)',
                opacity: '0.2',
                animationDelay: '1s'
              }}></div>
              <div className="absolute animate-float" style={{
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '20rem',
                height: '20rem',
                background: 'var(--gradient-accent)',
                borderRadius: '50%',
                mixBlendMode: 'multiply',
                filter: 'blur(40px)',
                opacity: '0.2',
                animationDelay: '2s'
              }}></div>
            </div>
            
            {/* Main content */}
            <div className="relative z-10">
              {children}
            </div>
            
            {/* Footer */}
            <footer className="relative z-10 backdrop-blur-md bg-white/5 border-t border-white/10 mt-auto">
              <div className="container mx-auto px-4 py-4">
                <div className="flex flex-col items-center gap-2 text-center">
                  <p className="text-gray-400 text-sm">
                    פיתוח, עיצוב ואבטחה:{' '}
                    <a 
                      href="https://sanda-uinc.onrender.com/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 font-semibold transition-all duration-300 underline decoration-cyan-400/50 hover:decoration-cyan-300 underline-offset-2 cursor-pointer"
                    >
                      סהר מלול
                    </a>
                  </p>
                  <p className="text-gray-500 text-xs">
                    © {new Date().getFullYear()} כל הזכויות שמורות
                  </p>
                </div>
              </div>
            </footer>
          </div>
        </ToastProvider>
      </body>
    </html>
  )
}