'use client';

import React from 'react';
import { Car, Truck, ChevronDown, Sparkles, Check, Edit3 } from 'lucide-react';

export type VehicleType = 'CAR' | 'SUV' | 'PICKUP';

export const VEHICLE_CONFIG: Record<
  VehicleType,
  { label: string; sublabel: string; price: number }
> = {
  CAR: { label: 'Auto', sublabel: 'Hatchback / Sedán', price: 22000 },
  SUV: { label: 'SUV', sublabel: 'Cross / Utilitario', price: 26500 },
  PICKUP: { label: 'Camioneta', sublabel: 'Pick-up / Utilitario', price: 32000 },
};

// 10 marcas populares en Argentina por categoría + 'Otra Marca'
export const BRANDS_BY_CATEGORY: Record<VehicleType, string[]> = {
  CAR: [
    'Fiat',
    'Peugeot',
    'Toyota',
    'Volkswagen',
    'Chevrolet',
    'Renault',
    'Ford',
    'Nissan',
    'Honda',
    'Jeep',
    'Otra Marca',
  ],
  SUV: [
    'Chevrolet',
    'Volkswagen',
    'Toyota',
    'Jeep',
    'Nissan',
    'Renault',
    'Ford',
    'Peugeot',
    'Honda',
    'Fiat',
    'Otra Marca',
  ],
  PICKUP: [
    'Toyota',
    'Volkswagen',
    'Ford',
    'Nissan',
    'Fiat',
    'Renault',
    'Chevrolet',
    'Peugeot',
    'Jeep',
    'Honda',
    'Otra Marca',
  ],
};

// Mapeo de hasta 10 modelos por Marca y Categoría + 'Otro Modelo'
export const MODELS_BY_CATEGORY_AND_BRAND: Record<
  VehicleType,
  Record<string, string[]>
> = {
  CAR: {
    Fiat: ['Cronos', 'Argo', 'Mobi', 'Uno', 'Punto', 'Siena', 'Palio', '500', 'Tipo', 'Línea', 'Otro Modelo'],
    Peugeot: ['208', '308', '408', '206', '207', '307', '508', '301', '205', 'Otro Modelo'],
    Toyota: ['Corolla', 'Yaris', 'Etios', 'Prius', 'Camry', 'Corona', 'Otro Modelo'],
    Volkswagen: ['Gol', 'Polo', 'Vento', 'Virtus', 'Fox', 'Up!', 'Voyage', 'Bora', 'Golf', 'Passat', 'Otro Modelo'],
    Chevrolet: ['Onix', 'Cruze', 'Prisma', 'Corsa', 'Classic', 'Aveo', 'Sonic', 'Astra', 'Vectra', 'Spark', 'Otro Modelo'],
    Renault: ['Sandero', 'Logan', 'Clio', 'Megane', 'Fluence', 'Kwid', 'Symbol', 'Laguna', '19', 'Otro Modelo'],
    Ford: ['Ka', 'Fiesta', 'Focus', 'Mondeo', 'Escort', 'Sierra', 'Falcon', 'Otro Modelo'],
    Nissan: ['Versa', 'Sentra', 'March', 'Tiida', 'Note', 'Otro Modelo'],
    Honda: ['Civic', 'City', 'Fit', 'Accord', 'Legend', 'Otro Modelo'],
    Jeep: ['Renegade', 'Compass', 'Otro Modelo'],
  },
  SUV: {
    Chevrolet: ['Tracker', 'Equinox', 'Trailblazer', 'Captiva', 'Spin Activ', 'Otro Modelo'],
    Volkswagen: ['Taos', 'T-Cross', 'Nivus', 'Tiguan', 'Touareg', 'Otro Modelo'],
    Toyota: ['Corolla Cross', 'SW4', 'RAV4', 'Land Cruiser', 'Yaris Cross', 'Otro Modelo'],
    Jeep: ['Renegade', 'Compass', 'Commander', 'Grand Cherokee', 'Wrangler', 'Otro Modelo'],
    Nissan: ['Kicks', 'X-Trail', 'Murano', 'Pathfinder', 'Otro Modelo'],
    Renault: ['Duster', 'Captur', 'Koleos', 'Stepway', 'Kardian', 'Otro Modelo'],
    Ford: ['Territory', 'Bronco Sport', 'EcoSport', 'Kuga', 'Explorer', 'Edge', 'Otro Modelo'],
    Peugeot: ['2008', '3008', '5008', 'Otro Modelo'],
    Honda: ['HR-V', 'CR-V', 'WR-V', 'ZR-V', 'Pilot', 'Otro Modelo'],
    Fiat: ['Pulse', 'Fastback', '500X', 'Freemont', 'Otro Modelo'],
  },
  PICKUP: {
    Toyota: ['Hilux', 'Hilux GR-Sport', 'Land Cruiser Prado', 'Tundra', 'Tacoma', 'Otro Modelo'],
    Volkswagen: ['Amarok', 'Amarok V6', 'Saveiro', 'Tarok', 'Otro Modelo'],
    Ford: ['Ranger', 'Maverick', 'F-150', 'Ranger Raptor', 'F-100', 'Otro Modelo'],
    Nissan: ['Frontier', 'Titan', 'Navara', 'NP300', 'Otro Modelo'],
    Fiat: ['Toro', 'Strada', 'Titano', 'Fiorino', 'Ducato', 'Otro Modelo'],
    Renault: ['Alaskan', 'Oroch', 'Master', 'Kangoo Express', 'Trafic', 'Otro Modelo'],
    Chevrolet: ['S10', 'Montana', 'Silverado', 'D-20', 'C-10', 'Otro Modelo'],
    Peugeot: ['Landtrek', 'Partner', 'Boxer', 'Expert', 'Otro Modelo'],
    Jeep: ['Gladiator', 'Comanche', 'Otro Modelo'],
    Honda: ['Ridgeline', 'Otro Modelo'],
  },
};

