'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { fireSuccessConfetti } from '@/lib/confetti';
import {
  CheckCircle2,
  Calendar,
  Clock,
  Car,
  User,
  Phone,
  Mail,
  MessageCircle,
  Home,
  FileText,
  Loader2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

interface BookingData {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  vehicleSummary: string;
  vehicleType: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  serviceDescription: string;
  amount: number;
  homeDelivery?: boolean;
  deliveryAddress?: string;
  notes?: string;
  turnoId?: string;
}

function ReservaExitosaContent() {
  const searchParams = useSearchParams();
  const paymentId = searchParams.get('payment_id') || searchParams.get('collection_id');
  const paymentStatus = searchParams.get('status') || searchParams.get('collection_status');

  const [booking, setBooking] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const emailDispatchedRef = useRef(false);

  useEffect(() => {
    // 1. Recuperar los datos del turno guardados en localStorage antes de redirigir a Mercado Pago
    try {
      const stored = localStorage.getItem('lavadero_pending_booking');
      if (stored) {
        const parsed: BookingData = JSON.parse(stored);
        setBooking(parsed);
      }
      fireSuccessConfetti();
    } catch (e) {
      console.error('[Reserva Exitosa]: Error leyendo localStorage', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Disparar el correo de alerta interna con Resend automáticamente al llegar a la página
  useEffect(() => {
    if (!booking || emailDispatchedRef.current) return;

    emailDispatchedRef.current = true;
    setEmailStatus('sending');

    const emailPayload = {
      userEmail: booking.clientEmail,
      userFullName: booking.clientName,
      userPhone: booking.clientPhone,
      vehicleType: booking.vehicleType,
      vehicleBrand: booking.vehicleBrand,
      vehicleModel: booking.vehicleModel,
      appointmentDate: booking.appointmentDate,
      startTime: booking.startTime,
      endTime: booking.endTime,
      serviceDescription: booking.serviceDescription,
      amount: booking.amount,
      homeDelivery: booking.homeDelivery,
      deliveryAddress: booking.deliveryAddress,
      notes: booking.notes,
    };

    fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emailPayload),
    })
      .then((res) => {
        if (res.ok) {
          setEmailStatus('sent');
          console.log('[Reserva Exitosa]: Correo de alerta interna enviado exitosamente con Resend.');
        } else {
          setEmailStatus('error');
          console.warn('[Reserva Exitosa]: El servidor respondió con error al enviar el email.');
        }
      })
      .catch((err) => {
        console.error('[Reserva Exitosa]: Error de red al enviar el correo:', err);
        setEmailStatus('error');
      });
  }, [booking]);

  // Construir mensaje de WhatsApp con los datos del turno
  const staticLavaderoPhone = '5492604654255';
  const lines = [
    '¡Hola AquaShine San Rafael! \uD83D\uDC4B',
    'Acabo de abonar mi reserva en Mercado Pago y confirmo mi turno:',
    '',
  ];

  if (booking) {
    lines.push(`\uD83D\uDCC5 *Fecha:* ${booking.appointmentDate}`);
    lines.push(`\u23F0 *Horario:* ${booking.startTime} a ${booking.endTime} hs`);
    lines.push(`\uD83D\uDE97 *Vehículo:* ${booking.vehicleSummary}`);
    lines.push(`\uD83E\uDDFC *Servicio:* ${booking.serviceDescription}`);
    lines.push(
      `\uD83D\uDCB0 *Total Pagado:* $${Number(booking.amount).toLocaleString('es-AR')} ARS (Mercado Pago)`
    );
    lines.push(`\uD83D\uDC64 *Cliente:* ${booking.clientName}`);
    lines.push(`\uD83D\uDCF1 *Teléfono:* ${booking.clientPhone}`);
    lines.push(`\uD83D\uDCE7 *Email:* ${booking.clientEmail}`);

    if (booking.homeDelivery && booking.deliveryAddress) {
      lines.push(`\uD83D\uDE9A *Retiro / Entrega a Domicilio:* ${booking.deliveryAddress}`);
    }

    if (booking.notes) {
      lines.push(`\uD83D\uDCDD *Notas:* ${booking.notes}`);
    }
  }

  if (paymentId) {
    lines.push(`\uD83D\uDCB3 *Nº Comprobante MP:* #${paymentId}`);
  }

  lines.push('', '¡Muchas gracias! Aguardo confirmación de la recepción.');
  const whatsAppUrl = `https://wa.me/${staticLavaderoPhone}?text=${encodeURIComponent(
    lines.join('\n')
  )}`;

  const handleWhatsAppClick = () => {
    // Si aún no se había enviado el correo, intentarlo también al hacer clic
    if (booking && emailStatus !== 'sent' && !emailDispatchedRef.current) {
      emailDispatchedRef.current = true;
      fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: booking.clientEmail,
          userFullName: booking.clientName,
          userPhone: booking.clientPhone,
          vehicleType: booking.vehicleType,
          vehicleBrand: booking.vehicleBrand,
          vehicleModel: booking.vehicleModel,
          appointmentDate: booking.appointmentDate,
          startTime: booking.startTime,
          endTime: booking.endTime,
          serviceDescription: booking.serviceDescription,
          amount: booking.amount,
          homeDelivery: booking.homeDelivery,
          deliveryAddress: booking.deliveryAddress,
          notes: booking.notes,
        }),
      }).catch((e) => console.error(e));
    }
    window.open(whatsAppUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col justify-between selection:bg-cyan-500 selection:text-slate-950">
      {/* Glow ambiental */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-15%] left-[20%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] right-[10%] w-[450px] h-[450px] bg-cyan-500/15 rounded-full blur-[140px]" />
      </div>

      <header className="relative z-10 border-b border-white/[0.08] backdrop-blur-md bg-slate-950/60 sticky top-0 px-4 sm:px-8 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-400 to-blue-600 flex items-center justify-center font-black text-slate-950 text-base shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
              AS
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-white group-hover:text-cyan-400 transition-colors">
                AquaShine
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 ml-1.5 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                San Rafael
              </span>
            </div>
          </Link>

          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-white/[0.08] rounded-xl transition-all"
          >
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            <span>Mis Turnos</span>
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex-1 max-w-3xl w-full mx-auto px-4 py-10 sm:py-14 flex flex-col items-center">
        {/* Ícono de Éxito con Animación Spring y Glow */}
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          className="relative mb-6"
        >
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-tr from-emerald-400 via-teal-300 to-cyan-400 p-0.5 shadow-2xl shadow-emerald-500/40 flex items-center justify-center">
            <div className="w-full h-full bg-[#0a101d] rounded-[22px] flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 sm:w-14 sm:h-14 text-emerald-400 animate-pulse" />
            </div>
          </div>
          <span className="absolute -top-1 -right-1 flex h-6 w-6">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-6 w-6 bg-emerald-500 items-center justify-center text-[10px] text-slate-950 font-black shadow-md">
              ✓
            </span>
          </span>
        </motion.div>

        {/* Título Principal */}
        <div className="text-center space-y-2.5 mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-extrabold uppercase tracking-wider shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Mercado Pago Checkout Pro</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-emerald-100 to-emerald-400">
            ¡Pago exitoso y reserva confirmada!
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-lg mx-auto leading-relaxed">
            Tu pago ha sido procesado de forma correcta. Para finalizar y coordinar los detalles con el lavadero, abrí la conversación en WhatsApp.
          </p>
        </div>

        {/* Card con Detalles de la Reserva (Luxury Glassmorphism & Neon Glow) */}
        <div className="w-full luxury-glass-card neon-border-emerald rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl mb-8 space-y-6 relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Resumen de la Reserva
              </span>
            </div>
            {paymentId && (
              <span className="text-[11px] font-mono text-slate-400 bg-white/[0.04] px-2.5 py-1 rounded-lg border border-white/[0.06]">
                ID: #{paymentId}
              </span>
            )}
          </div>

          {booking ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-950/50 border border-white/[0.04]">
                <Calendar className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs text-slate-400 font-semibold">Fecha y Horario</div>
                  <div className="font-extrabold text-white mt-0.5">
                    {booking.appointmentDate}
                  </div>
                  <div className="text-xs text-cyan-300 font-bold">
                    {booking.startTime} a {booking.endTime} hs
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-950/50 border border-white/[0.04]">
                <Car className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs text-slate-400 font-semibold">Vehículo y Servicio</div>
                  <div className="font-extrabold text-white mt-0.5">
                    {booking.vehicleSummary}
                  </div>
                  <div className="text-xs text-slate-300">{booking.serviceDescription}</div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-950/50 border border-white/[0.04]">
                <User className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs text-slate-400 font-semibold">Cliente</div>
                  <div className="font-extrabold text-white mt-0.5">{booking.clientName}</div>
                  <div className="text-xs text-slate-400">{booking.clientEmail}</div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-950/50 border border-white/[0.04]">
                <Clock className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs text-slate-400 font-semibold">Monto Abonado</div>
                  <div className="text-lg font-black text-emerald-400 mt-0.5">
                    ${Number(booking.amount).toLocaleString('es-AR')} ARS
                  </div>
                  <div className="text-[11px] text-emerald-300/80 font-bold uppercase tracking-wider">
                    Aprobado • Mercado Pago
                  </div>
                </div>
              </div>

              {booking.homeDelivery && booking.deliveryAddress && (
                <div className="sm:col-span-2 p-3.5 rounded-2xl bg-slate-950/50 border border-white/[0.04] text-xs">
                  <span className="font-bold text-cyan-400">Entrega a domicilio:</span>{' '}
                  <span className="text-slate-200">{booking.deliveryAddress}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-sm text-slate-400 space-y-1">
              <p>Turno registrado y acreditado en Mercado Pago.</p>
              <p className="text-xs text-slate-500">
                Podés verificar tu comprobante en la conversación de WhatsApp.
              </p>
            </div>
          )}

          {/* Estado de envío de notificación interna */}
          <div className="pt-2 flex items-center justify-between text-xs text-slate-400 border-t border-white/[0.06]">
            <span>Alerta por correo al administrador:</span>
            {emailStatus === 'sending' ? (
              <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Enviando notificación...
              </span>
            ) : emailStatus === 'sent' ? (
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Notificación enviada (Resend)
              </span>
            ) : emailStatus === 'error' ? (
              <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                <AlertCircle className="w-3.5 h-3.5" />
                Error notificando por correo (WhatsApp vigente)
              </span>
            ) : (
              <span className="text-slate-500">Listo para notificar</span>
            )}
          </div>
        </div>

        {/* Botón Final WhatsApp con Efecto Shimmer */}
        <div className="w-full space-y-3.5">
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleWhatsAppClick}
            className="w-full py-4 sm:py-5 px-6 rounded-2xl font-black text-sm sm:text-base text-white bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 transition-all shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-3 cursor-pointer group relative overflow-hidden"
          >
            {/* Shimmer light sweep */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-20deg] animate-shimmer-sweep" />
            </div>

            <MessageCircle className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
            <span>Abrir WhatsApp y Enviar Datos del Turno</span>
          </motion.button>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <Link
              href="/dashboard"
              className="py-3 px-4 rounded-xl text-center text-xs font-extrabold text-slate-300 bg-slate-900/80 hover:bg-slate-800 hover:text-white border border-white/[0.08] transition-all flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4 text-cyan-400" />
              <span>Ver Mis Reservas</span>
            </Link>

            <Link
              href="/"
              className="py-3 px-4 rounded-xl text-center text-xs font-extrabold text-slate-300 bg-slate-900/80 hover:bg-slate-800 hover:text-white border border-white/[0.08] transition-all flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4 text-cyan-400" />
              <span>Volver a la Página Principal</span>
            </Link>
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/[0.06] py-6 text-center text-xs text-slate-500">
        Lavadero AquaShine San Rafael • Sistema Automatizado de Turnos y Pagos
      </footer>
    </div>
  );
}

export default function ReservaExitosaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070b14] flex flex-col items-center justify-center text-slate-300 gap-3">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <span className="text-sm font-semibold">Cargando confirmación de reserva...</span>
        </div>
      }
    >
      <ReservaExitosaContent />
    </Suspense>
  );
}
