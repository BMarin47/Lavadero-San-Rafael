'use client';

import React from 'react';
import { Car, Truck, ChevronDown, Check, Edit3, Sparkles } from 'lucide-react';

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
    <div className="luxury-glass rounded-3xl p-6 sm:p-8 space-y-7 transition-all duration-300">
      {/* Header del Paso */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-5">
        <div className="flex items-center gap-3.5">
          <span className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-sky-500 to-blue-600 text-slate-950 flex items-center justify-center text-sm font-black shadow-lg shadow-cyan-500/25">
            01
          </span>
          <div>
            <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
              <span>Selección de Vehículo</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Elegí la categoría y datos de tu automóvil para el servicio
            </p>
          </div>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-3.5 py-1.5 rounded-full border border-cyan-500/25 shadow-sm">
          Paso 1 de 4
        </span>
      </div>

      {/* Selector de Categoría */}
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
              <button
                key={type}
                type="button"
                onClick={() => handleCategoryClick(type)}
                className={`p-5 rounded-2xl border text-left transition-all duration-300 relative group flex flex-col justify-between min-h-[125px] cursor-pointer ${
                  isSelected
                    ? 'border-cyan-400 bg-gradient-to-b from-cyan-500/20 via-blue-600/10 to-slate-950/80 text-white ring-1 ring-cyan-400/50 shadow-xl shadow-cyan-500/15 scale-[1.02]'
                    : 'border-white/[0.08] bg-slate-950/60 text-slate-300 hover:border-cyan-400/40 hover:bg-slate-900/60 hover:text-white hover:scale-[1.01]'
                }`}
              >
                <div className="flex items-start justify-between w-full">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                      isSelected
                        ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
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
                  </div>
                  {isSelected && (
                    <span className="w-6 h-6 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center text-xs font-black shadow-md shadow-cyan-400/40 animate-in zoom-in-75">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
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
              </button>
            );
          })}
        </div>
      </div>

      {/* Selector de Marca */}
      <div className="space-y-2.5 pt-3 border-t border-white/[0.07]">
        <label
          htmlFor="vehicle-brand-select"
          className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between"
        >
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
            Marca ({VEHICLE_CONFIG[selectedType].label})
          </span>
          <span className="text-[11px] text-cyan-400 font-medium lowercase">obligatorio</span>
        </label>

        <div className="relative">
          <select
            id="vehicle-brand-select"
            value={selectedBrand}
            onChange={(e) => handleBrandSelect(e.target.value)}
            className="w-full px-4 py-3.5 text-sm rounded-2xl bg-slate-950/80 border border-white/[0.09] text-slate-100 font-medium focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 appearance-none cursor-pointer pr-10 transition-all duration-200 shadow-inner hover:border-white/[0.18]"
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
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3 backdrop-blur-md animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <Edit3 className="w-4 h-4" />
              <span>Ingresá los datos de tu vehículo ({VEHICLE_CONFIG[selectedType].label}):</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-amber-200/90 uppercase font-bold block mb-1">
                  Marca
                </label>
                <input
                  type="text"
                  required
                  value={customBrandText}
                  onChange={(e) => onCustomBrandTextChange(e.target.value)}
                  placeholder="Ej: Citroën, Audi, BMW"
                  className="w-full px-4 py-2.5 text-sm rounded-xl bg-slate-950/90 border border-amber-500/30 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                />
              </div>

              <div>
                <label className="text-[10px] text-amber-200/90 uppercase font-bold block mb-1">
                  Modelo
                </label>
                <input
                  type="text"
                  required
                  value={customModelText}
                  onChange={(e) => onCustomModelTextChange(e.target.value)}
                  placeholder="Ej: C3, A3, Serie 1"
                  className="w-full px-4 py-2.5 text-sm rounded-xl bg-slate-950/90 border border-amber-500/30 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
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
        <div className="space-y-2.5 pt-3 border-t border-white/[0.07] animate-in fade-in">
          <label
            htmlFor="vehicle-model-select"
            className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
              Modelo ({selectedBrand})
            </span>
            <span className="text-[11px] text-cyan-400 font-medium lowercase">obligatorio</span>
          </label>

          <div className="relative">
            <select
              id="vehicle-model-select"
              value={selectedModel}
              onChange={(e) => onModelChange(e.target.value)}
              className="w-full px-4 py-3.5 text-sm rounded-2xl bg-slate-950/80 border border-white/[0.09] text-slate-100 font-medium focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 appearance-none cursor-pointer pr-10 transition-all duration-200 shadow-inner hover:border-white/[0.18]"
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
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5 animate-in fade-in slide-in-from-top-2">
              <label className="text-xs text-amber-300 font-bold uppercase flex items-center gap-1.5">
                <Edit3 className="w-4 h-4" />
                <span>Escribí el modelo de tu {selectedBrand}:</span>
              </label>
              <input
                type="text"
                required
                autoFocus
                value={customModelText}
                onChange={(e) => onCustomModelTextChange(e.target.value)}
                placeholder={`Ej: Modelo específico de ${selectedBrand}`}
                className="w-full px-4 py-2.5 text-sm rounded-xl bg-slate-950/90 border border-amber-500/30 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
