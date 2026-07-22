import type { Metadata } from 'next'
import './globals.css'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'NACOS Voting App',
  description: 'Natural and Applied Sciences Student Association Elections',
  openGraph: {
    title: 'NACOS Voting App',
    description: 'Natural and Applied Sciences Student Association Elections',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'NACOS Voting App',
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
