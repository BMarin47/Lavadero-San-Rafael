'use client';

import React, { useEffect, useState } from 'react';
import { Download, Smartphone, X, Check } from 'lucide-react';

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Registrar el Service Worker automáticamente
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('[PWA]: Service Worker registrado con éxito en scope:', registration.scope);
          })
          .catch((error) => {
            console.warn('[PWA]: Fallo al registrar el Service Worker:', error);
          });
      });
    }

    // 2. Comprobar si ya está instalada o en modo standalone
    if (
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true)
    ) {
      setIsInstalled(true);
      return;
    }

    // 3. Capturar el evento beforeinstallprompt de navegadores compatibles
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // No mostrar si el usuario ya lo cerró en esta sesión
      const dismissed = sessionStorage.getItem('pwa_banner_dismissed');
      if (!dismissed) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Evento de instalación completada
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowBanner(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Si no hay evento diferido (ej. Safari en iOS), dar instrucciones amigables
      alert('Para instalar en iOS: tocá el botón "Compartir" de Safari y seleccioná "Agregar a pantalla de inicio".');
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'approved') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    sessionStorage.setItem('pwa_banner_dismissed', 'true');
  };

  if (isInstalled || !showBanner) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-in slide-in-from-bottom duration-300">
      <div className="bg-[#0b1220]/95 border border-cyan-500/40 rounded-3xl p-4 sm:p-5 shadow-2xl backdrop-blur-xl flex items-center gap-3.5 ring-1 ring-cyan-500/20">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/30 text-slate-950">
          <Smartphone className="w-6 h-6 stroke-[2.2]" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-xs sm:text-sm font-black text-white truncate">
              Instalá la App de AquaShine
            </h4>
            <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              PWA
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
            Accedé a tus turnos directo desde la pantalla de inicio de tu celular.
          </p>

          <div className="flex items-center gap-2.5 mt-2.5">
            <button
              type="button"
              onClick={handleInstallClick}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Instalar App</span>
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className="text-[11px] text-slate-400 hover:text-white font-medium px-2 py-1 transition-colors cursor-pointer"
            >
              Ahora no
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.08] transition-colors shrink-0"
          aria-label="Cerrar aviso"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
