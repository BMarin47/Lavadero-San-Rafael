'use client';

import React from 'react';

export type PaymentMethod = 'MERCADO_PAGO' | 'CASH';

interface PaymentMethodSelectorProps {
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  userEmail: string;
  onEmailChange: (email: string) => void;
  fullName: string;
  onFullNameChange: (name: string) => void;
  phone: string;
  onPhoneChange: (phone: string) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
}

export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  paymentMethod,
  onPaymentMethodChange,
  userEmail,
  onEmailChange,
  fullName,
  onFullNameChange,
  phone,
  onPhoneChange,
  notes,
  onNotesChange,
}) => {
  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 p-5 md:p-6 rounded-3xl shadow-xl shadow-black/20 space-y-5 transition-all">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <h2 className="text-xs md:text-sm font-extrabold uppercase tracking-wider text-slate-100 flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 text-white flex items-center justify-center text-xs font-black shadow-md shadow-blue-500/30">
            4
          </span>
          Datos de Contacto y Pago
        </h2>
        <span className="text-[11px] text-cyan-400 font-bold bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
          Paso 4 de 4
        </span>
      </div>

      {/* Datos del Cliente: Inicializados estrictamente vacíos sin datos simulados */}
      <div className="space-y-3">
        <div>
          <label className="text-[11px] text-slate-300 font-bold uppercase tracking-wider block">
            Nombre y Apellido *
          </label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => onFullNameChange(e.target.value)}
            placeholder="Ej: Juan Pérez"
            className="w-full mt-1.5 px-4 py-3 text-xs sm:text-sm rounded-2xl bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all shadow-inner"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-slate-300 font-bold uppercase tracking-wider block">
              Correo Electrónico *
            </label>
            <input
              type="email"
              required
              value={userEmail}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="juan.perez@ejemplo.com"
              className="w-full mt-1.5 px-4 py-3 text-xs sm:text-sm rounded-2xl bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all shadow-inner"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-300 font-bold uppercase tracking-wider block">
              Teléfono Celular (WhatsApp) *
            </label>
            <div className="mt-1.5 flex rounded-2xl bg-slate-950/80 border border-slate-800 focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/20 transition-all overflow-hidden shadow-inner">
              <span className="inline-flex items-center px-3.5 bg-slate-900 border-r border-slate-800 text-xs font-black text-cyan-400 select-none whitespace-nowrap">
                +54 9
              </span>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => {
                  let val = e.target.value;
                  val = val.replace(/^(\+?54\s*9?|\+?54)\s*/, '');
                  onPhoneChange(val);
                }}
                placeholder="260 412-3456"
                className="w-full min-w-0 px-3.5 py-3 text-xs sm:text-sm bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="text-[11px] text-slate-300 font-bold uppercase tracking-wider block">
            Indicaciones Especiales (Opcional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Ej: Cuidado con espejo lateral derecho, retirar a las 18 hs"
            className="w-full mt-1.5 px-4 py-3 text-xs sm:text-sm rounded-2xl bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all shadow-inner"
          />
        </div>
      </div>

      {/* Selector de Método de Pago */}
      <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
        <label className="text-xs text-slate-200 font-bold uppercase tracking-wider block">
          Elegí cómo abonar:
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Mercado Pago */}
          <button
            type="button"
            onClick={() => onPaymentMethodChange('MERCADO_PAGO')}
            className={`p-4 rounded-2xl border text-left transition-all duration-200 relative group ${
              paymentMethod === 'MERCADO_PAGO'
                ? 'border-[#009EE3] bg-gradient-to-b from-[#009EE3]/20 via-[#009EE3]/10 to-slate-950/80 ring-2 ring-[#009EE3]/40 shadow-xl shadow-[#009EE3]/20 scale-[1.02]'
                : 'border-slate-800/80 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-900/60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-[#009EE3]/20 border border-[#009EE3]/40 flex items-center justify-center text-lg">
                💳
              </div>
              <span
                className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${
                  paymentMethod === 'MERCADO_PAGO'
                    ? 'bg-[#009EE3] text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {paymentMethod === 'MERCADO_PAGO' ? '✓ Elegido' : 'Online'}
              </span>
            </div>
            <div className="text-sm font-black text-[#00c8ff] group-hover:text-cyan-300 transition-colors">
              Mercado Pago
            </div>
            <div className="text-[11px] text-slate-300 mt-1 leading-snug">
              Débito, Crédito, Dinero en cuenta y Cuotas
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-cyan-400/90 font-medium">
              <span>⚡</span> Redirección oficial automática
            </div>
          </button>

          {/* Efectivo */}
          <button
            type="button"
            onClick={() => onPaymentMethodChange('CASH')}
            className={`p-4 rounded-2xl border text-left transition-all duration-200 relative group ${
              paymentMethod === 'CASH'
                ? 'border-emerald-500 bg-gradient-to-b from-emerald-600/20 via-emerald-600/10 to-slate-950/80 ring-2 ring-emerald-500/40 shadow-xl shadow-emerald-500/20 scale-[1.02]'
                : 'border-slate-800/80 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-900/60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-lg">
                💵
              </div>
              <span
                className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${
                  paymentMethod === 'CASH'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {paymentMethod === 'CASH' ? '✓ Elegido' : 'En Taller'}
              </span>
            </div>
            <div className="text-sm font-black text-emerald-400 group-hover:text-emerald-300 transition-colors">
              Efectivo en Lavadero
            </div>
            <div className="text-[11px] text-slate-300 mt-1 leading-snug">
              Abonás presencialmente al entregar el vehículo
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-400/90 font-medium">
              <span>💬</span> Notificación directa por WhatsApp
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
