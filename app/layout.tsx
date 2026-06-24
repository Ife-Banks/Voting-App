import type { Metadata } from 'next'
import './globals.css'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'ESSA Voting App',
  description: 'Environmental Science Student Association Elections',
  openGraph: {
    title: 'ESSA Voting App',
    description: 'Environmental Science Student Association Elections',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'ESSA Voting App',
      },
    ],
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="noise antialiased">{children}</body>
    </html>
  )
}
