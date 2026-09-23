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
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 p-5 md:p-6 rounded-3xl shadow-xl shadow-black/20 space-y-5 transition-all">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <h2 className="text-xs md:text-sm font-extrabold uppercase tracking-wider text-slate-100 flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 text-white flex items-center justify-center text-xs font-black shadow-md shadow-blue-500/30">
            2
          </span>
          Modalidad del Servicio
        </h2>
        <span className="text-[11px] text-cyan-400 font-bold bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
          Paso 2 de 4
        </span>
      </div>

      {/* Switch Individual vs Suscripción */}
      <div className="flex rounded-2xl bg-slate-950/90 p-1.5 border border-slate-800/90 shadow-inner">
        <button
          type="button"
          onClick={() => onModeChange('INDIVIDUAL')}
          className={`flex-1 py-3 text-xs md:text-sm font-extrabold rounded-xl transition-all duration-200 ${
            mode === 'INDIVIDUAL'
              ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Lavado Individual
        </button>

        <button
          type="button"
          onClick={() => onModeChange('SUBSCRIPTION')}
          className={`flex-1 py-3 text-xs md:text-sm font-extrabold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${
            mode === 'SUBSCRIPTION'
              ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>Suscripción Mensual</span>
          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full text-[10px] font-black border border-emerald-500/30">
            -15% OFF
          </span>
        </button>
      </div>

      {/* Panel Individual */}
      {mode === 'INDIVIDUAL' && (
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/70 border border-slate-800/80 backdrop-blur-md space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800/80 pb-3">
            <div>
              <span className="font-extrabold text-sm md:text-base text-white">
                Lavado Completo ({currentVeh.label})
              </span>
              <p className="text-xs text-slate-400 mt-0.5">Turno individual presencial o con entrega</p>
            </div>
            <div className="text-right">
              <span className="text-cyan-400 font-black text-xl md:text-2xl">
                ${currentVeh.price.toLocaleString('es-AR')}
              </span>
              <span className="block text-[10px] text-slate-400 uppercase font-semibold">Precio Final</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 font-bold">✓</span> Champú pH neutro y espuma activa
            </div>
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 font-bold">✓</span> Cera líquida con repelencia de agua
            </div>
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 font-bold">✓</span> Aspirado interior de butacas y baúl
            </div>
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 font-bold">✓</span> Acondicionador de plásticos y neumáticos
            </div>
          </div>
        </div>
      )}

      {/* Panel Suscripción Mensual */}
      {mode === 'SUBSCRIPTION' && (
        <div className="space-y-3.5">
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 flex items-start gap-2.5 backdrop-blur-md">
            <span className="text-lg leading-none">💡</span>
            <span className="leading-relaxed">
              <strong>Ahorro recurrente garantizado:</strong> Recibí un cupo de lavados cada 30 días para tu {currentVeh.label} con prioridad de box en San Rafael.
            </span>
          </div>

          <div className="space-y-3">
            {PLANS_CATALOG.map((plan) => {
              const isSelected = selectedPlan === plan.code;
              const pricing = plan.prices[vehicleType];

              return (
                <label
                  key={plan.code}
                  className={`block p-4 sm:p-4.5 rounded-2xl border cursor-pointer transition-all duration-200 relative ${
                    isSelected
                      ? 'border-cyan-400 bg-gradient-to-r from-blue-600/20 via-cyan-600/10 to-slate-900/60 ring-2 ring-cyan-400/40 shadow-xl shadow-cyan-500/10'
                      : 'border-slate-800/80 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="subscriptionPlan"
                        checked={isSelected}
                        onChange={() => onPlanChange(plan.code)}
                        className="w-4 h-4 text-cyan-500 focus:ring-cyan-500 bg-slate-900 border-slate-700"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-white">
                            {plan.name}
                          </span>
                          {plan.badge && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              {plan.badge}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-cyan-400 font-semibold">
                          {plan.washes} lavados completos al mes
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-black text-base sm:text-lg text-white">
                        ${pricing.price.toLocaleString('es-AR')}
                        <span className="text-[10px] text-slate-400 font-normal">/mes</span>
                      </div>
                      <div className="text-xs line-through text-slate-500">
                        ${pricing.orig.toLocaleString('es-AR')}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 mt-2.5 pl-7 leading-relaxed">
                    {plan.benefits}
                  </p>
                </label>
              );
            })}
          </div>

          {/* Opción de Retiro y Entrega a Domicilio para Oro y Platino */}
          {(selectedPlan === 'ORO' || selectedPlan === 'PLATINO') && (
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 backdrop-blur-md">
              <label className="flex items-center gap-2.5 text-xs sm:text-sm font-bold text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={homeDelivery}
                  onChange={(e) => onHomeDeliveryChange(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-500 bg-slate-900 border-slate-700"
                />
                <span>🚚 Retiro y Entrega a Domicilio en San Rafael (Bonificado)</span>
              </label>

              {homeDelivery && (
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={(e) => onDeliveryAddressChange(e.target.value)}
                  placeholder="Dirección exacta de retiro (Ej: Av. Hipólito Yrigoyen 1420)"
                  className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
