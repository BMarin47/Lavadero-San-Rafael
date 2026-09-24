'use client';

import React, { useState, useEffect } from 'react';
import { SlotAvailability } from '@/lib/services/schedule.service';
import { Clock, Calendar, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';

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
    onSlotChange(null);

    try {
      const res = await fetch(`/api/schedule/availability?date=${selectedDate}`);
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // Respuesta no JSON
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
    <div className="rounded-3xl bg-slate-900/50 backdrop-blur-xl border border-white/[0.08] p-5 sm:p-7 shadow-xl shadow-black/20 space-y-6 transition-all">
      {/* Header del Paso */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white flex items-center justify-center text-xs font-black shadow-lg shadow-cyan-500/25">
            03
          </span>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
              Fecha y Horario de Atención
            </h2>
            <p className="text-xs text-slate-400">
              Seleccioná el día y bloque horario para tu reserva
            </p>
          </div>
        </div>
        <span className="text-[11px] font-semibold text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
          Paso 3 de 4
        </span>
      </div>

      {/* Selector de Fecha */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Días Disponibles
          </label>
          <span className="text-[11px] text-slate-400">San Rafael (Mendoza)</span>
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
                className={`p-3 rounded-2xl border text-center transition-all duration-200 relative cursor-pointer ${
                  isSelected
                    ? 'border-cyan-500/60 bg-gradient-to-b from-cyan-500/20 via-blue-600/15 to-slate-900/70 text-white ring-1 ring-cyan-500/40 shadow-lg shadow-cyan-500/10 scale-[1.03]'
                    : d.isSunday
                    ? 'border-white/[0.03] bg-slate-950/20 text-slate-600 cursor-not-allowed opacity-40'
                    : 'border-white/[0.06] bg-slate-950/50 text-slate-300 hover:border-white/[0.14] hover:bg-slate-900/40 hover:text-white'
                }`}
              >
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  {d.dayName}
                </div>
                <div className="text-lg font-black my-0.5 text-white">
                  {d.dayNumber}
                </div>
                <div
                  className={`text-[9px] font-bold uppercase tracking-wider ${
                    d.isSunday
                      ? 'text-rose-400/70'
                      : isSelected
                      ? 'text-cyan-300 font-extrabold'
                      : 'text-slate-500'
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
        <div className="py-8 flex flex-col items-center justify-center text-xs text-slate-300 space-y-2.5 bg-slate-950/40 rounded-2xl border border-white/[0.06]">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
          <span className="font-medium text-slate-300">Consultando disponibilidad en tiempo real...</span>
        </div>
      )}

      {/* Error de Conexión */}
      {!loading && fetchError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-200 text-xs flex items-start justify-between gap-3 backdrop-blur-md">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-rose-100">Disponibilidad temporalmente no accesible</p>
              <p className="text-[11px] text-rose-300/80 mt-0.5">{fetchError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchAvailability()}
            className="px-3 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 text-rose-100 rounded-xl text-xs font-semibold tracking-wide border border-rose-500/40 transition-all shrink-0 cursor-pointer active:scale-95"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Alerta de Cierre */}
      {!loading && !fetchError && !isOpen && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs flex items-start gap-3 backdrop-blur-md">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-100">Día no disponible para atención</p>
            <p className="text-xs text-amber-300/80 mt-0.5">{reasonClosed}</p>
          </div>
        </div>
      )}

      {/* Grilla de Bloques Horarios */}
      {!loading && !fetchError && isOpen && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Turnos Disponibles
            </label>
            <span className="text-[11px] text-slate-400 font-medium">Actualización automática</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  className={`p-4 rounded-2xl border text-left flex items-center justify-between transition-all duration-200 cursor-pointer ${
                    !slot.isAvailable
                      ? 'opacity-40 bg-slate-950/30 border-white/[0.04] cursor-not-allowed text-slate-500'
                      : isSelected
                      ? 'border-cyan-500/60 bg-gradient-to-r from-cyan-500/15 via-blue-600/10 to-slate-900/70 text-white ring-1 ring-cyan-500/40 shadow-lg shadow-cyan-500/10'
                      : 'border-white/[0.08] bg-slate-950/50 text-slate-200 hover:border-white/[0.14] hover:bg-slate-900/40'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="text-sm font-bold flex items-center gap-2 text-white">
                      <Clock className="w-4 h-4 text-cyan-400" />
                      <span>{slot.startTime} a {slot.endTime} hs</span>
                    </div>
                    <div className="text-[11px] text-slate-400 pl-6">
                      {slot.isAvailable
                        ? `${slot.remainingCapacity} ${
                            slot.remainingCapacity === 1 ? 'cupo disponible' : 'cupos disponibles'
                          }`
                        : 'Cupo completo'}
                    </div>
                  </div>

                  <span
                    className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider shrink-0 ${
                      !slot.isAvailable
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                        : isSelected
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm'
                        : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
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
