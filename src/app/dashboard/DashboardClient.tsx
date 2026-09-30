'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
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
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  X,
  Trash2,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { PushTestButton } from '@/components/PushTestButton';

interface TurnoItem {
  id: string;
  user_id: string;
  nombre_cliente: string;
  vehiculo: string;
  categoria: string;
  precio: number;
  indicaciones?: string | null;
  estado: string;
  fecha_creacion: string;
  date?: string;
  time?: string;
}

/**
 * Regla lógica: La cancelación de un turno solo está permitida si faltan más de 24 horas
 * para la fecha y horario programado del lavado.
 */
export function checkCancellationEligibility(turno: TurnoItem): {
  canCancel: boolean;
  hoursRemaining: number;
  reason?: string;
} {
  let dateStr = turno.date;
  let timeStr = turno.time;

  // Si no vienen en campos directos, buscar en indicaciones
  if (!dateStr && turno.indicaciones) {
    const dateMatch = turno.indicaciones.match(/\b(202\d-\d{2}-\d{2})\b/);
    if (dateMatch) {
      dateStr = dateMatch[1];
    }
  }

  if (!timeStr && turno.indicaciones) {
    const timeMatch = turno.indicaciones.match(/(\d{1,2}:\d{2})/);
    if (timeMatch) {
      timeStr = timeMatch[1];
    }
  }

  if (!dateStr) {
    return {
      canCancel: false,
      hoursRemaining: 0,
      reason: 'No es posible cancelar: fecha del turno no disponible.',
    };
  }

  let startTime = '09:00';
  if (timeStr) {
    const match = timeStr.match(/(\d{1,2}:\d{2})/);
    if (match) {
      startTime = match[1].padStart(5, '0');
    }
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = startTime.split(':').map(Number);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return { canCancel: false, hoursRemaining: 0, reason: 'Fecha inválida.' };
  }

  const appointmentDate = new Date(year, month - 1, day, hour || 9, minute || 0, 0);
  const now = new Date();
  const diffHours = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (diffHours <= 0) {
    return {
      canCancel: false,
      hoursRemaining: diffHours,
      reason: 'El horario programado ya ha comenzado o concluido.',
    };
  }

  if (diffHours < 24) {
    const rounded = Math.max(0, Math.floor(diffHours));
    return {
      canCancel: false,
      hoursRemaining: diffHours,
      reason: `La cancelación solo está disponible con más de 24 horas de anticipación (restan ${rounded}h). Comunicate por WhatsApp para reprogramar.`,
    };
  }

  return {
    canCancel: true,
    hoursRemaining: diffHours,
  };
}

