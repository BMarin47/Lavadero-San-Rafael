import { type NextRequest } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Coincide con todas las rutas de solicitud excepto:
     * - _next/static (archivos estáticos)
     * - _next/image (imágenes optimizadas)
     * - auth/callback (el intercambio PKCE debe ejecutarse directo en el Route Handler sin interferencia del middleware)
     * - sw.js, manifest.json, favicon.ico, imágenes y recursos estáticos
     */
    '/((?!_next/static|_next/image|auth/callback|sw\\.js|manifest\\.json|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
