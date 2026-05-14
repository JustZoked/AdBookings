import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { SiteHeader } from '@/components/SiteHeader'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Adsemble Bookings',
  description: 'Sistema de reserva de salones de Adsemble',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <SiteHeader />
        <main className="min-h-screen bg-gray-50">{children}</main>
      </body>
    </html>
  )
}
