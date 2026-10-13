import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // 1. NUNCA interceptar ni mutar cookies en /auth/callback dentro del middleware.
  // La ruta /auth/callback necesita leer intacta la cookie PKCE (sb-*-auth-token-code-verifier)
  // y realizar el exchangeCodeForSession sin interferencia previa.
  if (pathname.startsWith('/auth/callback')) {
    return NextResponse.next({
      request,
    });
  }

  // 2. Si Supabase redirigió con un ?code= de OAuth a la raíz (/) u otra ruta que NO sea /auth/callback ni /login,
  // redirigir a /auth/callback preservando todas las cookies de la request (incluido el code_verifier PKCE).
  // IMPORTANTE: NO redirigir cuando hay ?error= para evitar bucles infinitos (ERR_TOO_MANY_REDIRECTS) entre /login y /auth/callback.
  if (
    searchParams.has('code') &&
    !searchParams.has('error') &&
    !pathname.startsWith('/auth/callback')
  ) {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = '/auth/callback';
    if (
      !callbackUrl.searchParams.has('next') &&
      pathname !== '/login' &&
      pathname !== '/register'
    ) {
      callbackUrl.searchParams.set('next', pathname);
    }

    const redirectResponse = NextResponse.redirect(callbackUrl);
    request.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, {
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
    });
    return redirectResponse;
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    'https://placeholder-project.supabase.co';
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || 'placeholder-anon-key';

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, {
            ...options,
            path: options?.path || '/',
            sameSite: (options?.sameSite as any) || 'lax',
            secure: options?.secure ?? process.env.NODE_ENV === 'production',
          })
        );
      },
    },
  });

  // IMPORTANT: Do not run code between createServerClient and
  // supabase.auth.getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Si el usuario ya está autenticado e intenta ir a login o registro, redirigir a inicio
  // (preservando las cookies actualizadas en supabaseResponse)
  if (user && (pathname === '/login' || pathname === '/register')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.searchParams.delete('error');
    url.searchParams.delete('error_description');
    const redirectRes = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) => {
      redirectRes.cookies.set(c.name, c.value);
    });
    return redirectRes;
  }

  // Rutas protegidas que requieren sesión activa (por ejemplo /admin o /dashboard)
  const isProtectedPath =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/perfil');

  if (!user && isProtectedPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Protección específica para /admin: Solo Superadministrador
  if (pathname.startsWith('/admin')) {
    const adminEmails = ['bruno.marin.soporte@gmail.com'];
    const userEmail = user?.email?.toLowerCase().trim() || '';
    if (!adminEmails.includes(userEmail)) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
