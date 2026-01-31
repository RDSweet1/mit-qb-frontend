import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/components/AuthProvider'
import { ToastProvider } from '@/components/ToastProvider'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MIT Consulting - QuickBooks Timesheet System',
  description: 'Internal timesheet and billing management system integrated with QuickBooks Online',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
          <ToastProvider />
        </AuthProvider>
      </body>
    </html>
  )
}
