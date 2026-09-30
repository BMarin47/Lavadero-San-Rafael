import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

function getBaseUrl(request: Request): string {
  // 1. Variable de entorno explícita configurada en Vercel
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.SITE_URL?.trim();

  if (envUrl) {
    return envUrl.replace(/\/$/, '');
  }

  // 2. Cabeceras del proxy inverso de Vercel (x-forwarded-host y x-forwarded-proto)
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  // 3. Variables automáticas provistas por la plataforma de Vercel
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // 4. Cabecera Host
  const host = request.headers.get('host');
  if (host && !host.includes('localhost')) {
    return `https://${host}`;
  }

  // 5. Origin de la petición entrante (siempre que no apunte erróneamente a localhost en producción)
  const { origin } = new URL(request.url);
  if (origin && !origin.includes('localhost')) {
    return origin;
  }

  // 6. Entorno local de desarrollo
  return origin || 'http://localhost:3000';
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
