'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  ChevronDown,
  Check,
  Crown,
  ShieldCheck,
  Zap,
  Car,
} from 'lucide-react';
import { VehicleType, VEHICLE_CONFIG } from './VehicleSelector';
import { PLANS_CATALOG, PlanCode } from './ServiceModeSelector';

interface PlansAccordionProps {
  initialVehicleType?: VehicleType;
  onSelectPlan?: (planCode: PlanCode) => void;
  className?: string;
}

export function PlansAccordion({
  initialVehicleType = 'CAR',
  onSelectPlan,
  className = '',
}: PlansAccordionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType>(initialVehicleType);

  const vehicleOptions: { type: VehicleType; label: string }[] = [
    { type: 'CAR', label: 'Auto' },
    { type: 'SUV', label: 'SUV' },
    { type: 'PICKUP', label: 'Camioneta' },
  ];

  return (
    <div
      className={`rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-cyan-950/20 to-slate-950/60 backdrop-blur-xl shadow-lg shadow-cyan-950/20 overflow-hidden transition-all duration-300 ${className}`}
    >
      {/* BOTÓN COLAPSABLE (HEADER COMPACTO - CERO SCROLL) */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full px-4 py-3.5 sm:px-5 sm:py-4 flex items-center justify-between gap-3 text-left transition-colors hover:bg-cyan-500/[0.06] active:scale-[0.99] cursor-pointer"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-400 via-sky-500 to-blue-600 flex items-center justify-center text-slate-950 shadow-md shadow-cyan-500/20 shrink-0">
            <Crown className="w-5 h-5 fill-slate-950 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-sm sm:text-base text-white tracking-tight">
                Planes Mensuales de Lavado
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 border border-cyan-400/30 text-cyan-300 uppercase tracking-wider">
                Ahorrá hasta 20%
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 truncate mt-0.5">
              Plata • Oro • Platino VIP — Tocá para {isOpen ? 'ocultar beneficios' : 'ver beneficios y tarifas'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline text-xs font-semibold text-cyan-400">
            {isOpen ? 'Cerrar' : 'Ver Planes'}
          </span>
          <div
            className={`w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center text-cyan-400 transition-transform duration-300 ${
              isOpen ? 'rotate-180 bg-cyan-500/20 text-cyan-300' : ''
            }`}
          >
            <ChevronDown className="w-4 h-4 stroke-[2.5]" />
          </div>
        </div>
      </button>

      {/* CONTENIDO DESPLEGABLE (EXPANSIÓN SUAVE) */}
      {isOpen && (
        <div className="px-3.5 sm:px-5 pb-5 pt-1 border-t border-white/[0.06] space-y-4 animate-in fade-in zoom-in-95 duration-200">
          {/* SELECTOR RÁPIDO DE VEHÍCULO PARA TARIFAS EXACTAS */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5 text-cyan-400" />
              Precios calculados para:
            </span>
            <div className="inline-flex p-1 rounded-xl bg-slate-900/80 border border-white/[0.08] gap-1">
              {vehicleOptions.map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => setSelectedVehicle(opt.type)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedVehicle === opt.type
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* GRID DE LOS 3 PLANES (PLATA, ORO, PLATINO) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
            {PLANS_CATALOG.map((plan) => {
              const pricing = plan.prices[selectedVehicle];
              const isPopular = plan.isPopular;

              return (
                <div
                  key={plan.code}
                  className={`relative rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 ${
                    isPopular
                      ? 'bg-gradient-to-b from-cyan-950/70 via-slate-900/90 to-blue-950/70 border-2 border-cyan-400 shadow-xl shadow-cyan-500/10'
                      : 'bg-slate-900/60 border border-white/[0.08] hover:border-cyan-500/30'
                  }`}
                >
                  {/* BADGE DESTACADO */}
                  {plan.badge && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-md ${
                          isPopular
                            ? 'bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950'
                            : 'bg-slate-800 text-cyan-300 border border-cyan-500/30'
                        }`}
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="pt-1">
                      <h4 className="font-extrabold text-base text-white tracking-tight">
                        {plan.name}
                      </h4>
                      <p className="text-xs text-cyan-300 font-semibold mt-0.5">
                        {plan.washes} lavados completos por mes
                      </p>
                    </div>

                    {/* PRECIO MENSUAL */}
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/[0.05] space-y-0.5">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl sm:text-2xl font-black text-white">
                          ${pricing.price.toLocaleString('es-AR')}
                        </span>
                        <span className="text-[11px] text-slate-400 line-through">
                          ${pricing.orig.toLocaleString('es-AR')}
                        </span>
                      </div>
                      <p className="text-[10px] font-semibold text-emerald-400">
                        Abono mensual • Precio congelado
                      </p>
                    </div>

                    {/* BENEFICIOS / FEATURES */}
                    <ul className="space-y-1.5 pt-1 text-left">
                      {plan.features.map((feat, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-xs text-slate-300"
                        >
                          <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                          <span className="leading-tight">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* ACCIÓN POR PLAN */}
                  <div className="pt-4 mt-auto">
                    <a
                      href={`https://wa.me/5492604654255?text=${encodeURIComponent(
                        `Hola AquaShine San Rafael, me interesa suscribirme al ${plan.name} para mi ${VEHICLE_CONFIG[selectedVehicle].label} ($${pricing.price.toLocaleString('es-AR')} mensual). ¿Cómo procedemos?`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`w-full py-2.5 px-3 rounded-xl font-black text-xs inline-flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-95 cursor-pointer shadow-md ${
                        isPopular
                          ? 'bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 shadow-cyan-500/20'
                          : 'bg-white/[0.08] hover:bg-white/[0.14] text-slate-100 border border-white/[0.1]'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Pedir {plan.name}</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-center pt-1">
            <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Sin permanencia mínima • Podés pausar o cambiar de plan cuando quieras.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlansAccordion;
