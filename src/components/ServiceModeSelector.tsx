'use client';

import React from 'react';
import { VehicleType, VEHICLE_CONFIG } from './VehicleSelector';

export type ServiceMode = 'INDIVIDUAL' | 'SUBSCRIPTION';
export type PlanCode = 'PLATA' | 'ORO' | 'PLATINO';

interface PlanDetail {
  code: PlanCode;
  name: string;
  washes: number;
  prices: Record<VehicleType, { price: number; orig: number }>;
  benefits: string;
  badge?: string;
}

export const PLANS_CATALOG: PlanDetail[] = [
  {
    code: 'PLATA',
    name: 'Plan Plata',
    washes: 2,
    prices: {
      CAR: { price: 38000, orig: 44000 },
      SUV: { price: 45500, orig: 53000 },
      PICKUP: { price: 55000, orig: 64000 },
    },
    benefits: '2 lavados completos al mes. Incluye cera rápida protectora.',
  },
  {
    code: 'ORO',
    name: 'Plan Oro',
    washes: 3,
    prices: {
      CAR: { price: 56000, orig: 66000 },
      SUV: { price: 67500, orig: 79500 },
      PICKUP: { price: 81500, orig: 96000 },
    },
    benefits: '3 lavados al mes. Cera + hidratación plásticos int/ext + retiro y entrega a domicilio.',
    badge: 'Más Popular',
  },
  {
    code: 'PLATINO',
    name: 'Plan Platino VIP',
    washes: 4,
    prices: {
      CAR: { price: 75000, orig: 88000 },
      SUV: { price: 90000, orig: 106000 },
      PICKUP: { price: 109000, orig: 128000 },
    },
    benefits: '4 lavados al mes. Beneficios Oro + 1 limpieza profunda de tapizados + retiro y entrega a domicilio.',
    badge: 'Detallado VIP',
  },
];

interface ServiceModeSelectorProps {
  vehicleType: VehicleType;
  mode: ServiceMode;
  onModeChange: (mode: ServiceMode) => void;
  selectedPlan: PlanCode;
  onPlanChange: (plan: PlanCode) => void;
  homeDelivery: boolean;
  onHomeDeliveryChange: (val: boolean) => void;
  deliveryAddress: string;
  onDeliveryAddressChange: (val: string) => void;
}

export const ServiceModeSelector: React.FC<ServiceModeSelectorProps> = ({
  vehicleType,
  mode,
  onModeChange,
  selectedPlan,
  onPlanChange,
  homeDelivery,
  onHomeDeliveryChange,
  deliveryAddress,
  onDeliveryAddressChange,
}) => {
  const currentVeh = VEHICLE_CONFIG[vehicleType];

  return (
    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">
            2
          </span>
          Modalidad del Servicio
        </h2>
      </div>

      {/* Switch Individual vs Suscripción */}
      <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
        <button
          type="button"
          onClick={() => onModeChange('INDIVIDUAL')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            mode === 'INDIVIDUAL'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Lavado Individual
        </button>

        <button
          type="button"
          onClick={() => onModeChange('SUBSCRIPTION')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            mode === 'SUBSCRIPTION'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>Suscripción Mensual</span>
          <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[9px] font-black">
            -15% OFF
          </span>
        </button>
      </div>

      {/* Panel Individual */}
      {mode === 'INDIVIDUAL' && (
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5 text-xs">
          <div className="flex justify-between font-bold text-slate-100">
            <span>Lavado Completo ({currentVeh.label})</span>
            <span className="text-blue-400 font-extrabold text-sm">
              ${currentVeh.price.toLocaleString('es-AR')}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Lavado intensivo con champú pH neutro, espuma activa, aspirado completo interior de tapizados y baúl, secado con microfibra y acondicionador de cubiertas.
          </p>
        </div>
      )}

      {/* Panel Suscripción Mensual */}
      {mode === 'SUBSCRIPTION' && (
        <div className="space-y-2.5">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300 flex items-start gap-2">
            <span className="text-base">💡</span>
            <span>
              <strong>Cobro recurrente mensual:</strong> Tu cuenta se acredita automáticamente con el cupo de lavados cada mes y se descuenta al reservar.
            </span>
          </div>

          <div className="space-y-2">
            {PLANS_CATALOG.map((plan) => {
              const isSelected = selectedPlan === plan.code;
              const pricing = plan.prices[vehicleType];

              return (
                <label
                  key={plan.code}
                  className={`block p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-500/15 ring-2 ring-blue-500/30'
                      : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="subscriptionPlan"
                        checked={isSelected}
                        onChange={() => onPlanChange(plan.code)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-slate-100">
                            {plan.name}
                          </span>
                          {plan.badge && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              {plan.badge}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {plan.washes} lavados completos al mes
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-black text-sm text-blue-400">
                        ${pricing.price.toLocaleString('es-AR')}
                      </div>
                      <div className="text-[10px] line-through text-slate-500">
                        ${pricing.orig.toLocaleString('es-AR')}
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 mt-2 pl-6 leading-relaxed">
                    {plan.benefits}
                  </p>
                </label>
              );
            })}
          </div>

          {/* Opción de Retiro y Entrega a Domicilio para Oro y Platino */}
          {(selectedPlan === 'ORO' || selectedPlan === 'PLATINO') && (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 mt-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={homeDelivery}
                  onChange={(e) => onHomeDeliveryChange(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>🚚 Solicitar Retiro y Entrega a Domicilio en San Rafael (Incluido)</span>
              </label>

              {homeDelivery && (
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={(e) => onDeliveryAddressChange(e.target.value)}
                  placeholder="Dirección exacta de retiro (Ej: Av. Hipólito Yrigoyen 1420)"
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-900 border border-slate-800 text-slate-100 focus:outline-none focus:border-blue-500"
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
