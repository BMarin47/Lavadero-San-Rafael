'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import {
  Droplets,
  Printer,
  Download,
  Copy,
  Check,
  ExternalLink,
  Smartphone,
  Sparkles,
  CalendarCheck,
  MapPin,
} from 'lucide-react';
import { BRAND_CONFIG } from '@/lib/config';

const TARGET_BOOKING_URL = `${BRAND_CONFIG.siteUrl}/`;

export default function QRPage() {
  const [copied, setCopied] = useState(false);
  const qrWrapperRef = useRef<HTMLDivElement>(null);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(TARGET_BOOKING_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback silencioso
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleDownloadSVG = () => {
    const svgEl = qrWrapperRef.current?.querySelector('svg');
    if (!svgEl) return;

    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgEl);
    if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'qr-lavadero-san-rafael.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen relative bg-[#06090f] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-8 overflow-x-hidden selection:bg-cyan-500 selection:text-slate-950 print:bg-white print:text-slate-950 print:p-0 print:min-h-0">
      {/* Glow ambiental (oculto en impresión) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 print:hidden">
        <div className="absolute top-[-10%] left-[15%] w-[480px] h-[480px] bg-cyan-500/15 rounded-full blur-[130px]" />
        <div className="absolute bottom-[-10%] right-[15%] w-[480px] h-[480px] bg-emerald-500/10 rounded-full blur-[130px]" />
      </div>

      {/* Contenedor Principal Centrado */}
      <div className="relative z-10 w-full max-w-md mx-auto flex flex-col items-center">
        {/* Tarjeta del QR (Optimizada para Móvil e Impresión) */}
        <section className="w-full rounded-3xl bg-slate-900/85 backdrop-blur-2xl border border-white/[0.12] shadow-2xl shadow-cyan-950/50 p-6 sm:p-9 flex flex-col items-center text-center print:bg-white print:border-2 print:border-slate-900 print:shadow-none print:rounded-2xl print:p-8 print:max-w-sm">
          {/* Logo e Identidad del Lavadero San Rafael */}
          <div className="flex flex-col items-center gap-2.5 mb-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-400 via-sky-500 to-blue-600 flex items-center justify-center text-slate-950 shadow-lg shadow-cyan-500/30 print:border print:border-slate-900 print:shadow-none">
              <Droplets className="w-7 h-7 stroke-[2.5]" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 text-[10px] font-extrabold uppercase tracking-widest mb-1.5 print:bg-slate-100 print:text-slate-800 print:border-slate-300">
                <Sparkles className="w-3 h-3" />
                <span>Turnos Online</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white print:text-slate-950">
                Lavadero San Rafael
              </h1>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5 print:text-slate-600">
                Detailing &amp; Lavado Vehicular
              </p>
            </div>
          </div>

          {/* Llamado a la acción principal */}
          <div className="mb-5 space-y-1">
            <h2 className="text-lg sm:text-xl font-extrabold text-cyan-400 print:text-slate-900">
              Escaneá para agendar tu turno
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xs mx-auto leading-relaxed print:text-slate-700">
              Apuntá la cámara de tu celular al código QR para elegir día, horario y categoría de vehículo en segundos.
            </p>
          </div>

          {/* Marco del Código QR de Alto Contraste */}
          <div
            ref={qrWrapperRef}
            className="relative p-5 sm:p-6 rounded-3xl bg-white shadow-xl shadow-cyan-500/10 border-4 border-cyan-400/80 flex items-center justify-center transition-transform hover:scale-[1.01] print:border-2 print:border-slate-900 print:shadow-none"
          >
            <QRCodeSVG
              value={TARGET_BOOKING_URL}
              size={230}
              bgColor="#ffffff"
              fgColor="#06090f"
              level="H"
              includeMargin={false}
              className="w-[210px] h-[210px] sm:w-[235px] sm:h-[235px]"
            />
          </div>

          {/* Pasos rápidos */}
          <div className="w-full grid grid-cols-3 gap-2 mt-6 pt-5 border-t border-white/[0.08] text-center print:border-slate-200">
            <div className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/[0.03] print:bg-slate-50">
              <Smartphone className="w-4 h-4 text-cyan-400 print:text-slate-900" />
              <span className="text-[11px] font-bold text-slate-200 print:text-slate-900">
                1. Escaneá
              </span>
              <span className="text-[10px] text-slate-400 leading-tight print:text-slate-600">
                Con tu cámara
              </span>
            </div>

            <div className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/[0.03] print:bg-slate-50">
              <CalendarCheck className="w-4 h-4 text-emerald-400 print:text-slate-900" />
              <span className="text-[11px] font-bold text-slate-200 print:text-slate-900">
                2. Elegí turno
              </span>
              <span className="text-[10px] text-slate-400 leading-tight print:text-slate-600">
                Día y horario
              </span>
            </div>

            <div className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/[0.03] print:bg-slate-50">
              <Sparkles className="w-4 h-4 text-sky-400 print:text-slate-900" />
              <span className="text-[11px] font-bold text-slate-200 print:text-slate-900">
                3. ¡Listo!
              </span>
              <span className="text-[10px] text-slate-400 leading-tight print:text-slate-600">
                Confirmación inmediata
              </span>
            </div>
          </div>

          {/* URL explícita al pie del cartel */}
          <div className="mt-5 pt-4 border-t border-white/[0.06] w-full flex flex-col items-center gap-1 print:border-slate-200">
            <span className="text-[11px] font-mono font-bold text-cyan-300 tracking-tight print:text-slate-900">
              {BRAND_CONFIG.domain}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 print:text-slate-600">
              <MapPin className="w-3 h-3 text-cyan-400 print:text-slate-800" />
              {BRAND_CONFIG.fullLocation}
            </span>
          </div>
        </section>

        {/* Controles Interactivos (Ocultos al imprimir) */}
        <div className="w-full mt-5 flex flex-col gap-2.5 print:hidden">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/[0.1] text-xs font-bold text-slate-200 transition-all cursor-pointer active:scale-95"
            >
              <Printer className="w-3.5 h-3.5 text-cyan-400" />
              <span>Imprimir</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadSVG}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/[0.1] text-xs font-bold text-slate-200 transition-all cursor-pointer active:scale-95"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Descargar</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/[0.1] text-xs font-bold text-slate-200 transition-all cursor-pointer active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-sky-400" />
                  <span>Copiar link</span>
                </>
              )}
            </button>
          </div>

          <Link
            href="/"
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all active:scale-98"
          >
            <span>Ir a la plataforma de turnos</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </main>
  );
}