interface VehicleSelectorProps {
  selectedType: VehicleType;
  onTypeChange: (type: VehicleType) => void;
  selectedBrand: string;
  onBrandChange: (brand: string) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  customBrandText: string;
  onCustomBrandTextChange: (text: string) => void;
  customModelText: string;
  onCustomModelTextChange: (text: string) => void;
}

export const VehicleSelector: React.FC<VehicleSelectorProps> = ({
  selectedType,
  onTypeChange,
  selectedBrand,
  onBrandChange,
  selectedModel,
  onModelChange,
  customBrandText,
  onCustomBrandTextChange,
  customModelText,
  onCustomModelTextChange,
}) => {
  const brandsList = BRANDS_BY_CATEGORY[selectedType] || [];

  const modelsList =
    selectedBrand && selectedBrand !== 'Otra Marca'
      ? MODELS_BY_CATEGORY_AND_BRAND[selectedType]?.[selectedBrand] || ['Otro Modelo']
      : [];

  const handleCategoryClick = (newType: VehicleType) => {
    onTypeChange(newType);
    onBrandChange('');
    onModelChange('');
    onCustomBrandTextChange('');
    onCustomModelTextChange('');
  };

  const handleBrandSelect = (brand: string) => {
    onBrandChange(brand);
    onModelChange('');
    onCustomModelTextChange('');
    if (brand !== 'Otra Marca') {
      onCustomBrandTextChange('');
      const availableModels = MODELS_BY_CATEGORY_AND_BRAND[selectedType]?.[brand];
      if (availableModels && availableModels.length > 0) {
        onModelChange(availableModels[0]);
      }
    }
  };

  const isOtherBrand = selectedBrand === 'Otra Marca';
  const isOtherModel = selectedModel === 'Otro Modelo';

  return (
    <div className="rounded-3xl bg-slate-900/50 backdrop-blur-xl border border-white/[0.08] p-5 sm:p-7 shadow-xl shadow-black/20 space-y-6 transition-all">
      {/* Header del Paso */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white flex items-center justify-center text-xs font-black shadow-lg shadow-cyan-500/25">
            01
          </span>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
              Selección de Vehículo
            </h2>
            <p className="text-xs text-slate-400">
              Elegí la categoría y datos de tu automóvil
            </p>
          </div>
        </div>
        <span className="text-[11px] font-semibold text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
          Paso 1 de 4
        </span>
      </div>

      {/* Selector de Categoría */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Categoría del Vehículo
          </label>
          <span className="text-[11px] text-slate-400">Tarifa base sugerida</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(Object.keys(VEHICLE_CONFIG) as VehicleType[]).map((type) => {
            const cfg = VEHICLE_CONFIG[type];
            const isSelected = selectedType === type;

            return (
              <button
                key={type}
                type="button"
                onClick={() => handleCategoryClick(type)}
                className={`p-4 rounded-2xl border text-left transition-all duration-200 relative group flex flex-col justify-between min-h-[110px] cursor-pointer ${
                  isSelected
                    ? 'border-cyan-500/60 bg-gradient-to-b from-cyan-500/15 via-blue-600/10 to-slate-900/60 text-white ring-1 ring-cyan-500/40 shadow-xl shadow-cyan-500/10'
                    : 'border-white/[0.06] bg-slate-950/40 text-slate-300 hover:border-white/[0.12] hover:bg-slate-900/40 hover:text-white'
                }`}
              >
                <div className="flex items-start justify-between w-full">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-cyan-500/20 text-cyan-300'
                        : 'bg-white/[0.04] text-slate-400 group-hover:text-slate-200'
                    }`}
                  >
                    {type === 'CAR' ? (
                      <Car className="w-5 h-5" />
                    ) : type === 'SUV' ? (
                      <Car className="w-5 h-5 stroke-[2.2]" />
                    ) : (
                      <Truck className="w-5 h-5" />
                    )}
                  </div>
                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center text-[10px] font-bold shadow-md shadow-cyan-500/30 animate-in zoom-in-75">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  <div className="text-sm font-bold leading-tight text-white">
                    {cfg.label}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {cfg.sublabel}
                  </div>
                  <div className="text-sm font-extrabold text-cyan-400 mt-2">
                    ${cfg.price.toLocaleString('es-AR')}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selector de Marca */}
      <div className="space-y-2 pt-2 border-t border-white/[0.06]">
        <label
          htmlFor="vehicle-brand-select"
          className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center justify-between"
        >
          <span>Marca ({VEHICLE_CONFIG[selectedType].label})</span>
          <span className="text-[11px] text-slate-500 lowercase">requerido</span>
        </label>

        <div className="relative">
          <select
            id="vehicle-brand-select"
            value={selectedBrand}
            onChange={(e) => handleBrandSelect(e.target.value)}
            className="w-full px-4 py-3 text-sm rounded-2xl bg-slate-950/70 border border-white/[0.08] text-slate-100 font-medium focus:outline-none focus:border-cyan-500/70 focus:ring-2 focus:ring-cyan-500/20 appearance-none cursor-pointer pr-10 transition-all shadow-inner"
          >
            <option value="" disabled>
              -- Seleccioná la marca de tu vehículo --
            </option>
            {brandsList.map((brandName) => (
              <option
                key={brandName}
                value={brandName}
                className={brandName === 'Otra Marca' ? 'font-bold text-amber-400 bg-slate-900' : 'text-slate-100 bg-slate-900'}
              >
                {brandName === 'Otra Marca' ? 'Personalizado (Escribir marca)' : brandName}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>

        {/* Inputs manuales si elige 'Otra Marca' */}
        {isOtherBrand && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-3 backdrop-blur-md animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <Edit3 className="w-3.5 h-3.5" />
              <span>Ingresá los datos de tu vehículo ({VEHICLE_CONFIG[selectedType].label}):</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-amber-200/80 uppercase font-bold block mb-1">
                  Marca
                </label>
                <input
                  type="text"
                  required
                  value={customBrandText}
                  onChange={(e) => onCustomBrandTextChange(e.target.value)}
                  placeholder="Ej: Citroën, Audi, BMW"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-950/80 border border-amber-500/30 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="text-[10px] text-amber-200/80 uppercase font-bold block mb-1">
                  Modelo
                </label>
                <input
                  type="text"
                  required
                  value={customModelText}
                  onChange={(e) => onCustomModelTextChange(e.target.value)}
                  placeholder="Ej: C3, A3, Serie 1"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-950/80 border border-amber-500/30 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-300">
              Se tarifará según categoría <strong className="text-white">{VEHICLE_CONFIG[selectedType].label}</strong> (${VEHICLE_CONFIG[selectedType].price.toLocaleString('es-AR')}).
            </p>
          </div>
        )}
      </div>

      {/* Selector de Modelo */}
      {!isOtherBrand && selectedBrand && (
        <div className="space-y-2 pt-2 border-t border-white/[0.06] animate-in fade-in">
          <label
            htmlFor="vehicle-model-select"
            className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center justify-between"
          >
            <span>Modelo ({selectedBrand})</span>
            <span className="text-[11px] text-slate-500 lowercase">requerido</span>
          </label>

          <div className="relative">
            <select
              id="vehicle-model-select"
              value={selectedModel}
              onChange={(e) => onModelChange(e.target.value)}
              className="w-full px-4 py-3 text-sm rounded-2xl bg-slate-950/70 border border-white/[0.08] text-slate-100 font-medium focus:outline-none focus:border-cyan-500/70 focus:ring-2 focus:ring-cyan-500/20 appearance-none cursor-pointer pr-10 transition-all shadow-inner"
            >
              <option value="" disabled>
                -- Seleccioná el modelo --
              </option>
              {modelsList.map((modelName) => (
                <option
                  key={modelName}
                  value={modelName}
                  className={modelName === 'Otro Modelo' ? 'font-bold text-amber-400 bg-slate-900' : 'text-slate-100 bg-slate-900'}
                >
                  {modelName === 'Otro Modelo' ? 'Personalizado (Escribir modelo)' : modelName}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>

          {/* Input manual si elige 'Otro Modelo' */}
          {isOtherModel && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2 animate-in fade-in slide-in-from-top-2">
              <label className="text-xs text-amber-300 font-semibold uppercase flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5" />
                <span>Escribí el modelo de tu {selectedBrand}:</span>
              </label>
              <input
                type="text"
                required
                autoFocus
                value={customModelText}
                onChange={(e) => onCustomModelTextChange(e.target.value)}
                placeholder={`Ej: Modelo específico de ${selectedBrand}`}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-950/80 border border-amber-500/30 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
