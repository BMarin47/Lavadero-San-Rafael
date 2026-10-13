import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const PRODUCTION_SITE_URL = 'https://lavadero-san-rafael.vercel.app';

function getBaseUrl(request: NextRequest): string {
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

  // 3. Cabecera Host de la petición actual (priorizar el mismo dominio donde se guardó la cookie PKCE)
  const host = request.headers.get('host');
  if (host && !host.includes('localhost')) {
    return `https://${host}`;
  }

  // 4. Origin de la petición entrante
  const { origin } = new URL(request.url);
  if (origin && !origin.includes('localhost')) {
    return origin;
  }

  // 5. Variable de entorno explícita configurada en Vercel
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.SITE_URL?.trim();

  if (envUrl && !envUrl.includes('localhost')) {
    return envUrl.replace(/\/$/, '');
  }

  // 6. Variables automáticas provistas por la plataforma de Vercel
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL && !process.env.VERCEL_URL.includes('localhost')) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // 7. Fallback de producción oficial
  return PRODUCTION_SITE_URL;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const retry = searchParams.get('retry');
  const next = searchParams.get('next') ?? '/';
  const baseUrl = getBaseUrl(request);
  const redirectTarget = next.startsWith('/') ? next : `/${next}`;

  // 1. Si Google OAuth reportó algún error directo del proveedor, redirigir a /login (sin volver a /auth/callback)
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
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
      'https://placeholder-project.supabase.co';
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || 'placeholder-anon-key';

    // Combinar cookies de NextRequest y de next/headers para no perder ninguna cookie PKCE en Edge/Node
    const cookieMap = new Map<string, string>();
    request.cookies.getAll().forEach((c) => cookieMap.set(c.name, c.value));
    cookieStore.getAll().forEach((c) => cookieMap.set(c.name, c.value));

    const cookiesToApply: Array<{ name: string; value: string; options?: any }> = [];

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookieOptions: {
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
      cookies: {
        getAll() {
          return Array.from(cookieMap.entries()).map(([name, value]) => ({
            name,
            value,
          }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            if (!value || options?.maxAge === 0) {
              cookieMap.delete(name);
            } else {
              cookieMap.set(name, value);
            }
            const normalizedOptions = {
              ...options,
              path: options?.path || '/',
              sameSite: (options?.sameSite as any) || 'lax',
              secure: options?.secure ?? process.env.NODE_ENV === 'production',
            };
            cookiesToApply.push({ name, value, options: normalizedOptions });
            try {
              cookieStore.set(name, value, normalizedOptions);
            } catch {
              // Ignorar si el contexto no permite mutación directa de cookieStore
            }
          });
        },
      },
    });

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      const successResponse = NextResponse.redirect(`${baseUrl}${redirectTarget}`);
      cookiesToApply.forEach(({ name, value, options }) => {
        successResponse.cookies.set(name, value, options);
      });
      return successResponse;
    }

    // Si falló exchangeCodeForSession (ej: petición duplicada donde la primera ya canjeó el código),
    // verificamos si la sesión ya quedó activa en las cookies actuales:
    const {
      data: { user: existingUser },
    } = await supabase.auth.getUser();

    if (existingUser) {
      const alreadyAuthResponse = NextResponse.redirect(`${baseUrl}${redirectTarget}`);
      cookiesToApply.forEach(({ name, value, options }) => {
        alreadyAuthResponse.cookies.set(name, value, options);
      });
      return alreadyAuthResponse;
    }

    console.error('[Supabase Auth Exchange Error]:', {
      message: exchangeError.message,
      status: exchangeError.status,
      hasVerifierInCookies: Array.from(cookieMap.keys()).some((k) =>
        k.includes('code-verifier')
      ),
      cookieNames: Array.from(cookieMap.keys()),
      retry,
    });

    // Si el navegador retuvo la cookie PKCE en la redirección cross-site desde accounts.google.com -> supabase.co
    // o guardó el code-verifier en localStorage, hacemos 1 único intento same-origin desde el cliente antes de mostrar error:
    if (
      !retry &&
      exchangeError.message?.toLowerCase().includes('code verifier')
    ) {
      const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Completando inicio de sesión...</title>
</head>
<body style="background:#06090f;color:#f1f5f9;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
  <div style="text-align:center;padding:24px;">
    <p style="font-size:14px;color:#94a3b8;">Sincronizando sesión segura con Google...</p>
  </div>
  <script>
    (function() {
      try {
        // Sincronizar cualquier code-verifier alojado en localStorage hacia document.cookie (same-origin)
        for (var i = 0; i < localStorage.length; i++) {
          var key = localStorage.key(i);
          if (key && key.indexOf('code-verifier') !== -1) {
            var val = localStorage.getItem(key);
            if (val) {
              document.cookie = key + '=' + encodeURIComponent(val) + '; path=/; SameSite=Lax; Secure';
            }
          }
        }
        if (document.cookie && document.cookie.indexOf('code-verifier') !== -1) {
          var currentUrl = new URL(window.location.href);
          currentUrl.searchParams.set('retry', '1');
          window.location.replace(currentUrl.toString());
          return;
        }
      } catch (e) {}
      window.location.replace(${JSON.stringify(`${baseUrl}/login?error=exchange-error`)});
    })();
  </script>
</body>
</html>`;
      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    }

    // Limpiar cualquier cookie code-verifier huérfana y redirigir a /login (sin bucle en middleware)
    const errUrl = new URL(`${baseUrl}/login`);
    errUrl.searchParams.set('error', 'exchange-error');
    const errResponse = NextResponse.redirect(errUrl.toString());
    Array.from(cookieMap.keys()).forEach((cookieName) => {
      if (cookieName.includes('code-verifier')) {
        errResponse.cookies.delete(cookieName);
      }
    });
    return errResponse;
  }

  // 3. Si no vino código ni error, redirigir a login con aviso
  return NextResponse.redirect(`${baseUrl}/login?error=missing-auth-code`);
}
