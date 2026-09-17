'use client';

import React from 'react';

export type VehicleType = 'CAR' | 'SUV' | 'PICKUP';

export const VEHICLE_CONFIG: Record<
  VehicleType,
  { label: string; icon: string; price: number }
> = {
  CAR: { label: 'Auto', icon: '🚗', price: 22000 },
  SUV: { label: 'SUV', icon: '🚙', price: 26500 },
  PICKUP: { label: 'Camioneta', icon: '🛻', price: 32000 },
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
  // Lista de marcas para la categoría seleccionada
  const brandsList = BRANDS_BY_CATEGORY[selectedType] || [];

  // Lista de modelos para la marca y categoría seleccionada
  const modelsList =
    selectedBrand && selectedBrand !== 'Otra Marca'
      ? MODELS_BY_CATEGORY_AND_BRAND[selectedType]?.[selectedBrand] || ['Otro Modelo']
      : [];

  // Cuando cambia la Categoría (Paso 1)
  const handleCategoryClick = (newType: VehicleType) => {
    onTypeChange(newType);
    // Reiniciar Marca y Modelo
    onBrandChange('');
    onModelChange('');
    onCustomBrandTextChange('');
    onCustomModelTextChange('');
  };

  // Cuando cambia la Marca (Paso 2)
  const handleBrandSelect = (brand: string) => {
    onBrandChange(brand);
    onModelChange('');
    onCustomModelTextChange('');
    if (brand !== 'Otra Marca') {
      onCustomBrandTextChange('');
      // Autoseleccionar primer modelo si existe
      const availableModels = MODELS_BY_CATEGORY_AND_BRAND[selectedType]?.[brand];
      if (availableModels && availableModels.length > 0) {
        onModelChange(availableModels[0]);
      }
    }
  };

  const isOtherBrand = selectedBrand === 'Otra Marca';
  const isOtherModel = selectedModel === 'Otro Modelo';

  return (
    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm space-y-4">
      {/* Encabezado */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">
            1
          </span>
          Carga de Vehículo (Sin Patente)
        </h2>
        <span className="text-[10px] text-blue-400 font-semibold bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
          Flujo en 3 Pasos
        </span>
      </div>

      {/* PASO 1 (Categoría): 3 Grandes Tarjetas / Botones */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-slate-800 text-blue-400 font-extrabold flex items-center justify-center text-[10px]">
              1
            </span>
            Paso 1: Seleccioná la Categoría
          </label>
          <span className="text-[10px] text-slate-400">Tarifa fija</span>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-0.5">
          {(Object.keys(VEHICLE_CONFIG) as VehicleType[]).map((type) => {
            const cfg = VEHICLE_CONFIG[type];
            const isSelected = selectedType === type;

            return (
              <button
                key={type}
                type="button"
                onClick={() => handleCategoryClick(type)}
                className={`p-3 rounded-2xl border text-center transition-all relative flex flex-col items-center justify-between min-h-[95px] ${
                  isSelected
                    ? 'border-blue-500 bg-blue-500/15 text-white ring-2 ring-blue-500/40 shadow-lg shadow-blue-500/10'
                    : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700 hover:bg-slate-950'
                }`}
              >
                <div className="text-2xl mb-1">{cfg.icon}</div>
                <div>
                  <div className="text-xs font-bold leading-tight">{cfg.label}</div>
                  <div className="text-[11px] text-blue-400 font-black mt-1">
                    ${cfg.price.toLocaleString('es-AR')}
                  </div>
                </div>

                {isSelected && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* PASO 2 (Marca): Menú desplegable dependiente de la categoría */}
      <div className="space-y-2 pt-2 border-t border-slate-800">
        <label
          htmlFor="vehicle-brand-select"
          className="text-[11px] text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1.5"
        >
          <span className="w-4 h-4 rounded-full bg-slate-800 text-blue-400 font-extrabold flex items-center justify-center text-[10px]">
            2
          </span>
          Paso 2: Seleccioná la Marca ({VEHICLE_CONFIG[selectedType].label})
        </label>

        <div className="relative">
          <select
            id="vehicle-brand-select"
            value={selectedBrand}
            onChange={(e) => handleBrandSelect(e.target.value)}
            className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-medium focus:outline-none focus:border-blue-500 appearance-none cursor-pointer pr-10"
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
                {brandName === 'Otra Marca' ? '✨ Otra Marca (Escribir manualmente)' : brandName}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Si elige 'Otra Marca' en Paso 2: Aparecen 2 inputs para Marca y Modelo manualmente */}
        {isOtherBrand && (
          <div className="p-3.5 rounded-xl bg-slate-950 border border-amber-500/40 space-y-2.5 animate-in fade-in slide-in-from-top-2">
            <p className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
              <span>✏️</span> Ingresá los datos de tu vehículo ({VEHICLE_CONFIG[selectedType].label}):
            </p>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                  Marca
                </label>
                <input
                  type="text"
                  required
                  value={customBrandText}
                  onChange={(e) => onCustomBrandTextChange(e.target.value)}
                  placeholder="Ej: Citroën, Audi, BMW"
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                  Modelo
                </label>
                <input
                  type="text"
                  required
                  value={customModelText}
                  onChange={(e) => onCustomModelTextChange(e.target.value)}
                  placeholder="Ej: C3, A3, Serie 1"
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-400">
              Se tarifará como categoría <strong>{VEHICLE_CONFIG[selectedType].label}</strong> (${VEHICLE_CONFIG[selectedType].price.toLocaleString('es-AR')}).
            </p>
          </div>
        )}
      </div>

      {/* PASO 3 (Modelo): Menú desplegable dependiente de la Marca (solo si eligió una marca conocida) */}
      {!isOtherBrand && selectedBrand && (
        <div className="space-y-2 pt-2 border-t border-slate-800 animate-in fade-in">
          <label
            htmlFor="vehicle-model-select"
            className="text-[11px] text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1.5"
          >
            <span className="w-4 h-4 rounded-full bg-slate-800 text-blue-400 font-extrabold flex items-center justify-center text-[10px]">
              3
            </span>
            Paso 3: Seleccioná el Modelo de {selectedBrand}
          </label>

          <div className="relative">
            <select
              id="vehicle-model-select"
              value={selectedModel}
              onChange={(e) => onModelChange(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-medium focus:outline-none focus:border-blue-500 appearance-none cursor-pointer pr-10"
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
                  {modelName === 'Otro Modelo' ? '✨ Otro Modelo (Escribir manualmente)' : modelName}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Si elige 'Otro Modelo' en Paso 3: Aparece 1 input para escribir el modelo */}
          {isOtherModel && (
            <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/40 space-y-1.5 animate-in fade-in slide-in-from-top-2">
              <label className="text-[10px] text-amber-400 font-bold uppercase flex items-center gap-1">
                <span>✏️</span> Escribí el modelo de tu {selectedBrand}:
              </label>
              <input
                type="text"
                required
                autoFocus
                value={customModelText}
                onChange={(e) => onCustomModelTextChange(e.target.value)}
                placeholder={`Ej: Modelo específico de ${selectedBrand}`}
                className="w-full px-3 py-2 text-xs rounded-lg bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
