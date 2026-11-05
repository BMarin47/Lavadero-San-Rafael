'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Car, CarFront, Truck, Bus, Check, Clock } from 'lucide-react';
import {
  VEHICLE_CONFIG,
  VehicleCategoryType as VehicleType,
  normalizeVehicleType,
} from '@/lib/config';

export type { VehicleType };
export { VEHICLE_CONFIG };

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

const renderVehicleIcon = (type: VehicleType, compact: boolean) => {
  const sizeClass = compact ? 'w-4 h-4' : 'w-5 h-5';
  switch (type) {
    case 'CAR':
      return <Car className={`${sizeClass} stroke-[2.2]`} />;
    case 'SUV':
      return <CarFront className={`${sizeClass} stroke-[2.3]`} />;
    case 'PICKUP':
      return <Truck className={`${sizeClass} stroke-[2.2]`} />;
    case 'LARGE_PICKUP':
      return <Truck className={`${sizeClass} stroke-[2.6] scale-110`} />;
    case 'UTILITY':
      return <Bus className={`${sizeClass} stroke-[2.2]`} />;
    default:
      return <Car className={sizeClass} />;
  }
};

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

  const vehicleTypes = Object.keys(VEHICLE_CONFIG) as VehicleType[];

  if (compact) {
    return (
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Categoría y Tamaño
            </span>
            <span className="text-[10px] text-cyan-400 font-semibold">
              Tarifa base • Tiempo est.
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {vehicleTypes.map((type, idx) => {
              const cfg = VEHICLE_CONFIG[type];
              const isSelected = normalizeVehicleType(selectedType) === type;
              const isLastOdd =
                vehicleTypes.length % 2 === 1 && idx === vehicleTypes.length - 1;

              return (
                <motion.button
                  key={type}
                  type="button"
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleCategoryClick(type)}
                  className={`py-2.5 px-2 rounded-xl border text-center transition-colors duration-200 relative flex flex-col items-center justify-center cursor-pointer ${
                    isLastOdd ? 'col-span-2 sm:col-span-1' : ''
                  } ${
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
                    className={`p-1 rounded-lg mb-0.5 ${
                      isSelected ? 'text-cyan-400' : 'text-slate-400'
                    }`}
                  >
                    {renderVehicleIcon(type, true)}
                  </motion.div>
                  <div className="text-xs font-bold leading-tight text-white">
                    {cfg.label}
                  </div>
                  <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                    {cfg.sublabel}
                  </div>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <span className="text-[11px] font-black text-cyan-400">
                      ${cfg.price.toLocaleString('es-AR')}
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/[0.06] text-slate-300 border border-white/[0.08] inline-flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5 text-cyan-400" />
                      {cfg.durationHours} hs
                    </span>
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
              Elegí la categoría y porte de tu vehículo para el servicio
            </p>
          </div>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-3.5 py-1.5 rounded-full border border-cyan-500/25 shadow-sm">
          Tarifa Fija
        </span>
      </div>

      {/* Selector de Categoría (5 Tarjetas) */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
            Categoría del Vehículo
          </label>
          <span className="text-[11px] text-slate-400 font-medium">
            Tarifa base y tiempo estimado
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {vehicleTypes.map((type) => {
            const cfg = VEHICLE_CONFIG[type];
            const isSelected = normalizeVehicleType(selectedType) === type;

            return (
              <motion.button
                key={type}
                type="button"
                whileHover={{ scale: 1.025, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleCategoryClick(type)}
                className={`p-5 rounded-2xl border text-left transition-colors duration-300 relative group flex flex-col justify-between min-h-[135px] cursor-pointer ${
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
                    {renderVehicleIcon(type, false)}
                  </motion.div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-300 border border-white/[0.08] inline-flex items-center gap-1">
                      <Clock className="w-3 h-3 text-cyan-400" />
                      {cfg.durationHours} hs
                    </span>
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
