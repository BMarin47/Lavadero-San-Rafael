'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { CalendarSlotPicker } from '@/components/CalendarSlotPicker';
import {
  PaymentMethodSelector,
  PaymentMethod,
} from '@/components/PaymentMethodSelector';
import {
  Sparkles,
  ShieldCheck,
  CreditCard,
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

export default function Home() {
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

  // Campos de contacto
  const [fullName, setFullName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

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
    if (serviceMode === 'INDIVIDUAL') {
      return VEHICLE_CONFIG[vehicleType].price;
    }
    const plan = PLANS_CATALOG.find((p) => p.code === selectedPlan);
    return plan ? plan.prices[vehicleType].price : 38000;
  }, [serviceMode, vehicleType, selectedPlan]);

  // Manejador de Reserva y Redirección
  const handleSubmitBooking = async () => {
    if (!effectiveBrand) {
      showToast('Marca requerida', 'Por favor seleccioná o ingresá la marca de tu vehículo.', 'warning');
      return;
    }

    if (!effectiveModel) {
      showToast('Modelo requerido', 'Por favor seleccioná o escribí el modelo de tu vehículo.', 'warning');
      return;
    }

    if (!selectedDate || !selectedSlot) {
      showToast('Horario requerido', 'Por favor seleccioná un horario disponible en el calendario.', 'warning');
      return;
    }

    if (!fullName.trim()) {
      showToast('Nombre requerido', 'Por favor ingresá tu nombre y apellido.', 'warning');
      return;
    }

    if (!userEmail.trim()) {
      showToast('Correo requerido', 'Por favor ingresá tu correo electrónico para el comprobante.', 'warning');
      return;
    }

    const rawPhoneDigits = phone.replace(/\D/g, '');
    if (!phone.trim() || rawPhoneDigits.length < 6) {
      showToast('Teléfono requerido', 'Por favor ingresá un número de WhatsApp celular válido.', 'warning');
      return;
    }

    // Aseguramos la combinación del prefijo +54 9 con el número ingresado
    let cleanPhoneDigits = phone.trim().replace(/^(\+?54\s*9?|\+?54)\s*/, '');
    cleanPhoneDigits = cleanPhoneDigits.replace(/^0+/, '');
    const fullUserPhone = `+54 9 ${cleanPhoneDigits}`;

    setSubmitting(true);

    try {
      const payload = {
        userEmail: userEmail.trim(),
        userFullName: fullName.trim(),
        userPhone: fullUserPhone,
        vehicleType,
        vehicleBrand: effectiveBrand,
        vehicleModel: effectiveModel,
        appointmentDate: selectedDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        serviceMode,
        subscriptionPlanCode: serviceMode === 'SUBSCRIPTION' ? selectedPlan : undefined,
        paymentMethod,
        homeDeliveryRequested: homeDelivery,
        deliveryAddress: homeDelivery ? deliveryAddress.trim() : undefined,
        notes: notes.trim(),
      };

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error procesando tu turno.');
      }

      let whatsAppUrl = data.data?.whatsAppUrl;
      if (whatsAppUrl) {
        whatsAppUrl = whatsAppUrl.replace(/wa\.me\/([^?]+)/, (_: string, targetPhone: string) => {
          let digits = targetPhone.replace(/\D/g, '');
          if (!digits.startsWith('549')) {
            if (digits.startsWith('54')) digits = digits.slice(2);
            digits = digits.replace(/^0+/, '');
            digits = `549${digits}`;
          }
          return `wa.me/${digits.replace(/\D/g, '')}`;
        });
      }
      const mpCheckoutUrl = data.data?.mpCheckoutUrl;

      // REDIRECCIÓN A MERCADO PAGO
      if (paymentMethod === 'MERCADO_PAGO' && mpCheckoutUrl) {
        showToast(
          'Pre-reserva Lista',
          'Conectando de forma segura con Mercado Pago...',
          'success'
        );

        setRedirectingToMP({
          url: mpCheckoutUrl,
          title: `${vehicleSummaryDisplay} - ${serviceMode === 'INDIVIDUAL' ? 'Lavado Individual' : `Suscripción ${selectedPlan}`}`,
          amount: currentTotal,
        });

        setTimeout(() => {
          window.location.href = mpCheckoutUrl;
        }, 700);
        return;
      }

      // PAGO EN EFECTIVO
      setConfirmedBookingData({
        whatsAppUrl,
        summaryText: `${selectedDate} de ${selectedSlot.startTime} a ${selectedSlot.endTime} hs • ${vehicleSummaryDisplay}`,
      });

      showToast(
        '¡Turno Reservado con Éxito!',
        'Abrí WhatsApp con el resumen de tu turno para notificar al lavadero.',
        'success'
      );
    } catch (err: any) {
      showToast('No se pudo reservar', err.message || 'Error de conexión', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen relative bg-[#070a12] text-slate-100 overflow-x-hidden selection:bg-cyan-500 selection:text-white">
      {/* Luces ambientales / Glow Background Mesh */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 left-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 -right-24 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[140px]" />
        <div className="absolute -bottom-32 left-1/3 w-[650px] h-[650px] bg-indigo-600/10 rounded-full blur-[160px]" />
      </div>

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
      <nav className="sticky top-0 z-40 w-full bg-slate-950/75 backdrop-blur-xl border-b border-white/[0.06] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25">
              <Droplets className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-white block leading-none">
                AquaShine San Rafael
              </span>
              <span className="text-[10px] font-semibold text-cyan-400 tracking-wider uppercase">
                Detailing & Lavadero
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
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
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-semibold text-slate-200 transition-all cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden md:inline">Consultas:</span>
              <span className="text-white">+54 9 260 465-4255</span>
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
              <span className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-[#009EE3]/20 text-[#00c8ff] border border-[#009EE3]/30">
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
                className="w-full py-3.5 px-5 rounded-2xl bg-[#009EE3] hover:bg-[#0082c9] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#009EE3]/30 transition-all active:scale-95 cursor-pointer"
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
              <span className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
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
              Abonarás en efectivo en el lavadero al entregar tu vehículo. Hacé clic abajo para abrir WhatsApp con el resumen de tu turno y notificar al equipo:
            </p>

            <div className="space-y-2.5 pt-2">
              <a
                href={confirmedBookingData.whatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-600/25 transition-all active:scale-95 cursor-pointer"
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
                  <span className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
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
                  <span className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
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
                  <span className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
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
              className="w-full py-3.5 px-5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm transition-all cursor-pointer"
            >
              Aceptar y Continuar
            </button>
          </div>
        </div>
      )}

      {/* CONTENEDOR PRINCIPAL */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-10">
        
        {/* Cabecera Principal & Branding */}
        <header className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-slate-300 text-xs font-medium backdrop-blur-md">
            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
            <span>San Rafael, Mendoza • Turnos Online Habilitados</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white">
            AquaShine San Rafael
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
            Lavadero Artesanal, Detailing de Alta Gama & Suscripciones Mensuales. Cuidamos cada detalle de tu vehículo en San Rafael.
          </p>

          {/* Badges de Confianza Contemporáneos */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-900/60 border border-white/[0.08] text-xs font-medium text-slate-200 backdrop-blur-sm">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Garantía de Satisfacción</span>
            </div>
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-900/60 border border-[#009EE3]/30 text-xs font-medium text-[#00c8ff] backdrop-blur-sm">
              <CreditCard className="w-3.5 h-3.5" />
              <span>Mercado Pago Oficial</span>
            </div>
          </div>
        </header>

        {/* ESTRUCTURA PRINCIPAL RESPONSIVE (7 cols Izquierda / 5 cols Derecha) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* COLUMNA IZQUIERDA (PASOS 1, 2 Y 3) */}
          <div className="lg:col-span-7 xl:col-span-7 space-y-6">
            {/* PASO 1: SELECCIÓN DE VEHÍCULO */}
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
            />

            {/* PASO 2: MODALIDAD DE SERVICIO Y PLANES */}
            <ServiceModeSelector
              vehicleType={vehicleType}
              mode={serviceMode}
              onModeChange={setServiceMode}
              selectedPlan={selectedPlan}
              onPlanChange={setSelectedPlan}
              homeDelivery={homeDelivery}
              onHomeDeliveryChange={setHomeDelivery}
              deliveryAddress={deliveryAddress}
              onDeliveryAddressChange={setDeliveryAddress}
            />

            {/* PASO 3: FECHA Y TURNO HORARIO */}
            <CalendarSlotPicker
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              selectedSlot={selectedSlot}
              onSlotChange={setSelectedSlot}
            />

            {/* Badges de descarga en Desktop */}
            <div className="hidden lg:block pt-2">
              <AppDownloadBadges
                placement="hero"
                onSimulateClick={(store) =>
                  showToast(
                    'App Oficial',
                    `Próximamente disponible para descargar en ${store}.`,
                    'info'
                  )
                }
              />
            </div>
          </div>

          {/* COLUMNA DERECHA (PASO 4: DATOS, MÉTODO DE PAGO Y RESUMEN FINAL) */}
          <div className="lg:col-span-5 xl:col-span-5 space-y-6 lg:sticky lg:top-24">
            {/* PASO 4: DATOS DE CONTACTO Y SELECTOR DE PAGO */}
            <PaymentMethodSelector
              paymentMethod={paymentMethod}
              onPaymentMethodChange={setPaymentMethod}
              userEmail={userEmail}
              onEmailChange={setUserEmail}
              fullName={fullName}
              onFullNameChange={setFullName}
              phone={phone}
              onPhoneChange={setPhone}
              notes={notes}
              onNotesChange={setNotes}
            />

            {/* TARJETA RESUMEN DE RESERVA EN VIVO */}
            <section className="rounded-3xl bg-slate-900/60 backdrop-blur-2xl border border-cyan-500/30 p-6 sm:p-7 shadow-2xl shadow-cyan-950/20 space-y-5">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400">
                    Confirmación
                  </span>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Resumen de tu Reserva
                  </h3>
                </div>
                <span className="text-[11px] px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-300 font-bold border border-cyan-500/20">
                  En Tiempo Real
                </span>
              </div>

              {/* Detalle itemizado */}
              <div className="space-y-3.5 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Vehículo:</span>
                  <span className="font-bold text-white text-right">
                    {vehicleSummaryDisplay}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Modalidad:</span>
                  <span className="font-bold text-cyan-400 text-right">
                    {serviceMode === 'INDIVIDUAL'
                      ? 'Lavado Completo Individual'
                      : `Suscripción Mensual ${selectedPlan}`}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Fecha y Horario:</span>
                  <span className="font-bold text-white text-right">
                    {selectedSlot
                      ? `${selectedDate} (${selectedSlot.startTime} a ${selectedSlot.endTime} hs)`
                      : '⚠️ Seleccioná un horario'}
                  </span>
                </div>

                {homeDelivery && deliveryAddress && (
                  <div className="flex justify-between items-start text-slate-300 pt-1">
                    <span className="text-slate-400">Retiro / Entrega:</span>
                    <span className="font-semibold text-slate-200 text-right max-w-[200px] truncate">
                      {deliveryAddress}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Forma de Pago:</span>
                  <span
                    className={`font-bold text-right ${
                      paymentMethod === 'MERCADO_PAGO'
                        ? 'text-[#00c8ff]'
                        : 'text-emerald-400'
                    }`}
                  >
                    {paymentMethod === 'MERCADO_PAGO'
                      ? 'Mercado Pago (Online)'
                      : 'Efectivo en Recepción'}
                  </span>
                </div>
              </div>

              {/* Total Destacado */}
              <div className="pt-4 border-t border-white/[0.06] flex justify-between items-end">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Monto Total
                  </span>
                  <span className="text-xs text-slate-400 font-medium">IVA incluido</span>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-black text-white tracking-tight">
                    ${currentTotal.toLocaleString('es-AR')}
                  </div>
                  <span className="text-[10px] font-bold text-cyan-400 tracking-wider">
                    PESOS ARGENTINOS (ARS)
                  </span>
                </div>
              </div>

              {/* BOTÓN DE ACCIÓN DINÁMICO */}
              {paymentMethod === 'MERCADO_PAGO' ? (
                <div className="space-y-2.5 pt-1">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleSubmitBooking}
                    className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#009EE3] to-[#007ebb] hover:from-[#00a8f3] hover:to-[#008ecb] text-white font-extrabold text-sm sm:text-base tracking-wide shadow-xl shadow-[#009EE3]/25 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 group cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Conectando con Mercado Pago...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5" />
                        <span>Pagar con Mercado Pago • ${currentTotal.toLocaleString('es-AR')}</span>
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-center text-slate-400 leading-tight">
                    🔒 Serás redirigido al checkout oficial de <strong>Mercado Pago</strong> para completar tu pago de forma segura.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 pt-1">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleSubmitBooking}
                    className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm sm:text-base tracking-wide shadow-xl shadow-emerald-600/25 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2.5 cursor-pointer"
                  >
                    {submitting ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Confirmar Turno y Notificar por WhatsApp</span>
                        <MessageCircle className="w-5 h-5" />
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-center text-slate-400 leading-tight">
                    💵 Abonás presencialmente en recepción al entregar tu vehículo. Se abrirá WhatsApp con el detalle de la reserva.
                  </p>
                </div>
              )}

              {/* Sellos de Seguridad Contemporáneos */}
              <div className="pt-2 border-t border-white/[0.06] grid grid-cols-2 gap-2 text-[10px] text-slate-400 text-center">
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/[0.06] flex items-center justify-center gap-1.5 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Reserva Inmediata</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/[0.06] flex items-center justify-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Atención Garantizada</span>
                </div>
              </div>
            </section>

            {/* Badges de descarga en móvil */}
            <div className="block lg:hidden">
              <AppDownloadBadges
                placement="hero"
                onSimulateClick={(store) =>
                  showToast(
                    'App Oficial',
                    `Próximamente disponible para descargar en ${store}.`,
                    'info'
                  )
                }
              />
            </div>
          </div>
        </div>

        {/* PIE DE PÁGINA CONTEMPORÁNEO */}
        <footer className="pt-12 mt-12 border-t border-white/[0.06] text-center space-y-4">
          <div className="max-w-xl mx-auto space-y-2">
            <h4 className="text-sm font-bold text-white tracking-tight">
              AquaShine Lavadero & Detailing
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
