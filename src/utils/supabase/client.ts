import { createBrowserClient } from '@supabase/ssr';

export function getSupabaseConfig() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    'https://placeholder-project.supabase.co';
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    'placeholder-anon-key';

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