export default function DashboardClient({ user }: { user: User }) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [turnos, setTurnos] = useState<TurnoItem[]>([]);
  const [loadingTurnos, setLoadingTurnos] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{
    title: string;
    msg: string;
    type?: 'success' | 'warning' | 'error' | 'info';
  } | null>(null);

  const supabase = createClient();

  const showToast = (
    title: string,
    msg: string,
    type: 'success' | 'warning' | 'error' | 'info' = 'info'
  ) => {
    setToastMessage({ title, msg, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const loadTurnos = React.useCallback(async () => {
    try {
      setLoadingTurnos(true);
      // 1. Consulta en Supabase (tabla bookings)
      const { data: bookingsData, error: bookingsErr } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });

      if (!bookingsErr && bookingsData && bookingsData.length > 0) {
        const mapped = bookingsData.map((b: any) => ({
          id: b.id,
          user_id: b.user_id,
          nombre_cliente: b.client_name || b.nombre_cliente || 'Cliente',
          vehiculo: b.vehicle_details || b.vehiculo || 'Vehículo',
          categoria: b.service_type || b.categoria || 'Servicio',
          precio: Number(b.price ?? b.precio ?? 0),
          indicaciones:
            b.notes ||
            b.indicaciones ||
            (b.date && b.time ? `Turno: ${b.date} ${b.time}` : null),
          estado: b.status || b.estado || 'pendiente',
          fecha_creacion: b.created_at || b.fecha_creacion || new Date().toISOString(),
          date: b.date,
          time: b.time,
        }));
        // Garantizar lista única sin duplicados de forma defensiva
        const unique = Array.from(
          new Map(mapped.map((item: any) => [item.id, item])).values()
        );
        setTurnos(unique);
        return;
      }

      // 2. Consulta en Supabase (tabla turnos)
      const { data, error } = await supabase
        .from('turnos')
        .select('*')
        .order('fecha_creacion', { ascending: false });

      if (!error && data && data.length > 0) {
        setTurnos(data as TurnoItem[]);
        return;
      }

      // 3. Fallback a /api/turnos (que consulta PostgreSQL de DATABASE_URL)
      const res = await fetch('/api/turnos');
      const json = await res.json().catch(() => ({}));
      if (json.success && Array.isArray(json.turnos)) {
        setTurnos(json.turnos as TurnoItem[]);
      }
    } catch (err) {
      console.warn('Error al cargar turnos del usuario:', err);
    } finally {
      setLoadingTurnos(false);
    }
  }, [supabase]);

  React.useEffect(() => {
    loadTurnos();
  }, [loadTurnos]);

  // Actualizar estado de una reserva (Confirmar / Cancelar)
  const handleUpdateStatus = async (id: string, newStatus: 'confirmado' | 'cancelado') => {
    // Restricción de Cancelación: Debe faltar más de 24 horas
    if (newStatus === 'cancelado') {
      const currentItem = turnos.find((t) => t.id === id);
      if (currentItem) {
        const check = checkCancellationEligibility(currentItem);
        if (!check.canCancel) {
          showToast(
            'Cancelación no disponible',
            check.reason || 'Solo es posible cancelar con más de 24 horas de anticipación.',
            'warning'
          );
          return;
        }
      }
    }

    try {
      setUpdatingId(id);

      // Actualización visual inmediata e intuitiva (Optimistic UI)
      setTurnos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, estado: newStatus } : t))
      );

      // Petición segura a la API
      const res = await fetch('/api/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });

      if (!res.ok) {
        // Fallback a /api/turnos
        const resTurnos = await fetch('/api/turnos', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status: newStatus }),
        });
        if (!resTurnos.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error || 'No se pudo actualizar el estado de la reserva.');
        }
      }

      // Actualización directa opcional en Supabase con RLS en background
      try {
        await supabase
          .from('bookings')
          .update({
            status: newStatus,
            estado: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
      } catch (_) {}

      showToast(
        newStatus === 'confirmado' ? '¡Turno Confirmado!' : 'Turno Cancelado',
        newStatus === 'confirmado'
          ? 'El turno ha sido confirmado con éxito.'
          : 'El turno ha sido cancelado.',
        newStatus === 'confirmado' ? 'success' : 'warning'
      );
    } catch (err: any) {
      console.error('Error al actualizar estado:', err);
      showToast('Error', err.message || 'No se pudo actualizar el estado.', 'error');
      await loadTurnos();
    } finally {
      setUpdatingId(null);
    }
  };

  // Eliminar una reserva cancelada
  const handleDeleteBooking = async (id: string) => {
    if (!confirm('¿Deseas eliminar definitivamente este turno del registro?')) return;
    try {
      setUpdatingId(id);
      setTurnos((prev) => prev.filter((t) => t.id !== id));

      const res = await fetch(`/api/bookings?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        await fetch(`/api/turnos?id=${id}`, { method: 'DELETE' });
      }

      try {
        await supabase.from('bookings').delete().eq('id', id);
        await supabase.from('turnos').delete().eq('id', id);
      } catch (_) {}

      showToast('Turno Eliminado', 'La reserva ha sido removida del registro.', 'info');
    } catch (err: any) {
      showToast('Error', err.message || 'No se pudo eliminar el registro.', 'error');
      await loadTurnos();
    } finally {
      setUpdatingId(null);
    }
  };

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
    <main className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col relative">
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

            <div className="flex flex-wrap items-center gap-3">
              <PushTestButton />
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
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Turnos Confirmados</p>
              <p className="text-xl font-black text-white">
                {loadingTurnos
                  ? '...'
                  : turnos.filter(
                      (t) =>
                        t.estado === 'confirmado' ||
                        t.estado === 'confirmed' ||
                        t.estado === 'completado'
                    ).length}
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/40 border border-white/[0.06] backdrop-blur-md flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Turnos Pendientes</p>
              <p className="text-xl font-black text-white">
                {loadingTurnos
                  ? '...'
                  : turnos.filter(
                      (t) =>
                        t.estado !== 'confirmado' &&
                        t.estado !== 'confirmed' &&
                        t.estado !== 'cancelado' &&
                        t.estado !== 'cancelled'
                    ).length}
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/40 border border-white/[0.06] backdrop-blur-md flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <Car className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Vehículos en Cuenta</p>
              <p className="text-xl font-black text-white">
                {loadingTurnos
                  ? '...'
                  : `${new Set(turnos.map((t) => t.vehiculo)).size || 1} perfil`}
              </p>
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
                  {loadingTurnos ? 'Cargando...' : `${turnos.length} programado${turnos.length === 1 ? '' : 's'}`}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Consulta y gestiona el estado en vivo de tus turnos solicitados en AquaShine San Rafael
              </p>
            </div>
          </div>

          {loadingTurnos ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-white/[0.08] bg-slate-900/60 p-5 space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="h-3 w-16 rounded skeleton-shimmer" />
                      <div className="h-5 w-36 rounded skeleton-shimmer" />
                    </div>
                    <div className="h-6 w-20 rounded-full skeleton-shimmer" />
                  </div>
                  <div className="h-10 w-full rounded-xl skeleton-shimmer" />
                  <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                    <div className="h-4 w-24 rounded skeleton-shimmer" />
                    <div className="h-7 w-24 rounded-xl skeleton-shimmer" />
                  </div>
                </div>
              ))}
            </div>
          ) : turnos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {turnos.map((t) => {
                const isConfirmado =
                  t.estado === 'confirmado' ||
                  t.estado === 'confirmed' ||
                  t.estado === 'completado';
                const isCancelado =
                  t.estado === 'cancelado' ||
                  t.estado === 'cancelled';
                const isPendiente = !isConfirmado && !isCancelado;
                const isBusy = updatingId === t.id;
                const cancellation = checkCancellationEligibility(t);
                const canCancel = cancellation.canCancel;

                return (
                  <motion.div
                    key={t.id}
                    whileHover={{ y: -2 }}
                    className="rounded-2xl border border-white/[0.08] bg-slate-900/60 p-5 space-y-4 hover:border-cyan-500/40 transition-colors shadow-lg luxury-glass-card"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 block">
                          {t.categoria || 'Vehículo'}
                        </span>
                        <h4 className="text-base font-black text-white">{t.vehiculo}</h4>
                      </div>

                      {/* Badge de estado dinámico */}
                      <span
                        className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border inline-flex items-center gap-1 transition-colors ${
                          isConfirmado
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : isCancelado
                            ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {isConfirmado && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                        {isCancelado && <XCircle className="w-3 h-3 text-rose-400" />}
                        {isPendiente && <Clock className="w-3 h-3 text-amber-400" />}
                        <span>{t.estado}</span>
                      </span>
                    </div>

                    {t.indicaciones && (
                      <p className="text-xs text-slate-300 bg-white/[0.03] p-3 rounded-xl border border-white/[0.05] leading-relaxed">
                        {t.indicaciones}
                      </p>
                    )}

                    {/* Botones de acción rápida: Confirmar y Cancelar */}
                    <div className="pt-3 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {/* Botón Confirmar */}
                        <button
                          type="button"
                          disabled={isBusy || isConfirmado}
                          onClick={() => handleUpdateStatus(t.id, 'confirmado')}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                            isConfirmado
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 hover:border-emerald-400'
                          }`}
                          title={isConfirmado ? 'Turno confirmado' : 'Confirmar este turno'}
                        >
                          {isBusy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          <span>{isConfirmado ? 'Confirmado' : 'Confirmar'}</span>
                        </button>

                        {/* Botón Cancelar con regla de 24 horas */}
                        <button
                          type="button"
                          disabled={isBusy || isCancelado || (!isCancelado && !canCancel)}
                          onClick={() => handleUpdateStatus(t.id, 'cancelado')}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all active:scale-95 ${
                            isCancelado
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 disabled:opacity-40 cursor-not-allowed'
                              : !canCancel
                              ? 'bg-slate-800/40 text-slate-500 border border-slate-700/40 cursor-not-allowed opacity-50'
                              : 'bg-rose-600/15 hover:bg-rose-600/25 text-rose-300 border border-rose-500/30 hover:border-rose-400 cursor-pointer'
                          }`}
                          title={
                            isCancelado
                              ? 'Turno cancelado'
                              : !canCancel
                              ? cancellation.reason || 'Cancelación no permitida: faltan menos de 24 horas'
                              : 'Cancelar este turno'
                          }
                        >
                          {isBusy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          <span>{isCancelado ? 'Cancelado' : 'Cancelar'}</span>
                        </button>
                      </div>

                      {/* Si está cancelado, permitir eliminar registro */}
                      {isCancelado && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDeleteBooking(t.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 font-medium text-[11px] transition-all cursor-pointer"
                          title="Eliminar de la tabla bookings"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Eliminar</span>
                        </button>
                      )}
                    </div>

                    {/* Alerta si la cancelación está bloqueada por la regla de 24 horas */}
                    {!isCancelado && !canCancel && (
                      <div className="w-full flex items-start gap-2 text-[11px] text-amber-300/95 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400 mt-0.5" />
                        <span className="leading-tight">
                          {cancellation.reason ||
                            'Cancelación no disponible: debe realizarse con más de 24 horas de anticipación.'}
                        </span>
                      </div>
                    )}

                    {/* Fila de precio y contacto WhatsApp */}
                    <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Total:</span>
                        <span className="text-white font-extrabold text-sm">
                          ${Number(t.precio).toLocaleString('es-AR')} ARS
                        </span>
                      </div>

                      <a
                        href={`https://wa.me/5492604654255?text=${encodeURIComponent(
                          `¡Hola AquaShine San Rafael! Consulto por mi turno de ${t.vehiculo} (ID: ${t.id.slice(0, 8)}) [Estado: ${t.estado}]`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 font-bold text-[11px] transition-all"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            /* EMPTY STATE ATRACTIVO */
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
          )}
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

      {/* TOAST DE NOTIFICACIÓN FLOTANTE */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 max-w-sm w-full p-2">
          <div
            className={`p-4 rounded-2xl border backdrop-blur-2xl shadow-2xl flex items-start gap-3 ${
              toastMessage.type === 'success'
                ? 'bg-slate-900/95 border-emerald-500/40 text-emerald-300'
                : toastMessage.type === 'warning'
                ? 'bg-slate-900/95 border-amber-500/40 text-amber-300'
                : toastMessage.type === 'error'
                ? 'bg-slate-900/95 border-rose-500/40 text-rose-300'
                : 'bg-slate-900/95 border-cyan-500/40 text-cyan-300'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {toastMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {toastMessage.type === 'warning' && <AlertCircle className="w-5 h-5 text-amber-400" />}
              {toastMessage.type === 'error' && <XCircle className="w-5 h-5 text-rose-400" />}
              {(!toastMessage.type || toastMessage.type === 'info') && <Sparkles className="w-5 h-5 text-cyan-400" />}
            </div>
            <div className="flex-1">
              <h5 className="text-xs font-bold text-white">{toastMessage.title}</h5>
              <p className="text-[11px] text-slate-300 mt-0.5">{toastMessage.msg}</p>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* PIE DE PÁGINA */}
      <footer className="border-t border-white/[0.08] py-8 text-center text-xs text-slate-500 space-y-1 mt-auto">
        <p className="font-semibold text-slate-400">AquaShine San Rafael • Detailing Artesanal</p>
        <p className="text-[11px]">San Rafael, Mendoza, Argentina</p>
      </footer>
    </main>
  );
}
