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
    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">
            4
          </span>
          Datos de Contacto y Pago
        </h2>
      </div>

      {/* Datos del Cliente: Inicializados estrictamente vacíos sin datos simulados */}
      <div className="space-y-2">
        <div>
          <label className="text-[10px] text-slate-400 font-semibold uppercase">
            Nombre y Apellido
          </label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => onFullNameChange(e.target.value)}
            placeholder="Ingresá tu nombre y apellido"
            className="w-full mt-1 px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-400 font-semibold uppercase">
              Correo Electrónico
            </label>
            <input
              type="email"
              required
              value={userEmail}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="Ingresá tu correo electrónico"
              className="w-full mt-1 px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 font-semibold uppercase">
              Número de Teléfono (WhatsApp)
            </label>
            <div className="mt-1 flex rounded-lg bg-slate-950 border border-slate-800 focus-within:border-blue-500 transition-colors overflow-hidden">
              <span className="inline-flex items-center px-3 bg-slate-900 border-r border-slate-800 text-xs font-bold text-blue-400 select-none whitespace-nowrap">
                +54 9
              </span>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => {
                  let val = e.target.value;
                  // Si el usuario pega un número que incluye el prefijo internacional/nacional, lo limpiamos para no duplicar
                  val = val.replace(/^(\+?54\s*9?|\+?54)\s*/, '');
                  onPhoneChange(val);
                }}
                placeholder="260 412-3456"
                className="w-full min-w-0 px-3 py-2 text-xs bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="text-[10px] text-slate-400 font-semibold uppercase">
            Indicaciones Especiales (Opcional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Comentarios adicionales para el equipo de lavado"
            className="w-full mt-1 px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Selector de Método de Pago */}
      <div className="pt-1">
        <label className="text-[10px] text-slate-400 font-semibold uppercase block mb-1.5">
          Elegí cómo abonar:
        </label>
        <div className="grid grid-cols-2 gap-2">
          {/* Mercado Pago */}
          <button
            type="button"
            onClick={() => onPaymentMethodChange('MERCADO_PAGO')}
            className={`p-3 rounded-xl border text-left transition-all ${
              paymentMethod === 'MERCADO_PAGO'
                ? 'border-blue-500 bg-blue-500/15 ring-2 ring-blue-500/30'
                : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xl">💳</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  paymentMethod === 'MERCADO_PAGO' ? 'bg-blue-500' : 'bg-transparent'
                }`}
              />
            </div>
            <div className="text-xs font-bold text-blue-400">Mercado Pago</div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              App Móvil o Checkout Web
            </div>
          </button>

          {/* Efectivo */}
          <button
            type="button"
            onClick={() => onPaymentMethodChange('CASH')}
            className={`p-3 rounded-xl border text-left transition-all ${
              paymentMethod === 'CASH'
                ? 'border-emerald-500 bg-emerald-500/15 ring-2 ring-emerald-500/30'
                : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xl">💵</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  paymentMethod === 'CASH' ? 'bg-emerald-500' : 'bg-transparent'
                }`}
              />
            </div>
            <div className="text-xs font-bold text-emerald-400">Efectivo</div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Abonás presencialmente al entregar
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
