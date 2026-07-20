import type { Metadata } from 'next'
import './globals.css'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'NASSA Student Choice Award',
  description: 'NASSA Student Choice Award — Vote for your favourite candidates',
  openGraph: {
    title: 'NASSA Student Choice Award',
    description: 'NASSA Student Choice Award — Vote for your favourite candidates',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'NASSA Student Choice Award',
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
      <head>
        <script src="https://js.paystack.co/v1/inline.js" defer />
      </head>
      <body className="noise antialiased">{children}</body>
    </html>
  )
}
