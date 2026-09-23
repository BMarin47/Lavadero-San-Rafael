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

  // Campos de contacto inicializados completamente vacíos
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
    icon: string;
  } | null>(null);

  const showToast = (title: string, msg: string, icon = '✨') => {
    setToastMessage({ title, msg, icon });
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
      showToast('Marca requerida', 'Por favor seleccioná o ingresá la marca de tu vehículo.', '🚗');
      return;
    }

    if (!effectiveModel) {
      showToast('Modelo requerido', 'Por favor seleccioná o escribí el modelo de tu auto.', '🚗');
      return;
    }

    if (!selectedDate || !selectedSlot) {
      showToast('Horario requerido', 'Por favor seleccioná un bloque horario disponible en el calendario.', '⚠️');
      return;
    }

    if (!fullName.trim()) {
      showToast('Nombre requerido', 'Por favor ingresá tu nombre y apellido.', '👤');
      return;
    }

    if (!userEmail.trim()) {
      showToast('Correo requerido', 'Por favor ingresá tu correo electrónico para el comprobante.', '✉️');
      return;
    }

    const rawPhoneDigits = phone.replace(/\D/g, '');
    if (!phone.trim() || rawPhoneDigits.length < 6) {
      showToast('Teléfono requerido', 'Por favor ingresá un número de teléfono celular válido.', '📱');
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
          '¡Pre-reserva Lista!',
          'Redirigiendo de forma segura a Mercado Pago para completar tu pago...',
          '💳'
        );

        setRedirectingToMP({
          url: mpCheckoutUrl,
          title: `${vehicleSummaryDisplay} - ${serviceMode === 'INDIVIDUAL' ? 'Lavado Individual' : `Suscripción ${selectedPlan}`}`,
          amount: currentTotal,
        });

        // Redirigir de inmediato al checkout oficial de Mercado Pago
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
        '💬'
      );
    } catch (err: any) {
      showToast('No se pudo reservar', err.message || 'Error de conexión', '❌');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen relative bg-[#070b14] text-slate-100 overflow-x-hidden selection:bg-cyan-500 selection:text-white">
      {/* Luces ambientales / Glow Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 left-1/4 w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-20 w-[450px] h-[450px] bg-cyan-500/10 rounded-full blur-[130px]" />
        <div className="absolute -bottom-20 left-1/3 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[140px]" />
      </div>

      {/* Escuchador de Retorno de Mercado Pago */}
      <Suspense fallback={null}>
        <MercadoPagoReturnHandler onStatusHandled={handleMpStatus} />
      </Suspense>

      {/* Toast Notification Flotante */}
      {toastMessage && (
        <div className="fixed top-5 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 p-4 rounded-2xl bg-slate-900/90 backdrop-blur-2xl border border-cyan-500/30 shadow-2xl flex items-center gap-3.5 animate-in fade-in slide-in-from-top-4">
          <span className="text-3xl filter drop-shadow">{toastMessage.icon}</span>
          <div className="flex-1">
            <p className="text-xs font-black uppercase tracking-wider text-cyan-400">
              {toastMessage.title}
            </p>
            <p className="text-xs text-slate-200 mt-0.5 font-medium leading-tight">
              {toastMessage.msg}
            </p>
          </div>
        </div>
      )}

      {/* MODAL 1: REDIRECCIÓN AUTOMÁTICA A MERCADO PAGO */}
      {redirectingToMP && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900/95 border border-[#009EE3]/50 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl shadow-[#009EE3]/20">
            <div className="relative mx-auto w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#009EE3] to-[#00c8ff] flex items-center justify-center shadow-xl shadow-[#009EE3]/40">
              <span className="text-4xl animate-bounce">💳</span>
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-white"></span>
              </span>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-[#009EE3]/20 text-[#00c8ff] border border-[#009EE3]/40">
                Mercado Pago Oficial
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white pt-1">
                Conectando con Mercado Pago...
              </h3>
              <p className="text-xs text-slate-300">
                Tu turno fue pre-reservado. Te estamos redirigiendo para completar el pago de forma oficial y segura.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-left space-y-1 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Concepto:</span>
                <span className="font-bold text-white">{redirectingToMP.title}</span>
              </div>
              <div className="flex justify-between text-slate-300 pt-1 border-t border-slate-800">
                <span>Total a abonar:</span>
                <span className="font-black text-cyan-400 text-sm">
                  ${redirectingToMP.amount.toLocaleString('es-AR')} ARS
                </span>
              </div>
            </div>

            <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
              <div className="bg-gradient-to-r from-[#009EE3] to-[#00c8ff] h-full rounded-full animate-pulse w-full" />
            </div>

            <div className="space-y-2 pt-2">
              <a
                href={redirectingToMP.url}
                className="w-full py-3.5 px-5 rounded-2xl bg-[#009EE3] hover:bg-[#0082c9] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#009EE3]/30 transition-all active:scale-95"
              >
                <span>Hacé clic acá si no redirige automáticamente</span>
                <span>↗</span>
              </a>

              <button
                type="button"
                onClick={() => setRedirectingToMP(null)}
                className="text-xs text-slate-500 hover:text-slate-300 pt-1 block mx-auto cursor-pointer"
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
          <div className="w-full max-w-md bg-slate-900/95 border border-emerald-500/50 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl shadow-emerald-500/20">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto text-3xl shadow-lg shadow-emerald-500/20">
              ✅
            </div>
            <div className="space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
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
                className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-600/30 transition-all active:scale-95"
              >
                <span>💬 Abrir WhatsApp con Resumen</span>
              </a>

              <button
                type="button"
                onClick={() => setConfirmedBookingData(null)}
                className="text-xs text-slate-500 hover:text-slate-300 pt-1 block mx-auto cursor-pointer"
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
          <div className="w-full max-w-md bg-slate-900/95 border border-slate-700 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl">
            {mpReturnResult.status === 'approved' ? (
              <>
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto text-3xl shadow-lg shadow-emerald-500/20">
                  🎉
                </div>
                <div className="space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Pago Aprobado
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    ¡Pago Confirmado por Mercado Pago!
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Tu pago fue acreditado correctamente. El box asignado para tu vehículo está asegurado. ¡Te esperamos en el lavadero!
                  </p>
                </div>
              </>
            ) : mpReturnResult.status === 'pending' ? (
              <>
                <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto text-3xl">
                  ⏳
                </div>
                <div className="space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
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
                <div className="w-16 h-16 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto text-3xl">
                  ❌
                </div>
                <div className="space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
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

      {/* CONTENEDOR PRINCIPAL: RESPONSIVE COMPLETO PARA PC Y CELULARES */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-8">
        
        {/* Cabecera Principal & Branding */}
        <header className="text-center space-y-3 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-extrabold shadow-lg shadow-cyan-500/10 backdrop-blur-md">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            San Rafael, Mendoza • Turnos Online Habilitados
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white">
            AquaShine <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">San Rafael</span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto font-medium leading-relaxed">
            Lavadero Artesanal, Detailing & Suscripciones Mensuales con capacidad simultánea de 3 boxes de atención.
          </p>

          {/* Badges de Confianza */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 pt-2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-semibold text-slate-300">
              <span>⚡</span> 3 Boxes Simultáneos
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-semibold text-slate-300">
              <span>🛡️</span> Sin Patente Requerida
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900/80 border border-[#009EE3]/30 text-xs font-semibold text-[#00c8ff]">
              <span>💳</span> Mercado Pago Oficial
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-semibold text-slate-300">
              <span>📍</span> San Rafael, Mza
            </div>
          </div>
        </header>

        {/* ESTRUCTURA RESPONSIVE: 2 COLUMNAS EN PC (LG:GRID-COLS-12) / 1 COLUMNA EN CELULARES */}
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

            {/* Badges de descarga de App para desktop (en columna izquierda) */}
            <div className="hidden lg:block pt-2">
              <AppDownloadBadges
                placement="hero"
                onSimulateClick={(store) =>
                  showToast(
                    'App Oficial',
                    `Próximamente disponible para descargar en ${store}.`,
                    '📱'
                  )
                }
              />
            </div>
          </div>

          {/* COLUMNA DERECHA (PASO 4: DATOS, MÉTODO DE PAGO Y RESUMEN FINAL CON BOTÓN MERCADO PAGO) */}
          <div className="lg:col-span-5 xl:col-span-5 space-y-6 lg:sticky lg:top-6">
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

            {/* TARJETA RESUMEN DE RESERVA EN VIVO & BOTÓN DE CONFIRMACIÓN */}
            <section className="p-6 rounded-3xl bg-gradient-to-b from-slate-900/90 via-slate-950/90 to-slate-900/90 backdrop-blur-2xl border border-cyan-500/30 shadow-2xl shadow-cyan-950/20 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400">
                    Paso Final
                  </span>
                  <h3 className="text-base font-black text-white">
                    Resumen de tu Turno
                  </h3>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-300 font-bold border border-cyan-500/30">
                  En Vivo
                </span>
              </div>

              {/* Detalle itemizado */}
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Vehículo:</span>
                  <span className="font-extrabold text-white text-right">
                    {vehicleSummaryDisplay}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Servicio:</span>
                  <span className="font-extrabold text-cyan-400 text-right">
                    {serviceMode === 'INDIVIDUAL'
                      ? 'Lavado Completo Individual'
                      : `Suscripción Mensual ${selectedPlan}`}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Fecha y Horario:</span>
                  <span className="font-extrabold text-white text-right">
                    {selectedSlot
                      ? `${selectedDate} (${selectedSlot.startTime} a ${selectedSlot.endTime} hs)`
                      : '⚠️ Seleccioná un turno'}
                  </span>
                </div>

                {homeDelivery && deliveryAddress && (
                  <div className="flex justify-between items-start text-slate-300 pt-1">
                    <span className="text-slate-400">Retiro:</span>
                    <span className="font-semibold text-slate-200 text-right max-w-[200px] truncate">
                      {deliveryAddress}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Método de Pago:</span>
                  <span
                    className={`font-black text-right ${
                      paymentMethod === 'MERCADO_PAGO'
                        ? 'text-[#00c8ff]'
                        : 'text-emerald-400'
                    }`}
                  >
                    {paymentMethod === 'MERCADO_PAGO'
                      ? '💳 Mercado Pago (Online)'
                      : '💵 Efectivo en Taller'}
                  </span>
                </div>
              </div>

              {/* Total Destacado */}
              <div className="pt-3 border-t border-slate-800/80 flex justify-between items-end">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Monto Total a Abonar
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

              {/* BOTÓN DE ACCIÓN DINÁMICO SEGÚN MÉTODO DE PAGO */}
              {paymentMethod === 'MERCADO_PAGO' ? (
                /* BOTÓN DE MERCADO PAGO */
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleSubmitBooking}
                    className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#009EE3] to-[#007ebb] hover:from-[#00a8f3] hover:to-[#008ecb] text-white font-black text-sm sm:text-base tracking-wide shadow-xl shadow-[#009EE3]/30 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 group cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Conectando con Mercado Pago...</span>
                      </>
                    ) : (
                      <>
                        <span className="text-xl">💳</span>
                        <span>Pagar con Mercado Pago • ${currentTotal.toLocaleString('es-AR')}</span>
                        <span className="text-lg transition-transform group-hover:translate-x-1">→</span>
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-center text-slate-400 leading-tight">
                    🔒 Serás redirigido a la página oficial de <strong>Mercado Pago</strong> para completar tu abono de forma segura.
                  </p>
                </div>
              ) : (
                /* BOTÓN DE EFECTIVO */
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleSubmitBooking}
                    className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm sm:text-base tracking-wide shadow-xl shadow-emerald-600/30 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 cursor-pointer"
                  >
                    {submitting ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Confirmar Turno y Notificar por WhatsApp</span>
                        <span className="text-xl">💬</span>
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-center text-slate-400 leading-tight">
                    💵 Abonás en el taller al entregar tu vehículo. Se abrirá WhatsApp con el detalle del turno.
                  </p>
                </div>
              )}

              {/* Sellos de Seguridad */}
              <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[10px] text-slate-400 text-center">
                <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                  🛡️ Sin solicitud de patente
                </div>
                <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                  ⚡ 3 boxes simultáneos
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
                    '📱'
                  )
                }
              />
            </div>
          </div>
        </div>

        {/* PIE DE PÁGINA */}
        <footer className="pt-12 mt-12 border-t border-slate-800/80 text-center space-y-4">
          <div className="max-w-xl mx-auto space-y-1.5">
            <h4 className="text-sm font-black text-white">
              AquaShine Lavadero & Detailing
            </h4>
            <p className="text-xs text-slate-400">
              San Rafael, Mendoza, Argentina • Atención: +54 9 260 412-3456
            </p>
            <p className="text-[11px] text-slate-500">
              Horarios de Atención: Lunes a Viernes de 09:00 a 13:00 y 16:00 a 21:00 hs • Sábados de 09:00 a 13:00 hs • Domingos cerrado
            </p>
          </div>

          <p className="text-[11px] text-slate-600">
            © 2026 AquaShine San Rafael. Diseñado con Glassmorphism & Google Antigravity.
          </p>
        </footer>

      </div>
    </main>
  );
}
