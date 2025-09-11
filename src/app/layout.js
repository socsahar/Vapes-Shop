import './styles.css'
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
            <footer className="developer-footer">
              <div className="developer-footer-content">
                <div className="developer-credit">
                  <div className="developer-info">
                    <span className="developer-title">פיתוח, עיצוב ובניית המערכת:</span>
                    <span className="developer-name">סהר מלול</span>
                  </div>
                  <div className="copyright">
                    <span>© {new Date().getFullYear()} כל הזכויות שמורות</span>
                  </div>
                </div>
              </div>
            </footer>
          </div>
        </ToastProvider>
      </body>
    </html>
  )
}