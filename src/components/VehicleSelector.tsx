'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Car, Truck, Check } from 'lucide-react';

export type VehicleType = 'CAR' | 'SUV' | 'PICKUP';

export const VEHICLE_CONFIG: Record<
  VehicleType,
  { label: string; sublabel: string; price: number }
> = {
  CAR: { label: 'Auto', sublabel: 'Hatchback / Sedán', price: 22000 },
  SUV: { label: 'SUV', sublabel: 'Cross / Utilitario', price: 26500 },
  PICKUP: { label: 'Camioneta', sublabel: 'Pick-up / Utilitario', price: 32000 },
};

export interface VehicleSelectorProps {
  selectedType: VehicleType;
  onTypeChange: (type: VehicleType) => void;
  selectedBrand?: string;
  onBrandChange?: (brand: string) => void;
  selectedModel?: string;
  onModelChange?: (model: string) => void;
  customBrandText?: string;
  onCustomBrandTextChange?: (text: string) => void;
  customModelText?: string;
  onCustomModelTextChange?: (text: string) => void;
  compact?: boolean;
  onAutoAdvance?: () => void;
}

export const VehicleSelector: React.FC<VehicleSelectorProps> = ({
  selectedType,
  onTypeChange,
  compact = false,
  onAutoAdvance,
}) => {
  const handleCategoryClick = (newType: VehicleType) => {
    onTypeChange(newType);
    if (onAutoAdvance) {
      onAutoAdvance();
    }
  };

  if (compact) {
    return (
      <div className="space-y-3">
        {/* Selector de Categoría (3 columnas en 1 fila) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Categoría
            </span>
            <span className="text-[10px] text-cyan-400 font-semibold">Tarifa base</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(VEHICLE_CONFIG) as VehicleType[]).map((type) => {
              const cfg = VEHICLE_CONFIG[type];
              const isSelected = selectedType === type;

              return (
                <motion.button
                  key={type}
                  type="button"
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleCategoryClick(type)}
                  className={`py-2 px-1.5 rounded-xl border text-center transition-colors duration-200 relative flex flex-col items-center justify-center cursor-pointer ${
                    isSelected
                      ? 'border-cyan-400 bg-gradient-to-b from-cyan-500/25 to-blue-600/15 text-white ring-1 ring-cyan-400/50 shadow-md shadow-cyan-500/20'
                      : 'border-white/[0.08] bg-slate-950/60 text-slate-300 hover:border-cyan-400/30 hover:bg-slate-900/50'
                  }`}
                >
                  <motion.div
                    animate={
                      isSelected
                        ? { scale: [1, 1.25, 0.95, 1], rotate: [0, -8, 8, 0] }
                        : { scale: 1, rotate: 0 }
                    }
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className={`p-1 rounded-lg mb-0.5 ${isSelected ? 'text-cyan-400' : 'text-slate-400'}`}
                  >
                    {type === 'CAR' ? (
                      <Car className="w-4 h-4" />
                    ) : type === 'SUV' ? (
                      <Car className="w-4 h-4 stroke-[2.5]" />
                    ) : (
                      <Truck className="w-4 h-4" />
                    )}
                  </motion.div>
                  <div className="text-xs font-bold leading-tight text-white">{cfg.label}</div>
                  <div className="text-[11px] font-black text-cyan-400 mt-0.5">
                    ${cfg.price.toLocaleString('es-AR')}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="luxury-glass rounded-3xl p-6 sm:p-8 space-y-7 transition-all duration-300">
      {/* Header de Sección */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shadow-md shadow-cyan-500/10">
            <Car className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
              <span>Selección de Vehículo</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Elegí la categoría de tu vehículo para el servicio
            </p>
          </div>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-3.5 py-1.5 rounded-full border border-cyan-500/25 shadow-sm">
          Tarifa Fija
        </span>
      </div>

      {/* Selector de Categoría (3 Grandes Tarjetas) */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
            Categoría del Vehículo
          </label>
          <span className="text-[11px] text-slate-400 font-medium">Tarifa base sugerida</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {(Object.keys(VEHICLE_CONFIG) as VehicleType[]).map((type) => {
            const cfg = VEHICLE_CONFIG[type];
            const isSelected = selectedType === type;

            return (
              <motion.button
                key={type}
                type="button"
                whileHover={{ scale: 1.025, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleCategoryClick(type)}
                className={`p-5 rounded-2xl border text-left transition-colors duration-300 relative group flex flex-col justify-between min-h-[125px] cursor-pointer ${
                  isSelected
                    ? 'border-cyan-400 bg-gradient-to-b from-cyan-500/25 via-blue-600/15 to-slate-950/90 text-white ring-1 ring-cyan-400/50 shadow-xl shadow-cyan-500/20'
                    : 'border-white/[0.08] bg-slate-950/60 text-slate-300 hover:border-cyan-400/40 hover:bg-slate-900/60 hover:text-white'
                }`}
              >
                <div className="flex items-start justify-between w-full">
                  <motion.div
                    animate={
                      isSelected
                        ? { scale: [1, 1.22, 0.95, 1], rotate: [0, -10, 8, 0] }
                        : { scale: 1, rotate: 0 }
                    }
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                      isSelected
                        ? 'bg-gradient-to-tr from-cyan-400 to-sky-500 text-slate-950 shadow-lg shadow-cyan-500/30'
                        : 'bg-white/[0.05] text-slate-300 group-hover:text-cyan-300 group-hover:bg-cyan-500/10'
                    }`}
                  >
                    {type === 'CAR' ? (
                      <Car className="w-5 h-5 stroke-[2.2]" />
                    ) : type === 'SUV' ? (
                      <Car className="w-5 h-5 stroke-[2.5]" />
                    ) : (
                      <Truck className="w-5 h-5 stroke-[2.2]" />
                    )}
                  </motion.div>
                  {isSelected && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                      className="w-6 h-6 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center text-xs font-black shadow-md shadow-cyan-400/40"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </motion.span>
                  )}
                </div>

                <div className="mt-4">
                  <div className="text-base font-bold leading-tight text-white">
                    {cfg.label}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {cfg.sublabel}
                  </div>
                  <div className="text-base font-black text-cyan-400 mt-2.5">
                    ${cfg.price.toLocaleString('es-AR')}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
