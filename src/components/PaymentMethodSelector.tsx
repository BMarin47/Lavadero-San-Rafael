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
    <div className="rounded-3xl bg-slate-900/50 backdrop-blur-xl border border-white/[0.08] p-5 sm:p-7 shadow-xl shadow-black/20 space-y-6 transition-all">
      {/* Header del Paso */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white flex items-center justify-center text-xs font-black shadow-lg shadow-cyan-500/25">
            04
          </span>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
              Datos de Contacto y Pago
            </h2>
            <p className="text-xs text-slate-400">
              Información para tu comprobante y confirmación
            </p>
          </div>
        </div>
        <span className="text-[11px] font-semibold text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
          Paso 4 de 4
        </span>
      </div>

      {/* Datos del Cliente */}
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 block mb-1.5 flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-cyan-400" />
            <span>Nombre y Apellido *</span>
          </label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => onFullNameChange(e.target.value)}
            placeholder="Ej: Juan Pérez"
            className="w-full px-4 py-3 text-sm rounded-2xl bg-slate-950/70 border border-white/[0.08] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/70 focus:ring-2 focus:ring-cyan-500/20 transition-all shadow-inner"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 block mb-1.5 flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-cyan-400" />
              <span>Correo Electrónico *</span>
            </label>
            <input
              type="email"
              required
              value={userEmail}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="juan.perez@ejemplo.com"
              className="w-full px-4 py-3 text-sm rounded-2xl bg-slate-950/70 border border-white/[0.08] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/70 focus:ring-2 focus:ring-cyan-500/20 transition-all shadow-inner"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 block mb-1.5 flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-cyan-400" />
              <span>WhatsApp / Celular *</span>
            </label>
            <div className="flex rounded-2xl bg-slate-950/70 border border-white/[0.08] focus-within:border-cyan-500/70 focus-within:ring-2 focus-within:ring-cyan-500/20 transition-all overflow-hidden shadow-inner">
              <span className="inline-flex items-center px-3.5 bg-white/[0.03] border-r border-white/[0.08] text-xs font-bold text-cyan-400 select-none whitespace-nowrap">
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
                className="w-full min-w-0 px-3.5 py-3 text-sm bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 block mb-1.5 flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
            <span>Indicaciones Especiales (Opcional)</span>
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Ej: Cuidado con espejo lateral, retirar por la tarde"
            className="w-full px-4 py-3 text-sm rounded-2xl bg-slate-950/70 border border-white/[0.08] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/70 focus:ring-2 focus:ring-cyan-500/20 transition-all shadow-inner"
          />
        </div>
      </div>

      {/* Selector de Método de Pago */}
      <div className="pt-2 border-t border-white/[0.06] space-y-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 block">
          Forma de Pago
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Mercado Pago */}
          <button
            type="button"
            onClick={() => onPaymentMethodChange('MERCADO_PAGO')}
            className={`p-4 sm:p-5 rounded-2xl border text-left transition-all duration-200 relative group cursor-pointer ${
              paymentMethod === 'MERCADO_PAGO'
                ? 'border-[#009EE3] bg-gradient-to-b from-[#009EE3]/20 via-[#009EE3]/10 to-slate-950/80 ring-1 ring-[#009EE3]/50 shadow-xl shadow-[#009EE3]/15'
                : 'border-white/[0.08] bg-slate-950/50 hover:border-white/[0.14] hover:bg-slate-900/40'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#009EE3]/20 border border-[#009EE3]/30 flex items-center justify-center text-[#00c8ff]">
                <CreditCard className="w-5 h-5" />
              </div>
              <span
                className={`text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  paymentMethod === 'MERCADO_PAGO'
                    ? 'bg-[#009EE3] text-white shadow-sm'
                    : 'bg-white/[0.06] text-slate-400'
                }`}
              >
                {paymentMethod === 'MERCADO_PAGO' ? '✓ Seleccionado' : 'Online'}
              </span>
            </div>
            <div className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
              Mercado Pago Oficial
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Débito, crédito, dinero en cuenta o cuotas con checkout seguro
            </p>
          </button>

          {/* Efectivo */}
          <button
            type="button"
            onClick={() => onPaymentMethodChange('CASH')}
            className={`p-4 sm:p-5 rounded-2xl border text-left transition-all duration-200 relative group cursor-pointer ${
              paymentMethod === 'CASH'
                ? 'border-emerald-500 bg-gradient-to-b from-emerald-600/20 via-emerald-600/10 to-slate-950/80 ring-1 ring-emerald-500/50 shadow-xl shadow-emerald-500/15'
                : 'border-white/[0.08] bg-slate-950/50 hover:border-white/[0.14] hover:bg-slate-900/40'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Banknote className="w-5 h-5" />
              </div>
              <span
                className={`text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  paymentMethod === 'CASH'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'bg-white/[0.06] text-slate-400'
                }`}
              >
                {paymentMethod === 'CASH' ? '✓ Seleccionado' : 'En Lavadero'}
              </span>
            </div>
            <div className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
              Efectivo en Recepción
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Abonás de forma presencial al entregar tu vehículo en el taller
            </p>
          </button>
        </div>
      </div>
    </div>
  );
};
