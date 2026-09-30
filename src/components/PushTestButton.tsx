'use client';

import React, { useState } from 'react';
import { Bell, BellRing, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

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

interface PushTestButtonProps {
  className?: string;
  variant?: 'compact' | 'full';
}

export function PushTestButton({
  className = '',
  variant = 'compact',
}: PushTestButtonProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');

  const handleTestPush = async () => {
    if (loading) return;

    try {
      setLoading(true);
      setStatus('idle');
      setStatusMessage('');

      if (typeof window === 'undefined') return;

      // 1. Verificar soporte básico en navegador
      if (!('Notification' in window)) {
        throw new Error('Tu navegador o dispositivo no soporta Notificaciones.');
      }

      // 2. Manejo previo del estado de permisos (Notification.permission)
      let permission = Notification.permission;

      // Si es "denied": Mensaje amigable inmediato
      if (permission === 'denied') {
        setStatus('error');
        setStatusMessage(
          'Las notificaciones están bloqueadas. Toca el ícono del candado en la barra de direcciones de tu navegador para permitirlas.'
        );
        setTimeout(() => {
          setStatus('idle');
          setStatusMessage('');
        }, 8000);
        return;
      }

      // Si es "default": Invocar Notification.requestPermission()
      if (permission === 'default') {
        permission = await Notification.requestPermission();

        if (permission === 'denied') {
          setStatus('error');
          setStatusMessage(
            'Las notificaciones están bloqueadas. Toca el ícono del candado en la barra de direcciones de tu navegador para permitirlas.'
          );
          setTimeout(() => {
            setStatus('idle');
            setStatusMessage('');
          }, 8000);
          return;
        }

        if (permission !== 'granted') {
          setStatus('idle');
          setStatusMessage('');
          return;
        }
      }

      // Si no es "granted", salir limpiamente
      if (permission !== 'granted') {
        return;
      }

      // 3. Verificar soporte de Service Worker y PushManager
      if (!('serviceWorker' in navigator)) {
        throw new Error('Tu navegador no tiene soporte para Service Workers.');
      }

      if (!('PushManager' in window)) {
        throw new Error(
          'Tu navegador o dispositivo no soporta Web Push. En iOS (iPhone), recordá instalar la App en la pantalla de inicio desde el menú Compartir.'
        );
      }

      // 4. Asegurar registro y esperar estrictamente a que el Service Worker esté activo ("ready")
      await navigator.serviceWorker.register('/sw.js');
      const registration = await navigator.serviceWorker.ready;

      if (!registration || !registration.pushManager) {
        throw new Error('El Service Worker activo no tiene disponible el pushManager.');
      }

      // 5. Obtener o crear la suscripción Push con la clave VAPID pública
      const vapidPublicKey =
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
        'BDarrysWFc8TK5jxp21cBP9AuX05ssBPoUIRK4z-5TI69HpyM4-Ua3bNBVhI6lbcvrb-NfAKhhXgfSu3XWrL7t4';

      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      // 5. Llamar a la API de prueba enviando la suscripción
      const response = await fetch('/api/test-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Error al disparar la notificación Push.');
      }

      setStatus('success');
      setStatusMessage('¡Notificación enviada! Revisá tu barra de notificaciones.');

      setTimeout(() => {
        setStatus('idle');
        setStatusMessage('');
      }, 6000);
    } catch (err: any) {
      console.error('[Push Test Error]:', err);
      setStatus('error');
      setStatusMessage(err.message || 'No se pudo enviar la notificación.');
      setTimeout(() => {
        setStatus('idle');
      }, 7000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`relative inline-flex flex-col items-center ${className}`}>
      <button
        type="button"
        onClick={handleTestPush}
        disabled={loading}
        title="Enviar una notificación push de prueba a este dispositivo"
        className={`inline-flex items-center justify-center gap-2 rounded-2xl font-black transition-all duration-300 active:scale-95 cursor-pointer shadow-lg disabled:opacity-60 ${
          status === 'success'
            ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
            : status === 'error'
            ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/20'
            : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-cyan-500/25'
        } ${
          variant === 'full'
            ? 'w-full py-3.5 px-5 text-sm'
            : 'py-2.5 px-4 text-xs'
        }`}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
            <span>Enviando prueba...</span>
          </>
        ) : status === 'success' ? (
          <>
            <CheckCircle className="w-4 h-4 text-slate-950" />
            <span>¡Notificación Enviada!</span>
          </>
        ) : status === 'error' ? (
          <>
            <AlertCircle className="w-4 h-4 text-white" />
            <span>Reintentar Prueba</span>
          </>
        ) : (
          <>
            <BellRing className="w-4 h-4 text-slate-950 animate-bounce" />
            <span>Probar Notificación Push</span>
          </>
        )}
      </button>

      {/* Mensaje de estado flotante / feedback */}
      {statusMessage && (
        <div
          className={`absolute top-full mt-2 z-50 px-3 py-1.5 rounded-xl text-[11px] font-bold shadow-xl border backdrop-blur-md max-w-xs text-center transition-all ${
            status === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/30'
              : 'bg-rose-950/90 text-rose-200 border-rose-500/30'
          }`}
        >
          {statusMessage}
        </div>
      )}
    </div>
  );
}
export default PushTestButton;
