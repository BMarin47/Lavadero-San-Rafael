'use client';

import React from 'react';
import { VehicleType, VEHICLE_CONFIG } from './VehicleSelector';
import { Sparkles, Check, Truck, Zap, ShieldCheck } from 'lucide-react';

export type ServiceMode = 'INDIVIDUAL' | 'SUBSCRIPTION';
export type PlanCode = 'PLATA' | 'ORO' | 'PLATINO';

interface PlanDetail {
  code: PlanCode;
  name: string;
  washes: number;
  prices: Record<VehicleType, { price: number; orig: number }>;
  features: string[];
  badge?: string;
  isPopular?: boolean;
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
    features: [
      '2 lavados completos al mes',
      'Cera rápida protectora hidrofóbica',
      'Aspirado completo y desinfección',
    ],
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
    features: [
      '3 lavados completos al mes',
      'Cera de alta durabilidad + sellado',
      'Hidratación de plásticos int/ext',
      'Retiro y entrega a domicilio bonificado',
    ],
    badge: 'Más Elegido',
    isPopular: true,
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
    features: [
      '4 lavados completos al mes',
      'Todos los beneficios del Plan Oro',
      '1 limpieza profunda de tapizados por ciclo',
      'Atención prioritaria y delivery incluido',
    ],
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
    <div className="rounded-3xl bg-slate-900/50 backdrop-blur-xl border border-white/[0.08] p-5 sm:p-7 shadow-xl shadow-black/20 space-y-6 transition-all">
      {/* Header del Paso */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white flex items-center justify-center text-xs font-black shadow-lg shadow-cyan-500/25">
            02
          </span>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
              Modalidad de Servicio
            </h2>
            <p className="text-xs text-slate-400">
              Elegí entre un lavado puntual o abono mensual
            </p>
          </div>
        </div>
        <span className="text-[11px] font-semibold text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
          Paso 2 de 4
        </span>
      </div>

      {/* Switch Segmentado */}
      <div className="flex rounded-2xl bg-slate-950/70 p-1.5 border border-white/[0.08] shadow-inner">
        <button
          type="button"
          onClick={() => onModeChange('INDIVIDUAL')}
          className={`flex-1 py-3 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 cursor-pointer ${
            mode === 'INDIVIDUAL'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Lavado Individual
        </button>

        <button
          type="button"
          onClick={() => onModeChange('SUBSCRIPTION')}
          className={`flex-1 py-3 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
            mode === 'SUBSCRIPTION'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>Suscripción Mensual</span>
          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full text-[10px] font-extrabold border border-emerald-500/30">
            -15% OFF
          </span>
        </button>
      </div>

      {/* Contenido: Lavado Individual */}
      {mode === 'INDIVIDUAL' && (
        <div className="p-5 rounded-2xl bg-slate-950/50 border border-white/[0.08] space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[10px] font-bold uppercase tracking-wider mb-1">
                Servicio Premium
              </span>
              <h3 className="font-extrabold text-base sm:text-lg text-white">
                Lavado Completo ({currentVeh.label})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Tratamiento artesanal interior y exterior detallado
              </p>
            </div>
            <div className="sm:text-right">
              <div className="text-2xl sm:text-3xl font-black text-cyan-400 tracking-tight">
                ${currentVeh.price.toLocaleString('es-AR')}
              </div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">
                Precio Final • Pago Único
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-300">
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 stroke-[2.5]" />
              </span>
              <span>Champú pH neutro y espuma activa de alta densidad</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 stroke-[2.5]" />
              </span>
              <span>Cera líquida con repelencia de agua y brillo profundo</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 stroke-[2.5]" />
              </span>
              <span>Aspirado interior minucioso de butacas, alfombras y baúl</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 stroke-[2.5]" />
              </span>
              <span>Acondicionador UV de plásticos y neumáticos</span>
            </div>
          </div>
        </div>
      )}

      {/* Contenido: Suscripciones Mensuales */}
      {mode === 'SUBSCRIPTION' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Banner de beneficios */}
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-200 flex items-start gap-3 backdrop-blur-md">
            <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="text-white">Ahorro y prioridad garantizada:</strong> Tu vehículo siempre impecable con cupos de lavado cada 30 días, prioridad de atención asegurada en San Rafael y tarifas congeladas.
            </div>
          </div>

          {/* Tarjetas de Planes */}
          <div className="space-y-3">
            {PLANS_CATALOG.map((plan) => {
              const isSelected = selectedPlan === plan.code;
              const pricing = plan.prices[vehicleType];

              return (
                <label
                  key={plan.code}
                  className={`block p-5 rounded-2xl border cursor-pointer transition-all duration-200 relative ${
                    isSelected
                      ? 'border-cyan-500/60 bg-gradient-to-r from-cyan-500/15 via-blue-600/10 to-slate-900/70 ring-1 ring-cyan-500/40 shadow-xl shadow-cyan-500/10'
                      : 'border-white/[0.08] bg-slate-950/50 hover:border-white/[0.14] hover:bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="pt-0.5">
                        <input
                          type="radio"
                          name="subscriptionPlan"
                          checked={isSelected}
                          onChange={() => onPlanChange(plan.code)}
                          className="w-4 h-4 text-cyan-500 focus:ring-cyan-500 bg-slate-900 border-slate-700 cursor-pointer"
                        />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-sm sm:text-base text-white">
                            {plan.name}
                          </span>
                          {plan.badge && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              {plan.badge}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-cyan-400 font-semibold block mt-0.5">
                          {plan.washes} lavados completos por mes
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-black text-lg sm:text-xl text-white">
                        ${pricing.price.toLocaleString('es-AR')}
                        <span className="text-[11px] text-slate-400 font-normal">/mes</span>
                      </div>
                      <div className="text-xs line-through text-slate-500">
                        ${pricing.orig.toLocaleString('es-AR')}
                      </div>
                    </div>
                  </div>

                  {/* Lista de características del plan */}
                  <div className="mt-3.5 pt-3 border-t border-white/[0.06] grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                        </span>
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </label>
              );
            })}
          </div>

          {/* Opción de Retiro y Entrega a Domicilio para Oro y Platino */}
          {(selectedPlan === 'ORO' || selectedPlan === 'PLATINO') && (
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/[0.08] space-y-3 backdrop-blur-md animate-in fade-in">
              <label className="flex items-center gap-3 text-xs sm:text-sm font-semibold text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={homeDelivery}
                  onChange={(e) => onHomeDeliveryChange(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-500 bg-slate-900 border-slate-700 cursor-pointer"
                />
                <span className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-cyan-400" />
                  <span>Retiro y Entrega a Domicilio en San Rafael (Bonificado)</span>
                </span>
              </label>

              {homeDelivery && (
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={(e) => onDeliveryAddressChange(e.target.value)}
                  placeholder="Dirección exacta de retiro (Ej: Av. Hipólito Yrigoyen 1420)"
                  className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-900/90 border border-white/[0.1] text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 shadow-inner"
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
