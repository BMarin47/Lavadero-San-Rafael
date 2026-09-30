'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Sparkles,
  ArrowLeft,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Clock,
  Smartphone,
  ShieldCheck,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { GoogleIcon } from '@/components/GoogleIcon';


function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo =
    searchParams.get('redirectTo') ||
    searchParams.get('callbackUrl') ||
    searchParams.get('next') ||
    '/';

  const errorParam = searchParams.get('error');
  const errorDescParam = searchParams.get('error_description');

  const getInitialError = () => {
    if (!errorParam) return null;
    if (errorParam === 'access_denied') {
      return 'Se canceló el registro con Google. Podés intentarlo nuevamente cuando desees.';
    }
    if (errorParam === 'missing-auth-code' || errorParam === 'exchange-error') {
      return 'Hubo un inconveniente al validar la sesión con Google. Por favor, volvé a intentarlo.';
    }
    return errorDescParam || 'No se pudo completar el registro. Por favor intentá nuevamente.';
  };

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(getInitialError());

  const supabase = createClient();

  const handleGoogleRegister = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const origin =
        typeof window !== 'undefined'
          ? window.location.origin
          : 'https://lavadero-san-rafael.vercel.app';
      const callbackUrl =
        redirectTo && redirectTo !== '/'
          ? `${origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`
          : `${origin}/auth/callback`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        console.error('[Google OAuth Register Error]:', error);
        let msg = error.message || 'Error al conectar con Google.';
        if (
          msg.toLowerCase().includes('provider is not enabled') ||
          msg.toLowerCase().includes('unsupported provider')
        ) {
          msg =
            'El proveedor de Google no está activado en Supabase. En tu panel de Supabase ve a Authentication > Providers > Google, activa el interruptor "Enable Sign in with Google" y presiona "Save".';
        }
        setErrorMessage(msg);
        setLoading(false);
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error('[Google OAuth Register Exception]:', err);
      let msg = err?.message || 'Ocurrió un error al registrarse con Google.';
      if (
        msg.toLowerCase().includes('provider is not enabled') ||
        msg.toLowerCase().includes('unsupported provider')
      ) {
        msg =
          'El proveedor de Google no está activado en Supabase. En tu panel de Supabase ve a Authentication > Providers > Google, activa el interruptor "Enable Sign in with Google" y presiona "Save".';
      }
      setErrorMessage(msg);
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-cyan-500/30 shadow-2xl shadow-cyan-950/50 backdrop-blur-2xl relative overflow-hidden space-y-6">
      {/* Decorative gradient glow */}
      <div className="absolute -top-24 -left-24 w-52 h-52 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-52 h-52 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="text-center space-y-2 relative">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-xs font-bold">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Registro en 1 Solo Clic</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
          AquaShine <span className="text-cyan-400">San Rafael</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xs mx-auto">
          Creá tu cuenta de forma instantánea con Google. Sin formularios largos ni contraseñas difíciles.
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="leading-snug">{errorMessage}</div>
        </div>
      )}

      {/* Botón Principal de Google OAuth */}
      <div className="space-y-4 pt-1">
        <button
          onClick={handleGoogleRegister}
          disabled={loading}
          className="w-full py-4 px-6 rounded-2xl bg-white hover:bg-slate-100 active:scale-[0.98] text-slate-950 font-extrabold text-base flex items-center justify-center gap-3 shadow-xl shadow-cyan-500/10 hover:shadow-cyan-500/25 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group border border-slate-200"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
              <span>Conectando con Google...</span>
            </>
          ) : (
            <>
              <GoogleIcon className="w-5 h-5 shrink-0 group-hover:scale-110 transition-transform" />
              <span>Registrarse con Google</span>
            </>
          )}
        </button>

        <p className="text-[11px] text-center text-slate-400 leading-tight">
          Tu cuenta se creará y vinculará automáticamente con un solo clic.
        </p>
      </div>

      {/* Tarjetas de Beneficios */}
      <div className="space-y-2.5 pt-2 border-t border-white/[0.08]">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/60 border border-white/[0.05]">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">Sin Formularios Complejos</p>
            <p className="text-[11px] text-slate-400 leading-tight">
              No tenés que rellenar datos manuales ni verificar correos.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/60 border border-white/[0.05]">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">Rápido y Accesible</p>
            <p className="text-[11px] text-slate-400 leading-tight">
              Ideal para todas las edades: un clic y listo para reservar.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/60 border border-white/[0.05]">
          <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
            <Smartphone className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">Historial de Turnos y Vehículos</p>
            <p className="text-[11px] text-slate-400 leading-tight">
              Tus reservas quedan registradas para consultas o cancelaciones.
            </p>
          </div>
        </div>
      </div>

      {/* Regreso al Inicio o Login */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 text-center">
        <Link
          href="/login"
          className="text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          ¿Ya tenés cuenta? Iniciar Sesión
        </Link>
        <span className="hidden sm:inline text-slate-600">•</span>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Inicio</span>
        </Link>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-[#06090f] text-slate-100 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none ambient-lighting" />
      <Suspense
        fallback={
          <div className="w-full max-w-md p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-cyan-400" />
            <p className="text-xs text-slate-400 mt-2">Cargando...</p>
          </div>
        }
      >
        <RegisterForm />
      </Suspense>
    </main>
  );
}
