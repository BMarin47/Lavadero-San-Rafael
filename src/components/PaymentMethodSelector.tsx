'use client';

import React from 'react';
import { User, Mail, Phone, MessageSquare, CreditCard, Banknote, ShieldCheck } from 'lucide-react';

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
    <div className="luxury-glass rounded-3xl p-6 sm:p-8 space-y-7 transition-all duration-300">
      {/* Header del Paso */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-5">
        <div className="flex items-center gap-3.5">
          <span className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-sky-500 to-blue-600 text-slate-950 flex items-center justify-center text-sm font-black shadow-lg shadow-cyan-500/25">
            04
          </span>
          <div>
            <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
              Datos de Contacto y Pago
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Información oficial para tu comprobante y confirmación
            </p>
          </div>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-3.5 py-1.5 rounded-full border border-cyan-500/25 shadow-sm">
          Paso 4 de 4
        </span>
      </div>

      {/* Datos del Cliente */}
      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-2 flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-cyan-400" />
            <span>Nombre y Apellido *</span>
          </label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => onFullNameChange(e.target.value)}
            placeholder="Ej: Juan Pérez"
            className="w-full px-4 py-3.5 text-sm rounded-2xl bg-slate-950/80 border border-white/[0.09] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/25 transition-all duration-200 shadow-inner hover:border-white/[0.18]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-2 flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-cyan-400" />
              <span>Correo Electrónico *</span>
            </label>
            <input
              type="email"
              required
              value={userEmail}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="juan.perez@ejemplo.com"
              className="w-full px-4 py-3.5 text-sm rounded-2xl bg-slate-950/80 border border-white/[0.09] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/25 transition-all duration-200 shadow-inner hover:border-white/[0.18]"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-2 flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-cyan-400" />
              <span>WhatsApp / Celular *</span>
            </label>
            <div className="flex rounded-2xl bg-slate-950/80 border border-white/[0.09] focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-500/25 transition-all duration-200 overflow-hidden shadow-inner hover:border-white/[0.18]">
              <span className="inline-flex items-center px-4 bg-white/[0.04] border-r border-white/[0.08] text-xs font-extrabold text-cyan-400 select-none whitespace-nowrap">
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
                placeholder="260 465-4255"
                className="w-full min-w-0 px-4 py-3.5 text-sm bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-2 flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
            <span>Indicaciones Especiales (Opcional)</span>
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Ej: Cuidado con espejo lateral, retirar por la tarde"
            className="w-full px-4 py-3.5 text-sm rounded-2xl bg-slate-950/80 border border-white/[0.09] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/25 transition-all duration-200 shadow-inner hover:border-white/[0.18]"
          />
        </div>
      </div>

      {/* Selector de Método de Pago */}
      <div className="pt-3 border-t border-white/[0.07] space-y-3.5">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
          Forma de Pago
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Mercado Pago */}
          <button
            type="button"
            onClick={() => onPaymentMethodChange('MERCADO_PAGO')}
            className={`p-5 rounded-2xl border text-left transition-all duration-300 relative group cursor-pointer ${
              paymentMethod === 'MERCADO_PAGO'
                ? 'border-[#009EE3] bg-gradient-to-b from-[#009EE3]/25 via-[#009EE3]/10 to-slate-950/85 ring-1 ring-[#009EE3]/60 shadow-xl shadow-[#009EE3]/20 scale-[1.02]'
                : 'border-white/[0.08] bg-slate-950/60 hover:border-[#009EE3]/50 hover:bg-slate-900/50 hover:scale-[1.01]'
            }`}
          >
            <div className="flex items-center justify-between mb-3.5">
              <div className="w-10 h-10 rounded-2xl bg-[#009EE3]/20 border border-[#009EE3]/40 flex items-center justify-center text-[#00c8ff] shadow-md shadow-[#009EE3]/20">
                <CreditCard className="w-5 h-5" />
              </div>
              <span
                className={`text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-wider shadow-sm ${
                  paymentMethod === 'MERCADO_PAGO'
                    ? 'bg-[#009EE3] text-white'
                    : 'bg-white/[0.06] text-slate-400'
                }`}
              >
                {paymentMethod === 'MERCADO_PAGO' ? '✓ Seleccionado' : 'Online'}
              </span>
            </div>
            <div className="text-sm sm:text-base font-extrabold text-white group-hover:text-cyan-300 transition-colors">
              Mercado Pago Oficial
            </div>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Débito, crédito, dinero en cuenta o cuotas con checkout seguro
            </p>
          </button>

          {/* Efectivo */}
          <button
            type="button"
            onClick={() => onPaymentMethodChange('CASH')}
            className={`p-5 rounded-2xl border text-left transition-all duration-300 relative group cursor-pointer ${
              paymentMethod === 'CASH'
                ? 'border-emerald-500 bg-gradient-to-b from-emerald-600/25 via-emerald-600/10 to-slate-950/85 ring-1 ring-emerald-500/60 shadow-xl shadow-emerald-500/20 scale-[1.02]'
                : 'border-white/[0.08] bg-slate-950/60 hover:border-emerald-500/50 hover:bg-slate-900/50 hover:scale-[1.01]'
            }`}
          >
            <div className="flex items-center justify-between mb-3.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-md shadow-emerald-500/20">
                <Banknote className="w-5 h-5" />
              </div>
              <span
                className={`text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-wider shadow-sm ${
                  paymentMethod === 'CASH'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white/[0.06] text-slate-400'
                }`}
              >
                {paymentMethod === 'CASH' ? '✓ Seleccionado' : 'En Lavadero'}
              </span>
            </div>
            <div className="text-sm sm:text-base font-extrabold text-white group-hover:text-emerald-300 transition-colors">
              Efectivo en Recepción
            </div>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Abonás de forma presencial al entregar tu vehículo en el taller
            </p>
          </button>
        </div>
      </div>
    </div>
  );
};
