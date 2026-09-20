'use client';

import React, { useState } from 'react';
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
  const todayStr = React.useMemo(() => {
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

  // CRÍTICO: Campos de contacto inicializados completamente vacíos sin datos simulados
  const [fullName, setFullName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Estado del Pago
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('MERCADO_PAGO');

  // Estado de Envío / Modal de Confirmación
  const [submitting, setSubmitting] = useState(false);
  const [confirmedBookingData, setConfirmedBookingData] = useState<{
    whatsAppUrl: string;
    mpCheckoutUrl: string | null;
    paymentMethod: PaymentMethod;
    summaryText: string;
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
  const currentTotal = React.useMemo(() => {
    if (serviceMode === 'INDIVIDUAL') {
      return VEHICLE_CONFIG[vehicleType].price;
    }
    const plan = PLANS_CATALOG.find((p) => p.code === selectedPlan);
    return plan ? plan.prices[vehicleType].price : 38000;
  }, [serviceMode, vehicleType, selectedPlan]);

  // Manejador de Reserva
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
      showToast('Teléfono requerido', 'Por favor ingresá un número de teléfono válido para WhatsApp.', '📱');
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
        // Garantizar con regex que el número en el enlace wa.me sea únicamente un string continuo de dígitos numéricos (ej: 5492604614537)
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

      setConfirmedBookingData({
        whatsAppUrl,
        mpCheckoutUrl,
        paymentMethod,
        summaryText: `${selectedDate} de ${selectedSlot.startTime} a ${selectedSlot.endTime} hs • ${vehicleSummaryDisplay}`,
      });

      if (paymentMethod === 'MERCADO_PAGO' && mpCheckoutUrl) {
        showToast(
          '¡Turno Pre-Reservado!',
          'Abriendo Mercado Pago para completar tu pago. Luego se notificará por WhatsApp.',
          '💳'
        );
        setTimeout(() => {
          window.location.href = mpCheckoutUrl;
        }, 1200);
      } else {
        showToast(
          '¡Turno Confirmado!',
          'Abriendo WhatsApp con el resumen de tu turno para notificar al lavadero...',
          '💬'
        );
        if (whatsAppUrl) {
          setTimeout(() => {
            window.location.href = whatsAppUrl;
          }, 1200);
        }
      }
    } catch (err: any) {
      showToast('No se pudo reservar', err.message || 'Error de conexión', '❌');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen pb-16 flex flex-col items-center bg-[#090d16] text-slate-100">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 p-4 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <span className="text-2xl">{toastMessage.icon}</span>
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-400">
              {toastMessage.title}
            </p>
            <p className="text-xs text-slate-200 mt-0.5 font-medium leading-tight">
              {toastMessage.msg}
            </p>
          </div>
        </div>
      )}

      {/* Modal de Confirmación y Acceso Directo a WhatsApp */}
      {confirmedBookingData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto text-3xl">
              ✅
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-white">
                ¡Turno Reservado con Éxito!
              </h3>
              <p className="text-xs text-slate-300">
                {confirmedBookingData.summaryText}
              </p>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              {confirmedBookingData.paymentMethod === 'MERCADO_PAGO'
                ? 'Completá tu pago en Mercado Pago y notificanos por WhatsApp con el botón a continuación:'
                : 'Abonarás en efectivo en el lavadero al entregar tu auto. Hacé clic abajo para abrir WhatsApp con el resumen de tu turno:'}
            </p>

            <div className="space-y-2 pt-2">
              <a
                href={confirmedBookingData.whatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
              >
                <span>💬 Abrir WhatsApp con Resumen</span>
              </a>

              {confirmedBookingData.mpCheckoutUrl && (
                <a
                  href={confirmedBookingData.mpCheckoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all"
                >
                  <span>💳 Pagar en App de Mercado Pago</span>
                </a>
              )}

              <button
                type="button"
                onClick={() => setConfirmedBookingData(null)}
                className="text-xs text-slate-500 hover:text-slate-300 pt-2 block mx-auto"
              >
                Cerrar ventana
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contenedor Mobile-First */}
      <div className="w-full max-w-md px-4 pt-6 space-y-4">
        {/* Cabecera & Branding */}
        <header className="text-center space-y-1.5 pb-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            San Rafael, Mendoza • En Vivo
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            AquaShine <span className="text-blue-500">San Rafael</span>
          </h1>
          <p className="text-xs text-slate-400">
            Lavadero Artesanal, Detailing & Suscripciones Mensuales
          </p>
        </header>

        {/* 1. OBLIGATORY HERO APP STORE & GOOGLE PLAY BADGES */}
        <AppDownloadBadges
          placement="hero"
          onSimulateClick={(store) =>
            showToast(
              'App Móvil',
              `Abriendo descarga placeholder de ${store}. ¡Próximamente en tiendas oficiales!`,
              '📱'
            )
          }
        />

        {/* Formulario de 4 Pasos: Carga en Cascada (Categoría -> Marca -> Modelo) */}
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

        <CalendarSlotPicker
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          selectedSlot={selectedSlot}
          onSlotChange={setSelectedSlot}
        />

        {/* Datos de Contacto completamente vacíos y Método de Pago */}
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

        {/* Resumen Final y Botón de Confirmación */}
        <section className="p-4 rounded-2xl bg-gradient-to-br from-blue-950 to-slate-900 border border-blue-500/40 shadow-xl space-y-3">
          <div className="flex justify-between items-end border-b border-blue-500/20 pb-2.5">
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-blue-400">
                Resumen de Reserva
              </p>
              <p className="text-xs font-bold text-slate-100">
                {serviceMode === 'INDIVIDUAL'
                  ? `Lavado Individual - ${vehicleSummaryDisplay}`
                  : `Suscripción Mensual ${selectedPlan} (${vehicleSummaryDisplay})`}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {selectedSlot
                  ? `📅 ${selectedDate} • ${selectedSlot.startTime} a ${selectedSlot.endTime} hs`
                  : '⚠️ Seleccioná un turno en el calendario'}
              </p>
            </div>

            <div className="text-right">
              <div className="text-2xl font-black text-white">
                ${currentTotal.toLocaleString('es-AR')}
              </div>
              <div className="text-[10px] font-semibold text-blue-300">
                {paymentMethod === 'MERCADO_PAGO' ? 'Mercado Pago' : 'Efectivo en Taller'}
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmitBooking}
            className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-blue-600/30 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Confirmar Reserva y Notificar por WhatsApp</span>
                <span>💬</span>
              </>
            )}
          </button>

          <p className="text-[10px] text-center text-slate-400 leading-tight">
            🛡️ Sin patente solicitada. Capacidad garantizada de hasta 3 boxes simultáneos en San Rafael, Mendoza.
          </p>
        </section>

        {/* 2. OBLIGATORY FOOTER APP STORE & GOOGLE PLAY BADGES */}
        <footer className="text-center pt-4 border-t border-slate-800 space-y-3">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-200">
              AquaShine Lavadero & Detailing
            </p>
            <p className="text-[11px] text-slate-400">
              San Rafael, Mendoza, Argentina • Tel: +54 260 4123456
            </p>
            <p className="text-[10px] text-slate-500">
              Horarios: Lun a Vie 09 a 13 y 16 a 21 hs • Sáb 09 a 13 hs • Dom Cerrado
            </p>
          </div>

          <AppDownloadBadges
            placement="footer"
            onSimulateClick={(store) =>
              showToast(
                'App Móvil',
                `Simulando redirección a ${store}. ¡Próximamente disponible!`,
                '📱'
              )
            }
          />

          <p className="text-[10px] text-slate-600 pt-2">
            © 2026 AquaShine San Rafael. Desarrollado con Google Antigravity.
          </p>
        </footer>
      </div>
    </main>
  );
}
