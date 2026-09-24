import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AquaShine San Rafael - Detailing de Alta Gama & Lavadero Artesanal',
  description: 'Reserva online tu turno de detailing y lavado artesanal en San Rafael, Mendoza. Planes mensuales y turnos individuales con atención exclusiva.',
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
      </body>
    </html>
  );
}
