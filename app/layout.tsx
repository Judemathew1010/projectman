import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'Automatic Workflows — ProjectMan',
  description: 'Automatic Workflows by ProjectMan',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="page-root">
      <body>{children}</body>
    </html>
  )
}
