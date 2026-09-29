'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import {
  Calendar,
  Clock,
  Car,
  ShieldCheck,
  CreditCard,
  LogOut,
  ArrowRight,
  Sparkles,
  MessageCircle,
  PlusCircle,
  ExternalLink,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

export default function DashboardClient({ user }: { user: User }) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const supabase = createClient();

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await supabase.auth.signOut();
      router.push('/');
      router.refresh();
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    } finally {
      setIsSigningOut(false);
    }
  };

  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Cliente';

  return (
    <main className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      {/* Resplandor ambiental decorativo de fondo */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-cyan-500/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 -right-40 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[160px]" />
      </div>

      {/* BARRA SUPERIOR DE NAVEGACIÓN */}
      <header className="border-b border-white/[0.08] bg-slate-950/60 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group cursor-pointer">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-sm shadow-cyan-400" />
            <span className="text-sm font-black tracking-tight text-white group-hover:text-cyan-400 transition-colors">
              AquaShine <span className="text-cyan-400">San Rafael</span>
            </span>
          </Link>

          <div className="flex items-center gap-2.5 sm:gap-4">
            <Link
              href="/"
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-bold transition-all active:scale-95"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Nuevo Turno</span>
            </Link>

            {/* Pastilla con correo del usuario */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/[0.1] text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="max-w-[180px] truncate font-medium">{user.email}</span>
            </div>

            {/* Botón de Cerrar Sesión */}
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:text-rose-100 font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{isSigningOut ? 'Saliendo...' : 'Cerrar Sesión'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* CONTENEDOR PRINCIPAL */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        {/* SECCIÓN DE BIENVENIDA */}
        <section className="relative overflow-hidden rounded-3xl bg-slate-900/60 border border-white/[0.08] p-6 sm:p-8 backdrop-blur-xl shadow-xl">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Panel de Cliente</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                ¡Hola, <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-cyan-400 capitalize">{displayName}</span>!
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Sesión iniciada con: <strong className="text-slate-200">{user.email}</strong>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-cyan-500/20 transition-all"
              >
                <PlusCircle className="w-4 h-4 text-slate-950" />
                <span>Solicitar Nuevo Turno</span>
              </Link>
            </div>
          </div>
        </section>

        {/* TARJETAS RESUMEN DE ACTIVIDAD */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <div className="p-5 rounded-2xl bg-slate-900/40 border border-white/[0.06] backdrop-blur-md flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Turnos Pendientes</p>
              <p className="text-xl font-black text-white">0</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/40 border border-white/[0.06] backdrop-blur-md flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <Car className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Vehículos en Cuenta</p>
              <p className="text-xl font-black text-white">1 perfil</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/40 border border-white/[0.06] backdrop-blur-md flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Estado de Cuenta</p>
              <p className="text-sm font-bold text-emerald-400">Cliente Activo</p>
            </div>
          </div>
        </section>

        {/* SECCIÓN PRINCIPAL: MIS TURNOS / HISTORIAL DE RESERVAS */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>Mis Turnos</span>
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-white/[0.08] text-slate-400">
                  0 programados
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Consulta y gestiona todos tus turnos solicitados en AquaShine San Rafael
              </p>
            </div>
          </div>

          {/* EMPTY STATE ATRACTIVO */}
          <div className="rounded-3xl border border-dashed border-white/[0.15] bg-slate-900/30 p-8 sm:p-14 text-center space-y-6">
            <div className="w-20 h-20 rounded-3xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto shadow-xl shadow-cyan-500/10">
              <Calendar className="w-10 h-10 text-cyan-400" />
            </div>

            <div className="max-w-md mx-auto space-y-2">
              <h3 className="text-lg sm:text-xl font-bold text-white">
                Aún no tienes turnos programados
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Cuando reserves tu turno de lavado artesanal o te unas a un plan mensual, podrás visualizar aquí el estado en vivo, la fecha asignada y el box de atención.
              </p>
            </div>

            <div className="pt-2">
              <Link
                href="/"
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-slate-950 font-black text-sm shadow-xl shadow-cyan-500/25 transition-all cursor-pointer group"
              >
                <span>Reservar ahora</span>
                <ArrowRight className="w-4 h-4 text-slate-950 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </section>

        {/* ATENCIÓN AL CLIENTE / CONTACTO */}
        <section className="p-6 rounded-2xl bg-slate-900/40 border border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-200">¿Necesitas ayuda con tu turno o vehículo?</p>
              <p className="text-[11px] text-slate-400">Escríbenos por WhatsApp para cambios de horario o consultas personalizadas.</p>
            </div>
          </div>
          <a
            href="https://wa.me/5492604654255?text=Hola%20AquaShine%20San%20Rafael,%20tengo%20una%20consulta%20sobre%20mi%20cuenta"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all shrink-0 cursor-pointer"
          >
            <span>Contactar por WhatsApp</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </section>
      </div>

      {/* PIE DE PÁGINA */}
      <footer className="border-t border-white/[0.08] py-8 text-center text-xs text-slate-500 space-y-1 mt-auto">
        <p className="font-semibold text-slate-400">AquaShine San Rafael • Detailing Artesanal</p>
        <p className="text-[11px]">San Rafael, Mendoza, Argentina</p>
      </footer>
    </main>
  );
}
