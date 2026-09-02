import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SessionColorProvider } from '@/contexts/session-color-context'
import './globals.css'
import 'onairos/onairos.css'

const plusJakartaSans = Plus_Jakarta_Sans({ 
  subsets: ["latin"],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'PHENYX',
    template: '%s | PHENYX',
  },
  description: 'PHENYX is an identity observatory. Connect the accounts you choose, and see the parts of your life as one timeline: what began, what changed, and what has been with you the whole way.',
  keywords: ['identity', 'self discovery', 'personal development', 'identity platform', 'identity formation', 'identity observatory'],
  authors: [{ name: 'Janesse Liang' }],
  creator: 'PHENYX',
  publisher: 'PHENYX',
  metadataBase: new URL('https://phenyxai.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'PHENYX — your life, taking form',
    description: 'PHENYX is an identity observatory. Connect the accounts you choose, and see the parts of your life as one timeline: what began, what changed, and what has been with you the whole way.',
    url: 'https://phenyxai.com',
    siteName: 'PHENYX',
    images: [
      {
        url: '/phenyx-opengraph.png',
        width: 1200,
        height: 630,
        alt: 'PHENYX — your life, taking form',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PHENYX — your life, taking form',
    description: 'PHENYX is an identity observatory. Connect the accounts you choose, and see the parts of your life as one timeline: what began, what changed, and what has been with you the whole way.',
    creator: '@phenyxcollect',
    site: '@phenyxcollect',
    images: ['/phenyx-opengraph.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'add-your-google-search-console-verification-code-here',
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.png', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
}

export const viewport: Viewport = {
  themeColor: '#080808',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${plusJakartaSans.variable} antialiased bg-[#0A0A0A] text-[#FFFDFD]`}>
        <SessionColorProvider>
          {children}
        </SessionColorProvider>
        <Analytics />
      </body>
    </html>
  )
}
