import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SRC Voting App',
  description: 'Student Representative Council Elections',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="noise">{children}</body>
    </html>
  )
}
