import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const PRODUCTION_SITE_URL = 'https://lavadero-san-rafael.vercel.app';

function getBaseUrl(request: Request): string {
  // 1. Entorno local de desarrollo explícito (npm run dev)
  if (process.env.NODE_ENV === 'development') {
    const { origin } = new URL(request.url);
    return origin || 'http://localhost:3000';
  }

  // 2. Cabeceras del proxy inverso de Vercel (x-forwarded-host y x-forwarded-proto)
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  if (forwardedHost && !forwardedHost.includes('localhost')) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  // 3. Variable de entorno explícita configurada en Vercel
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.SITE_URL?.trim();

  if (envUrl && !envUrl.includes('localhost')) {
    return envUrl.replace(/\/$/, '');
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

  // 7. Fallback de producción oficial
  return PRODUCTION_SITE_URL;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const next = searchParams.get('next') ?? '/';
  const baseUrl = getBaseUrl(request);
  const redirectTarget = next.startsWith('/') ? next : `/${next}`;

  // 1. Si Google OAuth reportó algún error directo del proveedor
  if (error) {
    console.error('[Google OAuth Provider Notice]:', error, errorDescription);
    const errUrl = new URL(`${baseUrl}/login`);
    errUrl.searchParams.set('error', error);
    if (errorDescription) {
      errUrl.searchParams.set('error_description', errorDescription);
    }
    return NextResponse.redirect(errUrl.toString());
  }

  // 2. Intercambio seguro de código de autorización PKCE por sesión
  if (code) {
    const cookieStore = await cookies();
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

    const response = NextResponse.redirect(`${baseUrl}${redirectTarget}`);

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options);
            } catch {
              // Ignore if called from context where cookies() cannot be directly mutated
            }
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      return response;
    } else {
      console.error('[Supabase Auth Exchange Error]:', exchangeError.message);
      const errUrl = new URL(`${baseUrl}/login`);
      errUrl.searchParams.set('error', 'exchange-error');
      errUrl.searchParams.set('error_description', exchangeError.message);
      return NextResponse.redirect(errUrl.toString());
    }
  }

  // 3. Si no vino código ni error, redirigir a login con aviso
  return NextResponse.redirect(`${baseUrl}/login?error=missing-auth-code`);
}
