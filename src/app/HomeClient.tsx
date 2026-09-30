'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import type { User } from '@supabase/supabase-js';
import { AppDownloadBadges } from '@/components/AppDownloadBadges';
import {
  VehicleSelector,
  VehicleType,
  VEHICLE_CONFIG,
} from '@/components/VehicleSelector';
import {
  ServiceModeSelector,
  ServiceMode,
  PlanCode,
  PLANS_CATALOG,
} from '@/components/ServiceModeSelector';
import { CalendarSlotPicker, isSlotPast } from '@/components/CalendarSlotPicker';
import {
  PaymentMethodSelector,
  PaymentMethod,
} from '@/components/PaymentMethodSelector';
import {
  Sparkles,
  ShieldCheck,
  CreditCard,
  Banknote,
  Clock,
  MapPin,
  Phone,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  MessageCircle,
  X,
  ExternalLink,
  Calendar,
  Car,
  Droplets,
  Check,
  ChevronRight,
  Award,
  Zap,
  User as UserIcon,
  MessageSquare,
  LogIn,
  UserPlus,
  LogOut,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// Componente para escuchar el retorno de Mercado Pago (?status=approved&id=...)
function MercadoPagoReturnHandler({
  onStatusHandled,
}: {
  onStatusHandled: (data: { status: string; id: string | null }) => void;
}) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const status = searchParams.get('status');
    const id = searchParams.get('id');
    if (status) {
      onStatusHandled({ status, id });
    }
  }, [searchParams, onStatusHandled]);

  return null;
}

