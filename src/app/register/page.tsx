'use client';

import React, { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, User, UserPlus, AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Sparkles, ArrowLeft, LogIn } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

function RegisterForm() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const supabase = createClient();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Por favor completá los campos obligatorios.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);

    try {
      // Determinar dinámicamente la URL base para la redirección de confirmación
      const PRODUCTION_SITE_URL = 'https://lavadero-san-rafael.vercel.app';

      // 1. Variable de entorno explícita configurada en Vercel
      const envSiteUrl =
        process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
        process.env.NEXT_PUBLIC_APP_URL?.trim() ||
        (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : '');

      // 2. Origen del navegador (si está disponible y no es localhost)
      const browserOrigin = typeof window !== 'undefined' ? window.location.origin : '';

      // 3. Resolver la URL base asegurando el fallback directo de producción (nunca localhost fuera de desarrollo local)
      let baseUrl = PRODUCTION_SITE_URL;
      if (envSiteUrl && !envSiteUrl.includes('localhost')) {
        baseUrl = envSiteUrl;
      } else if (browserOrigin && !browserOrigin.includes('localhost')) {
        baseUrl = browserOrigin;
      } else if (process.env.NODE_ENV === 'development' && browserOrigin) {
        baseUrl = browserOrigin;
      }

      const emailRedirectTo = `${baseUrl.replace(/\/$/, '')}/auth/callback`;

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo,
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (error) {
        setErrorMessage(
          error.message === 'Failed to fetch'
            ? 'No se pudo conectar con Supabase. Asegurate de cargar las variables NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en el panel de Vercel.'
            : error.message
        );
        return;
      }

      if (data?.session) {
        // Sesión iniciada automáticamente
        setSuccessMessage('¡Cuenta creada con éxito! Redirigiendo...');
        setTimeout(() => {
          router.push('/');
          router.refresh();
        }, 1500);
      } else if (data?.user) {
        // Requiere confirmación de email (comportamiento por defecto de Supabase)
        setSuccessMessage(
          '¡Cuenta registrada con éxito! Si tu proyecto requiere confirmación, revisá tu casilla de correo para verificar la cuenta antes de iniciar sesión.'
        );
      }
    } catch (err: any) {
      const msg = err?.message === 'Failed to fetch'
        ? 'No se pudo conectar con Supabase. Asegurate de cargar las variables NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en el panel de Vercel.'
        : (err?.message || 'Ocurrió un error inesperado al registrar la cuenta.');
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-xl relative overflow-hidden">
      {/* Decorative gradient glow */}
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="text-center space-y-2 mb-8 relative">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>Crear Cuenta Nueva</span>
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white">
          AquaShine <span className="text-blue-500">San Rafael</span>
        </h1>
        <p className="text-xs text-slate-400">
          Registrate para gestionar tus turnos y suscripciones
        </p>
      </div>

      {/* Success Alert */}
      {successMessage && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="leading-snug space-y-1">
            <p className="font-semibold text-emerald-200">Registro completado</p>
            <p className="text-slate-300">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div className="mb-6 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="leading-snug">{errorMessage}</div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleRegister} className="space-y-4">
        {/* Full Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 block">
            Nombre Completo
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Juan Pérez"
              autoComplete="name"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950/70 border border-slate-700/80 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-100 placeholder:text-slate-500 text-sm outline-none transition-all"
            />
          </div>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 block">
            Correo Electrónico <span className="text-blue-400">*</span>
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ejemplo@sanrafael.com"
              autoComplete="email"
              required
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950/70 border border-slate-700/80 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-100 placeholder:text-slate-500 text-sm outline-none transition-all"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 block">
            Contraseña <span className="text-blue-400">*</span>
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
              required
              className="w-full pl-10 pr-11 py-3 rounded-xl bg-slate-950/70 border border-slate-700/80 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-100 placeholder:text-slate-500 text-sm outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
              aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 block">
            Confirmar Contraseña <span className="text-blue-400">*</span>
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repetí tu contraseña"
              autoComplete="new-password"
              required
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950/70 border border-slate-700/80 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-100 placeholder:text-slate-500 text-sm outline-none transition-all"
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Creando tu cuenta...</span>
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4" />
              <span>Registrarme</span>
            </>
          )}
        </button>
      </form>

      {/* Cross link to Login */}
      <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-col items-center gap-3 text-center">
        <p className="text-xs text-slate-400">
          ¿Ya tienes cuenta?{' '}
          <Link
            href="/login"
            className="font-bold text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors inline-flex items-center gap-1"
          >
            <LogIn className="w-3.5 h-3.5 inline" />
            <span>Inicia sesión aquí</span>
          </Link>
        </p>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors pt-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver al inicio</span>
        </Link>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-[#090d16] text-slate-100">
      <Suspense
        fallback={
          <div className="w-full max-w-md p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500" />
            <p className="text-xs text-slate-400 mt-2">Cargando...</p>
          </div>
        }
      >
        <RegisterForm />
      </Suspense>
    </main>
  );
}
