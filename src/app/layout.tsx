import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PWAInstallBanner } from '@/components/PWAInstallBanner';

export const metadata: Metadata = {
  title: 'AquaShine San Rafael - Detailing de Alta Gama & Lavadero Artesanal',
  description:
    'Reserva online tu turno de detailing y lavado artesanal en San Rafael, Mendoza. Planes mensuales y turnos individuales con atención exclusiva.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AquaShine',
  },
  icons: {
    icon: [
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#070a12',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className="antialiased min-h-screen selection:bg-cyan-500 selection:text-slate-950 bg-[#070a12] text-slate-100 font-sans">
        {children}
        <PWAInstallBanner />
      </body>
    </html>
  );
}
