'use client';

import React, { useState, useEffect } from 'react';
import {
  Bell,
  BellRing,
  Smartphone,
  Share,
  PlusSquare,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  X,
  Info,
} from 'lucide-react';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushNotificationBanner() {
  const [mounted, setMounted] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    setMounted(true);

    if (typeof window === 'undefined') return;

    // 1. Detección de dispositivo iOS (iPhone / iPad)
    const userAgent = window.navigator.userAgent || '';
    const isIosDevice =
      /iPad|iPhone|iPod/.test(userAgent) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    setIsIos(isIosDevice);

    // 2. Detección de modo Standalone (PWA instalada en inicio)
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);

    // 3. Verificar estado actual de Notification permission
    if ('Notification' in window) {
      setPermission(Notification.permission);

      // Si el permiso ya está otorgado, sincronizar silenciosamente en background la suscripción
      if (Notification.permission === 'granted' && 'serviceWorker' in navigator && 'PushManager' in window) {
        syncSubscriptionSilently();
      }
    } else {
      setPermission('unsupported');
    }
  }, []);

  // Sincroniza silenciosamente el endpoint push con el user_id en la base de datos
  const syncSubscriptionSilently = async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/test-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: sub.toJSON(),
            silent: true,
          }),
        }).catch(() => {});
      }
    } catch (_) {}
  };

  // Solicitar permiso de notificaciones y suscribir
  const handleEnableNotifications = async () => {
    if (loading) return;

    try {
      setLoading(true);
      setFeedback(null);

      // Si las notificaciones están denegadas explícitamente en el navegador
      if (permission === 'denied') {
        setFeedback({
          type: 'error',
          text: 'Las notificaciones están bloqueadas en tu navegador. Para activarlas, toca el ícono de candado o configuración junto a la barra de direcciones y cambia "Notificaciones" a "Permitir".',
        });
        return;
      }

      if (!('Notification' in window)) {
        throw new Error('Tu navegador actual no admite notificaciones push.');
      }

      // 1. Solicitar permiso al usuario
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== 'granted') {
        setFeedback({
          type: 'info',
          text: 'No se activaron las notificaciones. Podés habilitarlas cuando desees para no perder los avisos de tus turnos.',
        });
        return;
      }

      // 2. Registrar Service Worker si no está listo
      if ('serviceWorker' in navigator) {
        let registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
          registration = await navigator.serviceWorker.register('/sw.js');
        }
        await navigator.serviceWorker.ready;

        // 3. Crear suscripción Web Push con la clave VAPID pública
        const vapidPublicKey =
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
          'BDarrysWFc8TK5jxp21cBP9AuX05ssBPoUIRK4z-5TI69HpyM4-Ua3bNBVhI6lbcvrb-NfAKhhXgfSu3XWrL7t4';

        const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          });
        }

        // 4. Guardar suscripción y enviar confirmación
        const response = await fetch('/api/test-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: subscription.toJSON(),
          }),
        });

        if (response.ok) {
          setFeedback({
            type: 'success',
            text: '¡Alertas activadas con éxito! Te avisaremos automáticamente 24 horas antes de cada turno programado.',
          });
        }
      }
    } catch (err: any) {
      console.error('[Enable Push Error]:', err);
      setFeedback({
        type: 'error',
        text: err.message || 'No se pudo completar la activación de notificaciones.',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!mounted || dismissed) return null;

  // =========================================================================
  // CASO 1: Dispositivo iOS (iPhone / iPad) NO instalado en pantalla de inicio
  // Apple exige agregar la PWA al inicio para habilitar notificaciones Web Push.
  // =========================================================================
  if (isIos && !isStandalone) {
    return (
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0d1627] via-slate-900 to-[#0d1627] border border-cyan-500/30 p-5 sm:p-6 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-[1px] shadow-lg shadow-cyan-500/20 shrink-0">
              <div className="w-full h-full bg-[#0a1120] rounded-[15px] flex items-center justify-center text-cyan-400">
                <Smartphone className="w-6 h-6 animate-pulse" />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-black uppercase tracking-wider">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span>Aviso para Usuarios de iPhone / Apple</span>
              </div>

              <h3 className="text-sm sm:text-base font-black text-white leading-tight">
                📱 Si usas iPhone, toca &apos;Compartir&apos; y &apos;Agregar a inicio&apos; para poder recibir los avisos de tu turno.
              </h3>

              <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                Apple requiere que instales la App en tu pantalla de inicio para habilitar las alertas y recordatorios automáticos de 24 horas:
              </p>

              {/* Pasos rápidos visuales para iOS */}
              <div className="pt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/[0.05] border border-white/[0.1] font-semibold">
                  <Share className="w-3.5 h-3.5 text-cyan-400" />
                  <span>1. Toca el botón <strong>Compartir</strong> en Safari</span>
                </span>
                <span className="text-slate-500">→</span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/[0.05] border border-white/[0.1] font-semibold">
                  <PlusSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span>2. Elige <strong>&quot;Agregar a pantalla de inicio&quot;</strong></span>
                </span>
                <span className="text-slate-500">→</span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-bold">
                  <Bell className="w-3.5 h-3.5 text-cyan-400" />
                  <span>3. ¡Listo! Recibirás los avisos de tu turno</span>
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.05] transition-colors self-start sm:self-center"
            title="Cerrar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // CASO 2: Permiso ya OTORGADO ("granted")
  // Reaseguro amigable y sutil
  // =========================================================================
  if (permission === 'granted') {
    return (
      <div className="rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-emerald-950/40 border border-emerald-500/25 p-4 shadow-lg backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-black text-white flex items-center gap-2">
              <span>Alertas Push Activas en este Dispositivo</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                ✓ Configurado
              </span>
            </p>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Te avisaremos automáticamente <strong>24 horas antes</strong> de la fecha y hora de tu turno para que no lo olvides.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors text-xs"
          title="Ocultar aviso"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // =========================================================================
  // CASO 3: Permiso en "default" (no preguntó aún) o "denied" (rechazado)
  // Mostrar Banner destacado con botón amigable solicitado
  // =========================================================================
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0c182a] via-[#091424] to-[#0c182a] border border-cyan-500/35 p-5 sm:p-6 shadow-2xl backdrop-blur-xl space-y-3">
      <div className="absolute top-0 right-0 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-500 p-[1px] shadow-lg shadow-cyan-500/20 shrink-0">
            <div className="w-full h-full bg-[#0a1222] rounded-[15px] flex items-center justify-center text-cyan-400">
              <BellRing className="w-6 h-6 animate-bounce" />
            </div>
          </div>

          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-black uppercase tracking-wider">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>Recordatorios Automáticos</span>
            </div>

            <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
              ¿Querés que te avisemos antes de tu lavado?
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
              Activá las alertas en tu teléfono o computadora para recibir un aviso automático <strong>24 horas antes</strong> de tu turno y coordinar la entrega de tu vehículo con total tranquilidad.
            </p>

            {permission === 'denied' && (
              <div className="pt-1.5 flex items-center gap-1.5 text-[11px] text-amber-300">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Permiso bloqueado anteriormente en tu navegador. Tocá el botón para ver cómo reactivarlo.</span>
              </div>
            )}
          </div>
        </div>

        {/* Botón Principal Amigable con el Texto Exacto Solicitado */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto shrink-0">
          <button
            type="button"
            onClick={handleEnableNotifications}
            disabled={loading}
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-400 via-cyan-500 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 active:scale-95 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                <span>Activando alertas...</span>
              </>
            ) : (
              <span>🔔 ¡Activa las alertas para que te avisemos 24hs antes de tu turno!</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/[0.05] transition-colors text-xs self-center"
            title="Ahora no"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mensaje de Feedback interactivo */}
      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-200'
              : feedback.type === 'error'
              ? 'bg-rose-950/80 border-rose-500/30 text-rose-200'
              : 'bg-cyan-950/80 border-cyan-500/30 text-cyan-200'
          }`}
        >
          {feedback.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
          {feedback.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />}
          {feedback.type === 'info' && <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />}
          <div className="flex-1 leading-relaxed">
            {feedback.text}
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default PushNotificationBanner;
