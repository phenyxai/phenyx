import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import 'onairos/onairos.css'

const plusJakartaSans = Plus_Jakarta_Sans({ 
  subsets: ["latin"],
  weight: ['300', '400', '500', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PHENYX',
  description: 'PHENYX. where identity takes form. an ai that synthesizes who you are across everything you have built.',
  keywords: ['identity', 'self discovery', 'personal development', 'identity platform', 'creator community', 'phenyx', 'identity formation', 'identity observatory'],
  authors: [{ name: 'Janesse Liang' }],
  creator: 'PHENYX',
  publisher: 'PHENYX',
  metadataBase: new URL('https://phenyxcollective.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'PHENYX',
    description: 'PHENYX. where identity takes form. an ai that synthesizes who you are across everything you have built.',
    url: 'https://phenyxcollective.com',
    siteName: 'PHENYX',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'PHENYX',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PHENYX',
    description: 'PHENYX. where identity takes form. an ai that synthesizes who you are across everything you have built.',
    creator: '@phenyxcollect',
    site: '@phenyxcollect',
    images: ['/og-image.png'],
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
      { url: '/favicon.png', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
}

export const viewport: Viewport = {
  themeColor: '#0A0A0A',
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
        {children}
        <Analytics />
      </body>
    </html>
  )
}
