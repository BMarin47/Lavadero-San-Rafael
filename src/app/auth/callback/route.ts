import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

const PRODUCTION_SITE_URL = 'https://lavadero-san-rafael.vercel.app';

function getBaseUrl(request: Request): string {
  // 1. Entorno local de desarrollo explícito (npm run dev)
  if (process.env.NODE_ENV === 'development') {
    const { origin } = new URL(request.url);
    return origin || 'http://localhost:3000';
  }

  // 2. Variable de entorno explícita configurada en Vercel
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.SITE_URL?.trim();

  if (envUrl && !envUrl.includes('localhost')) {
    return envUrl.replace(/\/$/, '');
  }

  // 3. Cabeceras del proxy inverso de Vercel (x-forwarded-host y x-forwarded-proto)
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  if (forwardedHost && !forwardedHost.includes('localhost')) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  // 4. Variables automáticas provistas por la plataforma de Vercel
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL && !process.env.VERCEL_URL.includes('localhost')) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // 5. Cabecera Host
  const host = request.headers.get('host');
  if (host && !host.includes('localhost')) {
    return `https://${host}`;
  }

  // 6. Origin de la petición entrante (siempre que no apunte a localhost)
  const { origin } = new URL(request.url);
  if (origin && !origin.includes('localhost')) {
    return origin;
  }

  // 7. Fallback forzado de producción (¡nunca devolver localhost en producción!)
  return PRODUCTION_SITE_URL;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';
  const baseUrl = getBaseUrl(request);
  const redirectTarget = next.startsWith('/') ? next : `/${next}`;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${baseUrl}${redirectTarget}`);
    } else {
      console.error('[Supabase Auth Exchange Error]:', error.message);
    }
  }

  // Redirigir a login con aviso de error si el código expiró o fue inválido
  return NextResponse.redirect(`${baseUrl}/login?error=auth-code-error`);
}
