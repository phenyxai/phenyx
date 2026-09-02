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
  title: 'PHENYX — your life, taking form',
  description: 'PHENYX is an identity observatory. Connect the accounts you choose, and see the parts of your life as one timeline: what began, what changed, and what has been with you the whole way.',
  keywords: ['identity', 'identity observatory', 'personal timeline', 'life patterns', 'constellation', 'polaris', 'phenyx'],
  authors: [{ name: 'PHENYX' }],
  creator: 'PHENYX',
  publisher: 'PHENYX INC.',
  metadataBase: new URL('https://phenyxcollective.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'PHENYX — your life, taking form',
    description: 'PHENYX is an identity observatory. Connect the accounts you choose, and see the parts of your life as one timeline: what began, what changed, and what has been with you the whole way.',
    url: 'https://phenyxcollective.com',
    siteName: 'PHENYX',
    images: [
      {
        url: '/og-image.png',
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
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon.svg', type: 'image/svg+xml' },
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
      <body
        suppressHydrationWarning
        className={`${plusJakartaSans.variable} antialiased bg-[#080808] text-[#FFFDFD]`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  )
}
