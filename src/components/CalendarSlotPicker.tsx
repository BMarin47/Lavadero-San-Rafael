'use client';

import React, { useState, useEffect } from 'react';
import { SlotAvailability } from '@/lib/services/schedule.service';

interface CalendarSlotPickerProps {
  selectedDate: string; // YYYY-MM-DD
  onDateChange: (date: string) => void;
  selectedSlot: { startTime: string; endTime: string } | null;
  onSlotChange: (slot: { startTime: string; endTime: string } | null) => void;
}

export const CalendarSlotPicker: React.FC<CalendarSlotPickerProps> = ({
  selectedDate,
  onDateChange,
  selectedSlot,
  onSlotChange,
}) => {
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [reasonClosed, setReasonClosed] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotAvailability[]>([]);

  // Generar los próximos 8 días a partir de hoy
  const nextDays = React.useMemo(() => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 8; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);

      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateString = `${yyyy}-${mm}-${dd}`;

      days.push({
        dateString,
        dayName: d.toLocaleDateString('es-AR', { weekday: 'short' }),
        dayNumber: d.getDate(),
        isSunday: d.getDay() === 0,
      });
    }
    return days;
  }, []);

  // Consultar disponibilidad al cambiar de fecha
  const fetchAvailability = React.useCallback(async () => {
    if (!selectedDate) return;

    setLoading(true);
    setFetchError(null);
    setReasonClosed(null);
    onSlotChange(null); // Reset del slot al cambiar fecha

    try {
      const res = await fetch(`/api/schedule/availability?date=${selectedDate}`);
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // Respuesta no JSON (ej. 500 HTML)
      }

      if (!res.ok || (data && data.error)) {
        const errorMsg =
          data?.error || `Error en el servidor (${res.status}). No fue posible consultar disponibilidad.`;
        setFetchError(errorMsg);
        setSlots([]);
        return;
      }

      if (!data?.isOpen) {
        setIsOpen(false);
        setReasonClosed(data?.reasonClosed || 'Cerrado por el lavadero.');
        setSlots([]);
      } else {
        setIsOpen(true);
        setSlots(data?.slots || []);
        // Auto seleccionar el primer slot disponible
        const firstAvailable = data?.slots?.find((s: SlotAvailability) => s.isAvailable);
        if (firstAvailable) {
          onSlotChange({
            startTime: firstAvailable.startTime,
            endTime: firstAvailable.endTime,
          });
        }
      }
    } catch (err: any) {
      setFetchError('No fue posible conectar con el servicio de disponibilidad. Por favor, reintentá.');
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, onSlotChange]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 p-5 md:p-6 rounded-3xl shadow-xl shadow-black/20 space-y-5 transition-all">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <h2 className="text-xs md:text-sm font-extrabold uppercase tracking-wider text-slate-100 flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 text-white flex items-center justify-center text-xs font-black shadow-md shadow-blue-500/30">
            3
          </span>
          Fecha y Turno Horario
        </h2>
        <span className="text-[11px] text-cyan-400 font-bold bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
          Paso 3 de 4
        </span>
      </div>

      {/* Selector de Fecha (Próximos días) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-slate-200 font-bold uppercase tracking-wider">
            Seleccioná el día:
          </label>
          <span className="text-[11px] text-slate-400 font-mono">San Rafael (UTC-3)</span>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {nextDays.map((d) => {
            const isSelected = selectedDate === d.dateString;

            return (
              <button
                key={d.dateString}
                type="button"
                disabled={d.isSunday}
                onClick={() => onDateChange(d.dateString)}
                className={`p-3 rounded-2xl border text-center transition-all duration-200 relative ${
                  isSelected
                    ? 'border-cyan-400 bg-gradient-to-b from-blue-600/25 to-cyan-600/15 text-white ring-2 ring-cyan-400/40 shadow-lg shadow-cyan-500/15 scale-[1.03]'
                    : d.isSunday
                    ? 'border-slate-800/40 bg-slate-950/30 text-slate-600 cursor-not-allowed opacity-50'
                    : 'border-slate-800/80 bg-slate-950/70 text-slate-300 hover:border-slate-700 hover:bg-slate-900/60 hover:text-white'
                }`}
              >
                <div className="text-[10px] uppercase font-bold tracking-wider">
                  {d.dayName}
                </div>
                <div className="text-base sm:text-lg font-black my-0.5">{d.dayNumber}</div>
                <div
                  className={`text-[9px] font-bold uppercase tracking-wider rounded-md py-0.5 ${
                    d.isSunday
                      ? 'text-red-400/80'
                      : isSelected
                      ? 'text-cyan-300'
                      : 'text-slate-400'
                  }`}
                >
                  {d.isSunday ? 'Cerrado' : 'Abierto'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Estado de carga */}
      {loading && (
        <div className="py-8 flex flex-col items-center justify-center text-xs text-slate-300 space-y-2.5 bg-slate-950/40 rounded-2xl border border-slate-800/50">
          <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="font-medium">Consultando disponibilidad en vivo de los 3 boxes...</span>
        </div>
      )}

      {/* Error de Conexión / Consulta de API */}
      {!loading && fetchError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-start justify-between gap-3 backdrop-blur-md">
          <div className="flex items-start gap-2.5">
            <span className="text-xl leading-none">⚠️</span>
            <div>
              <p className="font-bold text-rose-100">Disponibilidad no accesible</p>
              <p className="text-[11px] text-rose-300/80 mt-0.5">{fetchError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchAvailability()}
            className="px-3 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 text-rose-100 rounded-xl text-xs font-semibold tracking-wide border border-rose-500/40 transition-all shrink-0 active:scale-95"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Alerta de Cierre (Feriados o Domingos) */}
      {!loading && !fetchError && !isOpen && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-3 backdrop-blur-md">
          <span className="text-xl leading-none">⚠️</span>
          <div>
            <p className="font-bold text-amber-100">Día no disponible para atención</p>
            <p className="text-xs text-amber-300/80 mt-0.5">{reasonClosed}</p>
          </div>
        </div>
      )}

      {/* Grilla de Bloques Horarios Oficiales */}
      {!loading && !fetchError && isOpen && (
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-200 font-bold uppercase tracking-wider">
              Bloques horarios disponibles:
            </label>
            <span className="text-[11px] text-slate-400">Capacidad máx. 3 boxes/turno</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {slots.map((slot) => {
              const isSelected =
                selectedSlot?.startTime === slot.startTime &&
                selectedSlot?.endTime === slot.endTime;

              return (
                <button
                  key={`${slot.startTime}-${slot.endTime}`}
                  type="button"
                  disabled={!slot.isAvailable}
                  onClick={() =>
                    onSlotChange({
                      startTime: slot.startTime,
                      endTime: slot.endTime,
                    })
                  }
                  className={`p-3.5 sm:p-4 rounded-2xl border text-left flex items-center justify-between transition-all duration-200 ${
                    !slot.isAvailable
                      ? 'opacity-40 bg-slate-950/40 border-slate-900 cursor-not-allowed text-slate-500'
                      : isSelected
                      ? 'border-cyan-400 bg-gradient-to-r from-blue-600/25 via-cyan-600/15 to-slate-900/60 text-white ring-2 ring-cyan-400/40 shadow-lg shadow-cyan-500/15'
                      : 'border-slate-800/80 bg-slate-950/70 text-slate-200 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  <div>
                    <div className="text-xs sm:text-sm font-extrabold flex items-center gap-1.5">
                      <span>⏰</span>
                      <span>{slot.startTime} a {slot.endTime} hs</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      {slot.isAvailable
                        ? `${slot.remainingCapacity} ${
                            slot.remainingCapacity === 1 ? 'box disponible' : 'boxes disponibles'
                          }`
                        : 'Cupo completo'}
                    </div>
                  </div>

                  <span
                    className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                      !slot.isAvailable
                        ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                        : isSelected
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md'
                        : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {isSelected ? '✓ Seleccionado' : slot.isAvailable ? 'Disponible' : 'Lleno'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