export default function HomeClient({ initialUser }: { initialUser?: User | null }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(initialUser ?? null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    setUser(initialUser ?? null);
  }, [initialUser]);

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      const supabase = createClient();
      await supabase.auth.signOut();
      setUser(null);
      router.refresh();
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    } finally {
      setIsSigningOut(false);
    }
  };

  // Estado del Vehículo (Flujo de 3 Pasos en Cascada: Categoría -> Marca -> Modelo)
  const [vehicleType, setVehicleType] = useState<VehicleType>('CAR');
  const [selectedBrand, setSelectedBrand] = useState<string>('Fiat');
  const [selectedModel, setSelectedModel] = useState<string>('Cronos');
  const [customBrandText, setCustomBrandText] = useState<string>('');
  const [customModelText, setCustomModelText] = useState<string>('');

  // Estado del Servicio
  const [serviceMode, setServiceMode] = useState<ServiceMode>('INDIVIDUAL');
  const [selectedPlan, setSelectedPlan] = useState<PlanCode>('ORO');
  const [homeDelivery, setHomeDelivery] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');

  // Estado de Fecha y Turno Horario
  const todayStr = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedSlot, setSelectedSlot] = useState<{
    startTime: string;
    endTime: string;
  } | null>(null);

  // Campos de contacto (precompletados si hay sesión activa)
  const [fullName, setFullName] = useState(initialUser?.user_metadata?.full_name || '');
  const [userEmail, setUserEmail] = useState(initialUser?.email || '');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Sincronizar datos si el usuario inicia sesión en tiempo real
  useEffect(() => {
    if (user?.email && !userEmail) {
      setUserEmail(user.email);
    }
    if (user?.user_metadata?.full_name && !fullName) {
      setFullName(user.user_metadata.full_name);
    }
  }, [user]);

  // Estado del Acordeón Compacto Mobile
  const [openSection, setOpenSection] = useState<'vehicle' | 'datetime' | 'contact'>('vehicle');

  // Estado del Pago
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('MERCADO_PAGO');

  // Estado de Envío y Redirección a Mercado Pago
  const [submitting, setSubmitting] = useState(false);
  const [redirectingToMP, setRedirectingToMP] = useState<{
    url: string;
    title: string;
    amount: number;
  } | null>(null);

  const [confirmedBookingData, setConfirmedBookingData] = useState<{
    whatsAppUrl: string;
    summaryText: string;
  } | null>(null);

  const [mpReturnResult, setMpReturnResult] = useState<{
    status: 'approved' | 'failure' | 'pending';
    id: string | null;
  } | null>(null);

  const [toastMessage, setToastMessage] = useState<{
    title: string;
    msg: string;
    type?: 'success' | 'warning' | 'error' | 'info';
  } | null>(null);

  const showToast = (title: string, msg: string, type: 'success' | 'warning' | 'error' | 'info' = 'info') => {
    setToastMessage({ title, msg, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const handleMpStatus = React.useCallback(
    (data: { status: string; id: string | null }) => {
      if (data.status === 'approved') {
        setMpReturnResult({ status: 'approved', id: data.id });
      } else if (data.status === 'failure') {
        setMpReturnResult({ status: 'failure', id: data.id });
      } else if (data.status === 'pending') {
        setMpReturnResult({ status: 'pending', id: data.id });
      }
    },
    []
  );

  // Determinar marca y modelo efectivos según selecciones
  const effectiveBrand =
    selectedBrand === 'Otra Marca' ? customBrandText.trim() : selectedBrand;

  const effectiveModel =
    selectedBrand === 'Otra Marca'
      ? customModelText.trim()
      : selectedModel === 'Otro Modelo'
      ? customModelText.trim()
      : selectedModel;

  const vehicleSummaryDisplay =
    effectiveBrand && effectiveModel
      ? `${effectiveBrand} ${effectiveModel}`
      : VEHICLE_CONFIG[vehicleType].label;

  // Cálculo de Precio
  const currentTotal = useMemo(() => {
    return VEHICLE_CONFIG[vehicleType]?.price || 22000;
  }, [vehicleType]);

  // Manejador de Reserva y Redirección
  const handleSubmitBooking = async () => {
    if (!effectiveBrand) {
      setOpenSection('vehicle');
      showToast('Marca requerida', 'Por favor seleccioná o ingresá la marca de tu vehículo.', 'warning');
      return;
    }

    if (!effectiveModel) {
      setOpenSection('vehicle');
      showToast('Modelo requerido', 'Por favor seleccioná o escribí el modelo de tu vehículo.', 'warning');
      return;
    }

    if (!selectedDate || !selectedSlot) {
      setOpenSection('datetime');
      showToast('Horario requerido', 'Por favor seleccioná un horario disponible en el calendario.', 'warning');
      return;
    }

    if (isSlotPast(selectedSlot.startTime, selectedDate)) {
      setOpenSection('datetime');
      showToast('Horario no disponible', 'El horario seleccionado ya ha transcurrido. Por favor seleccioná un turno vigente.', 'warning');
      return;
    }

    if (!fullName.trim()) {
      setOpenSection('contact');
      showToast('Nombre requerido', 'Por favor ingresá tu nombre y apellido.', 'warning');
      return;
    }

    const rawPhoneDigits = phone.replace(/\D/g, '');
    if (!phone.trim() || rawPhoneDigits.length < 6) {
      setOpenSection('contact');
      showToast('WhatsApp requerido', 'Por favor ingresá un número de WhatsApp celular válido.', 'warning');
      return;
    }

    const effectiveEmail = (user?.email || userEmail || 'cliente@lavadero.com').trim();

    // Aseguramos la combinación del prefijo +54 9 con el número ingresado
    let cleanPhoneDigits = phone.trim().replace(/^(\+?54\s*9?|\+?54)\s*/, '');
    cleanPhoneDigits = cleanPhoneDigits.replace(/^0+/, '');
    const fullUserPhone = `+54 9 ${cleanPhoneDigits}`;

    setSubmitting(true);

    try {
      // 0. Obtener y verificar el ID de la sesión del usuario (Supabase Auth)
      const supabase = createClient();
      const {
        data: { user: sessionUser },
      } = await supabase.auth.getUser();
      const activeUser = sessionUser || user;

      if (!activeUser?.id) {
        showToast(
          'Sesión requerida',
          'Debés iniciar sesión para registrar tu reserva en el sistema.',
          'warning'
        );
        router.push('/login');
        setSubmitting(false);
        return;
      }

      const staticLavaderoPhone = '5492604654255';
      const paymentLabel =
        paymentMethod === 'MERCADO_PAGO'
          ? 'Mercado Pago (A coordinar)'
          : 'Efectivo en recepción';
      const serviceDescription =
        serviceMode === 'INDIVIDUAL'
          ? 'Lavado Completo Individual'
          : `Suscripción Mensual ${selectedPlan}`;

      // Formateo de notas e indicaciones con fecha y franja horaria
      const indicacionesTexto = notes.trim()
        ? `${notes.trim()} (Turno: ${selectedDate} ${selectedSlot.startTime} a ${selectedSlot.endTime} hs)`
        : `Turno: ${selectedDate} ${selectedSlot.startTime} a ${selectedSlot.endTime} hs`;

      // =========================================================================
      // PASO 1: GUARDAR EL TURNO EN LA BASE DE DATOS (CON RLS / POSTGRESQL)
      // =========================================================================
      // PASO 1: GUARDAR EL TURNO EN LA BASE DE DATOS (CON RLS / SUPABASE / POSTGRESQL)
      // =========================================================================
      let dbError: string | null = null;
      let turnoCreado: any = null;

      try {
        const turnoRes = await fetch('/api/turnos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre_cliente: fullName.trim(),
            vehiculo: vehicleSummaryDisplay,
            categoria: vehicleType,
            precio: currentTotal,
            indicaciones: indicacionesTexto,
          }),
        });

        const turnoResult = await turnoRes.json().catch(() => ({}));

        if (!turnoRes.ok) {
          dbError = turnoResult.error || 'Error al registrar el turno en la base de datos.';
        } else {
          turnoCreado = turnoResult.turno;
        }
      } catch (err: any) {
        dbError = err.message || 'Error de conexión con el servidor.';
      }

      // FRENO DE SEGURIDAD ESTRICTO: Si la base de datos falla, se detiene el proceso y se avisa al usuario
      if (dbError) {
        console.error('[Error Base de Datos]:', dbError);
        showToast(
          'Error en Base de Datos',
          `No se pudo registrar la reserva en la base de datos (${dbError}). El proceso fue cancelado.`,
          'error'
        );
        setSubmitting(false);
        return;
      }

      // Guardar información del turno en localStorage para que /reserva-exitosa dispare el email y WhatsApp
      const pendingBookingData = {
        clientName: fullName.trim(),
        clientEmail: effectiveEmail,
        clientPhone: fullUserPhone,
        vehicleSummary: vehicleSummaryDisplay,
        vehicleType,
        vehicleBrand: effectiveBrand,
        vehicleModel: effectiveModel,
        appointmentDate: selectedDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        serviceDescription,
        amount: currentTotal,
        notes: notes.trim(),
        turnoId: turnoCreado?.id,
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem(
          'lavadero_pending_booking',
          JSON.stringify(pendingBookingData)
        );
      }

      // Registro complementario no bloqueante en /api/bookings si corresponde
      try {
        await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userEmail: effectiveEmail,
            userFullName: fullName.trim(),
            userPhone: fullUserPhone,
            vehicleType,
            vehicleBrand: effectiveBrand,
            vehicleModel: effectiveModel,
            appointmentDate: selectedDate,
            startTime: selectedSlot.startTime,
            endTime: selectedSlot.endTime,
            serviceMode,
            subscriptionPlanCode: undefined,
            paymentMethod,
            notes: notes.trim(),
          }),
        });
      } catch (dbErr) {
        console.warn('[DB Booking Error non-blocking]:', dbErr);
      }

      // =========================================================================
      // FLUJO A: SI ELIGE PAGO EN EFECTIVO EN EL LOCAL
      // =========================================================================
      if (paymentMethod === 'CASH') {
        // 1. Disparar el correo de alerta interna con Resend para el administrador
        try {
          await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userEmail: effectiveEmail,
              userFullName: fullName.trim(),
              userPhone: fullUserPhone,
              vehicleType,
              vehicleBrand: effectiveBrand,
              vehicleModel: effectiveModel,
              appointmentDate: selectedDate,
              startTime: selectedSlot.startTime,
              endTime: selectedSlot.endTime,
              serviceDescription: `${serviceDescription} (Pago: Efectivo en el local)`,
              amount: currentTotal,
              notes: notes.trim()
                ? `${notes.trim()} (Pago en efectivo en el local)`
                : 'Pago en efectivo en el local',
            }),
          });
        } catch (emailErr) {
          console.warn('[Resend Email Error - Cash]:', emailErr);
        }

        // 2. Armar mensaje de WhatsApp y redirigir directamente
        const lines = [
          '¡Hola AquaShine San Rafael! 👋',
          'Quiero confirmar mi reserva de turno con *Pago en Efectivo en el local*:',
          '',
          `📅 *Fecha:* ${selectedDate}`,
          `⏰ *Horario:* ${selectedSlot.startTime} a ${selectedSlot.endTime} hs`,
          `🚗 *Vehículo:* ${vehicleSummaryDisplay}`,
          `🧼 *Servicio:* ${serviceDescription}`,
          `💰 *Total a Abonar:* $${currentTotal.toLocaleString('es-AR')} ARS (Efectivo en el local)`,
          `👤 *Cliente:* ${fullName.trim()}`,
          `📱 *Teléfono:* ${fullUserPhone}`,
          `📧 *Email:* ${effectiveEmail}`,
        ];

        if (notes.trim()) {
          lines.push(`📝 *Indicaciones:* ${notes.trim()}`);
        }

        lines.push('', '¡Muchas gracias! Aguardo confirmación del turno.');
        const whatsAppUrl = `https://wa.me/${staticLavaderoPhone}?text=${encodeURIComponent(
          lines.join('\n')
        )}`;

        showToast(
          '¡Reserva confirmada!',
          'Turno registrado con éxito. Redirigiendo a WhatsApp para coordinar tu recepción...',
          'success'
        );

        if (typeof window !== 'undefined') {
          window.location.href = whatsAppUrl;
        }
        return;
      }

      // =========================================================================
      // FLUJO B: SI ELIGE MERCADO PAGO -> LLAMAR A LA API DE CHECKOUT PRO
      // =========================================================================
      const checkoutRes = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoria: vehicleType,
          precio: currentTotal,
          turnoId: turnoCreado?.id,
          vehiculo: vehicleSummaryDisplay,
          nombre_cliente: fullName.trim(),
          userEmail: effectiveEmail,
        }),
      });

      const checkoutData = await checkoutRes.json().catch(() => ({}));

      if (!checkoutRes.ok || !checkoutData?.init_point) {
        throw new Error(
          checkoutData.error || 'No se pudo generar el enlace de pago con Mercado Pago.'
        );
      }

      // =========================================================================
      // PASO 3: REDIRIGIR AL USUARIO A LA URL DE PAGO (CHECKOUT PRO)
      // =========================================================================
      showToast(
        'Redirigiendo a Mercado Pago',
        'Turno registrado. Te estamos redirigiendo para completar el pago de forma segura...',
        'info'
      );

      if (typeof window !== 'undefined') {
        window.location.href = checkoutData.init_point;
      }
    } catch (err: any) {
      showToast('No se pudo procesar la reserva', err.message || 'Error de conexión', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen relative bg-[#06090f] text-slate-100 overflow-x-hidden selection:bg-cyan-500 selection:text-slate-950">
      {/* Ambient Radial Mesh Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 ambient-lighting" />

      {/* Escuchador de Retorno de Mercado Pago */}
      <Suspense fallback={null}>
        <MercadoPagoReturnHandler onStatusHandled={handleMpStatus} />
      </Suspense>

      {/* Toast Notification Flotante */}
      {toastMessage && (
        <div className="fixed top-20 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 p-4 rounded-2xl bg-slate-900/95 backdrop-blur-2xl border border-white/[0.12] shadow-2xl flex items-center gap-3.5 animate-in fade-in slide-in-from-top-4">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              toastMessage.type === 'success'
                ? 'bg-emerald-500/20 text-emerald-400'
                : toastMessage.type === 'error'
                ? 'bg-rose-500/20 text-rose-400'
                : toastMessage.type === 'warning'
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-cyan-500/20 text-cyan-400'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : toastMessage.type === 'error' ? (
              <AlertCircle className="w-5 h-5" />
            ) : toastMessage.type === 'warning' ? (
              <AlertCircle className="w-5 h-5" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-white">
              {toastMessage.title}
            </p>
            <p className="text-xs text-slate-300 mt-0.5 leading-snug">
              {toastMessage.msg}
            </p>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-500 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* NAVBAR SUPERIOR MODERNA */}
      <nav className="sticky top-0 z-40 w-full bg-slate-950/80 backdrop-blur-2xl border-b border-white/[0.08] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-400 via-sky-500 to-blue-600 flex items-center justify-center text-slate-950 shadow-lg shadow-cyan-500/30">
              <Droplets className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <span className="font-black text-base sm:text-lg tracking-tight text-white block leading-none">
                AquaShine San Rafael
              </span>
              <span className="text-[10px] font-bold text-cyan-400 tracking-widest uppercase mt-0.5 block">
                Detailing & Lavadero
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Turnos Online Habilitados
            </div>

            <a
              href="https://wa.me/5492604654255"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] hover:border-cyan-400/50 text-xs font-bold text-slate-200 hover:text-white transition-all duration-300 hover:scale-[1.03] shadow-md shadow-black/20 cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden md:inline">Consultas:</span>
              <span className="text-white font-extrabold">+54 9 260 465-4255</span>
            </a>
          </div>
        </div>
      </nav>

      {/* MODAL 1: REDIRECCIÓN AUTOMÁTICA A MERCADO PAGO */}
      {redirectingToMP && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900/95 border border-[#009EE3]/40 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl shadow-[#009EE3]/20">
            <div className="relative mx-auto w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#009EE3] to-[#00c8ff] flex items-center justify-center shadow-xl shadow-[#009EE3]/40 text-white">
              <CreditCard className="w-10 h-10 animate-pulse" />
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-[#009EE3]/20 text-[#00c8ff] border border-[#009EE3]/30">
                Mercado Pago Oficial
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white pt-1">
                Conectando con Mercado Pago...
              </h3>
              <p className="text-xs text-slate-300">
                Tu turno fue pre-reservado. Te estamos redirigiendo para completar el pago de forma oficial y segura.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/[0.08] text-left space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">Concepto:</span>
                <span className="font-bold text-white text-right">{redirectingToMP.title}</span>
              </div>
              <div className="flex justify-between text-slate-300 pt-1.5 border-t border-white/[0.08]">
                <span className="text-slate-400">Total a abonar:</span>
                <span className="font-black text-cyan-400 text-sm">
                  ${redirectingToMP.amount.toLocaleString('es-AR')} ARS
                </span>
              </div>
            </div>

            <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-white/[0.08]">
              <div className="bg-gradient-to-r from-[#009EE3] to-[#00c8ff] h-full rounded-full animate-pulse w-full" />
            </div>

            <div className="space-y-2 pt-2">
              <a
                href={redirectingToMP.url}
                className="w-full py-3.5 px-5 rounded-2xl bg-[#009EE3] hover:bg-[#0082c9] text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#009EE3]/30 transition-all active:scale-95 cursor-pointer"
              >
                <span>Hacé clic acá si no redirige automáticamente</span>
                <ExternalLink className="w-4 h-4" />
              </a>

              <button
                type="button"
                onClick={() => setRedirectingToMP(null)}
                className="text-xs text-slate-400 hover:text-white pt-1 block mx-auto cursor-pointer"
              >
                Cancelar y volver al formulario
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRMACIÓN PAGO EN EFECTIVO (WHATSAPP) */}
      {confirmedBookingData && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900/95 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl shadow-emerald-500/20">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Turno Confirmado
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white pt-1">
                ¡Reserva Lista con Éxito!
              </h3>
              <p className="text-xs text-slate-300">
                {confirmedBookingData.summaryText}
              </p>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Enviamos el comprobante a tu correo electrónico. Si WhatsApp no se abrió de forma automática, hacé clic en el botón de abajo para enviar el mensaje con los detalles a nuestro número oficial (+54 9 260 465-4255):
            </p>

            <div className="space-y-2.5 pt-2">
              <a
                href={confirmedBookingData.whatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-600/25 transition-all active:scale-95 cursor-pointer"
              >
                <MessageCircle className="w-5 h-5" />
                <span>Abrir WhatsApp con Resumen</span>
              </a>

              <button
                type="button"
                onClick={() => setConfirmedBookingData(null)}
                className="text-xs text-slate-400 hover:text-white pt-1 block mx-auto cursor-pointer"
              >
                Cerrar ventana
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: RETORNO DE MERCADO PAGO (?status=approved, etc.) */}
      {mpReturnResult && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900/95 border border-white/[0.1] rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl">
            {mpReturnResult.status === 'approved' ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Pago Aprobado
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    ¡Pago Confirmado por Mercado Pago!
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Tu pago fue acreditado correctamente. El turno asignado para tu vehículo está asegurado. ¡Te esperamos en el lavadero!
                  </p>
                </div>
              </>
            ) : mpReturnResult.status === 'pending' ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                  <Clock className="w-8 h-8" />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Pago Pendiente
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    Pago en Proceso
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Tu pago está pendiente de acreditación en Mercado Pago. Apenas se complete recibirás la confirmación de tu turno.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    No se completó el pago
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    Pago No Procesado
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    El pago no pudo ser completado en Mercado Pago. Podés reintentar abonar online o elegir la opción de pago en efectivo en el taller.
                  </p>
                </div>
              </>
            )}

            <button
              type="button"
              onClick={() => setMpReturnResult(null)}
              className="w-full py-3.5 px-5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-sm transition-all cursor-pointer shadow-lg shadow-cyan-500/20"
            >
              Aceptar y Continuar
            </button>
          </div>
        </div>
      )}

      {/* BARRA SUPERIOR CON BOTONES DE ACCESO */}
      <nav className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-sm shadow-cyan-400" />
          <span className="text-xs sm:text-sm font-black tracking-tight text-white">
            AquaShine <span className="text-cyan-400">San Rafael</span>
          </span>
        </div>
        <div className="flex items-center gap-2.5 sm:gap-3">
          {user ? (
            <>
              {/* Usuario con sesión activa */}
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-bold text-xs shadow-sm transition-all duration-200 active:scale-95 cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                <span>Mis Turnos</span>
              </Link>
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.07] border border-white/[0.12] text-xs text-slate-200 backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span className="max-w-[120px] sm:max-w-[200px] truncate font-medium text-slate-300">
                  {user.email}
                </span>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 text-rose-300 hover:text-rose-100 font-bold text-xs shadow-sm transition-all duration-200 active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{isSigningOut ? 'Saliendo...' : 'Cerrar Sesión'}</span>
              </button>
            </>
          ) : (
            <>
              {/* Usuario sin sesión */}
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.15] text-slate-200 hover:text-white font-bold text-xs shadow-sm transition-all duration-200 active:scale-95 cursor-pointer backdrop-blur-md"
              >
                <LogIn className="w-3.5 h-3.5 text-cyan-400" />
                <span>Iniciar Sesión</span>
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all duration-200 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5 text-slate-950" />
                <span>Registrarse</span>
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* CONTENEDOR PRINCIPAL */}
      <div className="relative z-10 w-full max-w-2xl mx-auto px-3 sm:px-6 py-3 sm:py-6 space-y-4 sm:space-y-6">
        
        {/* RENDERIZADO CONDICIONAL SEGÚN ESTADO DE SESIÓN */}
        {!user ? (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
            {/* HERO SECTION CUANDO NO HAY SESIÓN */}
            <header className="text-center space-y-4 max-w-xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.09] text-slate-300 text-xs font-semibold backdrop-blur-xl">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
                </span>
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                <span>San Rafael, Mendoza • Turnos Online</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold whitespace-nowrap bg-clip-text text-transparent bg-gradient-to-r from-white to-cyan-400">
                AquaShine San Rafael
              </h1>

              <p className="text-xs sm:text-base text-slate-300 max-w-md mx-auto font-normal leading-relaxed">
                Lavadero Artesanal, Detailing & Turnos en Vivo. Cuidamos cada detalle de tu vehículo.
              </p>
            </header>

            <div className="relative overflow-hidden rounded-3xl bg-slate-900/80 border border-white/[0.1] p-6 sm:p-10 text-center backdrop-blur-2xl shadow-2xl shadow-black/40">
              <div className="relative mx-auto w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-xl shadow-cyan-500/10 mb-4">
                <Calendar className="w-7 h-7 text-cyan-400" />
              </div>

              <div className="space-y-2 max-w-md mx-auto">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  ¡Reserva tu turno online!
                </h2>
                <p className="text-sm font-semibold text-cyan-300">
                  Inicia sesión o crea tu cuenta para solicitar un turno.
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Consulta disponibilidad de boxes en vivo y confirma tu horario sin demoras.
                </p>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-sm mx-auto">
                <Link
                  href="/login"
                  className="w-full sm:w-1/2 py-3.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-[0.98] text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
                >
                  <LogIn className="w-4 h-4 text-slate-950" />
                  <span>Iniciar Sesión</span>
                </Link>
                <Link
                  href="/register"
                  className="w-full sm:w-1/2 py-3.5 px-4 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.15] active:scale-[0.98] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <UserPlus className="w-4 h-4 text-cyan-400" />
                  <span>Registrarse</span>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          /* FORMULARIO COMPACTO MOBILE PWA CON ACORDEÓN Y SELECTOR HORIZONTAL */
          <div className="space-y-3 animate-in fade-in duration-300">
            {/* Header Compacto App */}
            <div className="text-center space-y-0.5 pb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                PWA Móvil • AquaShine San Rafael
              </span>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Reserva de Turno
              </h2>
            </div>

            {/* ============================================================== */}
            {/* PASO 1: VEHÍCULO (ACORDEÓN) */}
            {/* ============================================================== */}
            <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-slate-950/60 backdrop-blur-xl transition-all duration-300">
              <button
                type="button"
                onClick={() => setOpenSection((prev) => (prev === 'vehicle' ? 'vehicle' : 'vehicle'))}
                className={`w-full p-3 sm:p-3.5 flex items-center justify-between text-left transition-all cursor-pointer ${
                  openSection === 'vehicle'
                    ? 'bg-slate-900/90 border-b border-white/[0.06]'
                    : 'hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/30">
                    <Car className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <span>Paso 1</span>
                      <span className="text-slate-600">•</span>
                      <span>Vehículo</span>
                    </div>
                    <div className="text-xs sm:text-sm font-extrabold text-white truncate">
                      {vehicleSummaryDisplay}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-black text-cyan-400">
                    ${currentTotal.toLocaleString('es-AR')}
                  </span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                    {openSection === 'vehicle' ? 'Editando' : '✓ Listo'}
                  </span>
                  {openSection === 'vehicle' ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </button>

              {openSection === 'vehicle' && (
                <div className="p-3 sm:p-3.5 space-y-3 bg-slate-900/40 animate-in fade-in duration-200">
                  <VehicleSelector
                    selectedType={vehicleType}
                    onTypeChange={setVehicleType}
                    selectedBrand={selectedBrand}
                    onBrandChange={setSelectedBrand}
                    selectedModel={selectedModel}
                    onModelChange={setSelectedModel}
                    customBrandText={customBrandText}
                    onCustomBrandTextChange={setCustomBrandText}
                    customModelText={customModelText}
                    onCustomModelTextChange={setCustomModelText}
                    compact
                  />
                  <button
                    type="button"
                    onClick={() => setOpenSection('datetime')}
                    className="w-full py-2 px-3 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.99]"
                  >
                    <span>Continuar a Fecha y Turno</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* ============================================================== */}
            {/* PASO 2: FECHA Y TURNO (ACORDEÓN) */}
            {/* ============================================================== */}
            <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-slate-950/60 backdrop-blur-xl transition-all duration-300">
              <button
                type="button"
                onClick={() => setOpenSection((prev) => (prev === 'datetime' ? 'datetime' : 'datetime'))}
                className={`w-full p-3 sm:p-3.5 flex items-center justify-between text-left transition-all cursor-pointer ${
                  openSection === 'datetime'
                    ? 'bg-slate-900/90 border-b border-white/[0.06]'
                    : 'hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                    selectedSlot
                      ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                      : 'bg-white/[0.05] text-slate-400 border-white/[0.08]'
                  }`}>
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <span>Paso 2</span>
                      <span className="text-slate-600">•</span>
                      <span>Fecha y Horario</span>
                    </div>
                    <div className="text-xs sm:text-sm font-extrabold text-white truncate">
                      {selectedSlot
                        ? `${selectedDate} • ${selectedSlot.startTime} a ${selectedSlot.endTime} hs`
                        : 'Elegir día y bloque horario'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                    selectedSlot
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}>
                    {openSection === 'datetime' ? 'Editando' : selectedSlot ? '✓ Listo' : 'Pendiente'}
                  </span>
                  {openSection === 'datetime' ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </button>

              {openSection === 'datetime' && (
                <div className="p-3 sm:p-3.5 space-y-3 bg-slate-900/40 animate-in fade-in duration-200">
                  <CalendarSlotPicker
                    selectedDate={selectedDate}
                    onDateChange={setSelectedDate}
                    selectedSlot={selectedSlot}
                    onSlotChange={setSelectedSlot}
                    compact
                  />
                  <button
                    type="button"
                    onClick={() => setOpenSection('contact')}
                    className="w-full py-2 px-3 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.99]"
                  >
                    <span>Continuar a Mis Datos</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* ============================================================== */}
            {/* PASO 3: TUS DATOS (ACORDEÓN) */}
            {/* ============================================================== */}
            <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-slate-950/60 backdrop-blur-xl transition-all duration-300">
              <button
                type="button"
                onClick={() => setOpenSection((prev) => (prev === 'contact' ? 'contact' : 'contact'))}
                className={`w-full p-3 sm:p-3.5 flex items-center justify-between text-left transition-all cursor-pointer ${
                  openSection === 'contact'
                    ? 'bg-slate-900/90 border-b border-white/[0.06]'
                    : 'hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                    fullName.trim() && phone.trim()
                      ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                      : 'bg-white/[0.05] text-slate-400 border-white/[0.08]'
                  }`}>
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <span>Paso 3</span>
                      <span className="text-slate-600">•</span>
                      <span>Contacto</span>
                    </div>
                    <div className="text-xs sm:text-sm font-extrabold text-white truncate">
                      {fullName.trim() ? fullName.trim() : 'Tus Datos'}
                      {phone.trim() ? ` • +54 9 ${phone.replace(/\D/g, '')}` : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                    fullName.trim() && phone.trim()
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}>
                    {openSection === 'contact' ? 'Editando' : fullName.trim() && phone.trim() ? '✓ Listo' : 'Pendiente'}
                  </span>
                  {openSection === 'contact' ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </button>

              {openSection === 'contact' && (
                <div className="p-3 sm:p-3.5 space-y-2.5 bg-slate-900/40 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Nombre y Apellido */}
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Nombre y Apellido *
                      </label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Ej: Juan Pérez"
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950/80 border border-white/[0.09] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 shadow-inner"
                      />
                    </div>

                    {/* WhatsApp */}
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        WhatsApp / Celular *
                      </label>
                      <div className="flex rounded-xl bg-slate-950/80 border border-white/[0.09] focus-within:border-cyan-400 overflow-hidden shadow-inner">
                        <span className="inline-flex items-center px-2 bg-white/[0.04] border-r border-white/[0.08] text-[10px] font-black text-cyan-400 select-none">
                          +54 9
                        </span>
                        <input
                          type="tel"
                          required
                          value={phone}
                          onChange={(e) => {
                            let val = e.target.value;
                            val = val.replace(/^(\+?54\s*9?|\+?54)\s*/, '');
                            setPhone(val);
                          }}
                          placeholder="260 465-4255"
                          className="w-full min-w-0 px-2.5 py-2 text-xs bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Indicaciones Opcionales */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Indicaciones Especiales (Opcional)
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ej: Cuidado con llantas, retirar por la tarde"
                      className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-950/60 border border-white/[0.07] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ============================================================== */}
            {/* SELECTOR DE PAGO INTEGRADO (DOS BOTONES PÍLDORA COMPACTOS) */}
            {/* ============================================================== */}
            <div className="pt-0.5">
              <div className="flex items-center justify-between mb-1 px-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <CreditCard className="w-3 h-3 text-cyan-400" />
                  <span>Método de Pago</span>
                </span>
                <span className="text-[10px] text-slate-500">Seleccioná tu forma de abono</span>
              </div>

              <div className="p-1 rounded-2xl bg-slate-950/80 border border-white/[0.08] grid grid-cols-2 gap-1.5 shadow-inner">
                {/* Mercado Pago */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('MERCADO_PAGO')}
                  className={`py-2 px-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    paymentMethod === 'MERCADO_PAGO'
                      ? 'bg-[#009EE3] text-white shadow-md shadow-[#009EE3]/30 scale-[1.01]'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Mercado Pago</span>
                </button>

                {/* Efectivo en el local */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`py-2 px-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    paymentMethod === 'CASH'
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30 scale-[1.01]'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Efectivo en el local</span>
                </button>
              </div>
            </div>

            {/* ============================================================== */}
            {/* RESUMEN COMPACTO Y BOTÓN DE ACCIÓN DINÁMICO */}
            {/* ============================================================== */}
            <div
              className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-300 space-y-2.5 backdrop-blur-xl ${
                paymentMethod === 'MERCADO_PAGO'
                  ? 'bg-slate-900/80 border-cyan-500/30 shadow-xl shadow-cyan-950/20'
                  : 'bg-slate-900/80 border-emerald-500/30 shadow-xl shadow-emerald-950/20'
              }`}
            >
              {/* Línea Resumen de Reserva */}
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Total Reserva
                  </span>
                  <div className="text-xl sm:text-2xl font-black text-white leading-tight">
                    ${currentTotal.toLocaleString('es-AR')}{' '}
                    <span className="text-[10px] font-normal text-slate-400">ARS</span>
                  </div>
                </div>

                <div className="text-right space-y-0.5">
                  <div className="text-xs font-black text-white truncate max-w-[170px]">
                    {vehicleSummaryDisplay}
                  </div>
                  <div className="text-[11px] font-semibold text-cyan-400 truncate max-w-[170px]">
                    {selectedSlot ? `${selectedDate} (${selectedSlot.startTime} hs)` : 'Sin turno elegido'}
                  </div>
                </div>
              </div>

              {/* Botón de Acción Dinámico */}
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmitBooking}
                className={`w-full py-3.5 px-4 rounded-xl font-black text-sm tracking-wide transition-all duration-200 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
                  paymentMethod === 'MERCADO_PAGO'
                    ? 'bg-gradient-to-r from-[#009EE3] via-sky-500 to-cyan-500 hover:from-[#0089c7] hover:to-cyan-400 text-white shadow-[#009EE3]/25'
                    : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 shadow-emerald-500/25'
                }`}
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>
                      {paymentMethod === 'MERCADO_PAGO'
                        ? 'Conectando con Mercado Pago...'
                        : 'Registrando reserva...'}
                    </span>
                  </>
                ) : (
                  <>
                    <span>
                      {paymentMethod === 'MERCADO_PAGO'
                        ? 'Pagar con Mercado Pago'
                        : 'Confirmar Reserva'}
                    </span>
                    {paymentMethod === 'MERCADO_PAGO' ? (
                      <CreditCard className="w-4 h-4" />
                    ) : (
                      <MessageCircle className="w-4 h-4" />
                    )}
                  </>
                )}
              </button>

              <p className="text-[10px] text-center text-slate-400 leading-tight">
                {paymentMethod === 'MERCADO_PAGO' ? (
                  <>🔒 Checkout Pro seguro. Guarda tu turno y te redirige a abonar online.</>
                ) : (
                  <>💵 Abonás en el local. Guarda tu turno, alerta por email y abre <strong>WhatsApp</strong>.</>
                )}
              </p>
            </div>
          </div>
        )}

        {/* PIE DE PÁGINA CONTEMPORÁNEO */}
        <footer className="pt-6 mt-6 border-t border-white/[0.08] text-center space-y-2">
          <div className="max-w-xl mx-auto space-y-2">
            <h4 className="text-sm font-black text-white tracking-tight">
              AquaShine San Rafael • Detailing & Lavadero
            </h4>
            <p className="text-xs text-slate-400">
              San Rafael, Mendoza, Argentina • Contacto: +54 9 260 465-4255
            </p>
            <p className="text-[11px] text-slate-500">
              Horarios: Lunes a Viernes de 09:00 a 13:00 y 16:00 a 21:00 hs • Sábados de 09:00 a 13:00 hs • Domingos cerrado
            </p>
          </div>

          <p className="text-[11px] text-slate-600">
            © {new Date().getFullYear()} AquaShine San Rafael. Todos los derechos reservados.
          </p>
        </footer>

      </div>
    </main>
  );
}
