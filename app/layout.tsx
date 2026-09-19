import type { Metadata, Viewport } from 'next'
import { Roboto } from 'next/font/google'
import { MaterialWebLoader } from '@/components/material-web-loader'
import './globals.css'

const roboto = Roboto({ weight: ['300','400','500','700'], subsets: ['latin'], variable: '--font-roboto', display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'AdPulse Reports', template: '%s | AdPulse Reports' },
  description: 'Secure Google Ads reporting, branded PDF generation, and scheduled client delivery for growing agencies.',
}
export const viewport: Viewport = { themeColor: '#6750a4', width: 'device-width', initialScale: 1, userScalable: true }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={roboto.variable}><head><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/><link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet"/></head><body><MaterialWebLoader/>{children}</body></html>
}
