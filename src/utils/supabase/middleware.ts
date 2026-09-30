import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Si Supabase o Google redirigieron de vuelta con un código de OAuth o un error a una ruta distinta a /auth/callback (por ejemplo / o /login)
  if ((searchParams.has('code') || searchParams.has('error')) && !pathname.startsWith('/auth/callback')) {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = '/auth/callback';
    if (!callbackUrl.searchParams.has('next') && pathname !== '/login' && pathname !== '/register') {
      callbackUrl.searchParams.set('next', pathname);
    }
    return NextResponse.redirect(callbackUrl);
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do not run code between createServerClient and
  // supabase.auth.getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Si el usuario ya está autenticado e intenta ir a login o registro, redirigir a inicio
  if (user && (pathname === '/login' || pathname === '/register')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // Rutas protegidas que requieren sesión activa (por ejemplo /admin o /dashboard)
  const isProtectedPath = pathname.startsWith('/admin') || pathname.startsWith('/dashboard') || pathname.startsWith('/perfil');
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
