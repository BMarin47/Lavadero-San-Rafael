import { createBrowserClient } from '@supabase/ssr';

export function getSupabaseConfig() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    'https://placeholder-project.supabase.co';
  let supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    'placeholder-anon-key';

  // Salvaguarda crítica: impedir que una clave con rol service_role se use en el cliente
  if (typeof window !== 'undefined' && supabaseAnonKey && supabaseAnonKey.startsWith('eyJ')) {
    try {
      const parts = supabaseAnonKey.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.role === 'service_role') {
          console.error(
            '🚨 CRITICAL SECURITY ERROR: La variable NEXT_PUBLIC_SUPABASE_ANON_KEY contiene la clave service_role. Debe ser reemplazada inmediatamente por la anon_key pública de Supabase.'
          );
          supabaseAnonKey = 'invalid-service-role-blocked';
        }
      }
    } catch {
      // Ignorar errores de parseo en claves mock o locales
    }
  }

  const isConfigured =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    !supabaseUrl.includes('placeholder-project');

  return { supabaseUrl, supabaseAnonKey, isConfigured };
}

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();

  if (typeof window !== 'undefined') {
    if (!browserClient) {
      browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          flowType: 'pkce',
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true,
        },
      });
    }
    return browserClient;
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
