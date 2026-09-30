'use client';

import React, { useState, useEffect } from 'react';
import { SlotAvailability } from '@/lib/services/schedule.service';
import { Clock, Calendar, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';

interface CalendarSlotPickerProps {
  selectedDate: string; // YYYY-MM-DD
  onDateChange: (date: string) => void;
  selectedSlot: { startTime: string; endTime: string } | null;
  onSlotChange: (slot: { startTime: string; endTime: string } | null) => void;
  compact?: boolean;
}

/**
 * Determina si un bloque horario ya transcurrió en comparación con la fecha y hora actuales del navegador.
 */
export const isSlotPast = (startTime: string, dateString: string): boolean => {
  if (!dateString || !startTime) return false;

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  // Si la fecha seleccionada es anterior a hoy
  if (dateString < todayStr) return true;
  // Si la fecha seleccionada es posterior a hoy
  if (dateString > todayStr) return false;

  // Si el día seleccionado es igual al día de HOY, comparar el horario de inicio con la hora actual
  const [slotHStr, slotMStr] = startTime.split(':');
  const slotH = parseInt(slotHStr, 10);
  const slotM = parseInt(slotMStr || '0', 10);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const slotMinutes = slotH * 60 + slotM;

  return slotMinutes <= currentMinutes;
};

export const CalendarSlotPicker: React.FC<CalendarSlotPickerProps> = ({
  selectedDate,
  onDateChange,
  selectedSlot,
  onSlotChange,
  compact = false,
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
        // Auto seleccionar el primer slot disponible que NO haya transcurrido
        const firstAvailable = data?.slots?.find(
          (s: SlotAvailability) => s.isAvailable && !isSlotPast(s.startTime, selectedDate)
        );
        if (firstAvailable) {
          onSlotChange({
            startTime: firstAvailable.startTime,
            endTime: firstAvailable.endTime,
          });
        } else {
          onSlotChange(null);
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

  // Si el turno seleccionado quedó en el pasado, deseleccionarlo
  useEffect(() => {
    if (selectedSlot && isSlotPast(selectedSlot.startTime, selectedDate)) {
      onSlotChange(null);
    }
  }, [selectedDate, selectedSlot, onSlotChange]);

  // Forzar actualización periódica cada 30 segundos para reflejar turnos que van pasando
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  if (compact) {
    return (
      <div className="space-y-3">
        {/* Carrusel Horizontal Swipeable de Días */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-cyan-400" />
              <span>Días Disponibles</span>
            </span>
            <span className="text-[10px] text-slate-500">Deslizá ↔</span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar snap-x -mx-0.5 px-0.5">
            {nextDays.map((d) => {
              const isSelected = selectedDate === d.dateString;

              return (
                <button
                  key={d.dateString}
                  type="button"
                  disabled={d.isSunday}
                  onClick={() => onDateChange(d.dateString)}
                  className={`min-w-[58px] py-2 px-1.5 rounded-xl border text-center transition-all duration-200 shrink-0 snap-start cursor-pointer ${
                    isSelected
                      ? 'border-cyan-400 bg-cyan-500/20 text-white ring-1 ring-cyan-400/40 shadow-sm'
                      : d.isSunday
                      ? 'border-white/[0.04] bg-slate-950/30 text-slate-600 cursor-not-allowed opacity-35'
                      : 'border-white/[0.08] bg-slate-950/60 text-slate-300 hover:border-cyan-400/30 hover:bg-slate-900/50'
                  }`}
                >
                  <div className="text-[9px] uppercase font-bold text-slate-400">
                    {d.dayName}
                  </div>
                  <div className="text-base font-black my-0.5 text-white">
                    {d.dayNumber}
                  </div>
                  <div
                    className={`text-[8px] font-bold uppercase tracking-wider py-0.5 rounded-md ${
                      d.isSunday
                        ? 'text-rose-400/70'
                        : isSelected
                        ? 'text-cyan-300 font-black'
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
          <div className="py-4 flex items-center justify-center gap-2 text-xs text-slate-300 bg-slate-950/50 rounded-xl border border-white/[0.07]">
            <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
            <span>Consultando horarios...</span>
          </div>
        )}

        {/* Error de Conexión */}
        {!loading && fetchError && (
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 truncate">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="truncate">{fetchError}</span>
            </div>
            <button
              type="button"
              onClick={() => fetchAvailability()}
              className="px-2 py-1 bg-rose-600/30 text-rose-100 rounded-lg text-[10px] font-bold shrink-0"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Alerta de Cierre */}
        {!loading && !fetchError && !isOpen && (
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{reasonClosed || 'Cerrado para atención este día.'}</span>
          </div>
        )}

        {/* Grilla Compacta de Bloques Horarios (2 columnas) */}
        {!loading && !fetchError && isOpen && (
          <div className="space-y-1.5 pt-1 border-t border-white/[0.06]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-cyan-400" />
                <span>Horarios Disponibles</span>
              </span>
              <span className="text-[10px] text-slate-500 font-medium">Cupos en vivo</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 max-h-[160px] overflow-y-auto pr-1">
              {slots.map((slot) => {
                const isPast = isSlotPast(slot.startTime, selectedDate);
                const isDisabled = !slot.isAvailable || isPast;
                const isSelected =
                  !isDisabled &&
                  selectedSlot?.startTime === slot.startTime &&
                  selectedSlot?.endTime === slot.endTime;

                return (
                  <button
                    key={`${slot.startTime}-${slot.endTime}`}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      if (isDisabled) return;
                      onSlotChange({
                        startTime: slot.startTime,
                        endTime: slot.endTime,
                      });
                    }}
                    className={`py-2 px-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                      isDisabled
                        ? 'opacity-35 bg-slate-950/40 border-white/[0.04] cursor-not-allowed text-slate-500'
                        : isSelected
                        ? 'border-cyan-400 bg-cyan-500/20 text-white ring-1 ring-cyan-400/50 shadow-sm cursor-pointer'
                        : 'border-white/[0.08] bg-slate-950/60 text-slate-200 hover:border-cyan-400/30 cursor-pointer'
                    }`}
                  >
                    <div className="min-w-0 pr-1">
                      <div className="text-xs font-bold text-white whitespace-nowrap">
                        {slot.startTime} a {slot.endTime}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {isPast ? 'Transcurrido' : slot.isAvailable ? `${slot.remainingCapacity} cupos` : 'Lleno'}
                      </div>
                    </div>

                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase shrink-0 ${
                        isSelected
                          ? 'bg-cyan-400 text-slate-950'
                          : isPast
                          ? 'bg-slate-800 text-slate-500'
                          : !slot.isAvailable
                          ? 'bg-rose-500/20 text-rose-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {isSelected ? '✓' : isPast ? 'Off' : slot.isAvailable ? 'Disp.' : 'Lleno'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="luxury-glass rounded-3xl p-6 sm:p-8 space-y-7 transition-all duration-300">
      {/* Header de Sección */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shadow-md shadow-cyan-500/10">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
              Fecha y Horario de Atención
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Seleccioná el día y bloque horario para tu reserva
            </p>
          </div>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-3.5 py-1.5 rounded-full border border-cyan-500/25 shadow-sm">
          En vivo
        </span>
      </div>

      {/* Selector de Fecha */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
            Días Disponibles
          </label>
          <span className="text-[11px] text-slate-400 font-medium">San Rafael, Mendoza</span>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
          {nextDays.map((d) => {
            const isSelected = selectedDate === d.dateString;

            return (
              <button
                key={d.dateString}
                type="button"
                disabled={d.isSunday}
                onClick={() => onDateChange(d.dateString)}
                className={`p-3.5 rounded-2xl border text-center transition-all duration-300 relative cursor-pointer ${
                  isSelected
                    ? 'border-cyan-400 bg-gradient-to-b from-cyan-500/25 via-blue-600/15 to-slate-950/80 text-white ring-1 ring-cyan-400/50 shadow-xl shadow-cyan-500/20 scale-[1.04]'
                    : d.isSunday
                    ? 'border-white/[0.04] bg-slate-950/30 text-slate-600 cursor-not-allowed opacity-40'
                    : 'border-white/[0.08] bg-slate-950/60 text-slate-300 hover:border-cyan-400/40 hover:bg-slate-900/60 hover:text-white hover:scale-[1.02]'
                }`}
              >
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  {d.dayName}
                </div>
                <div className="text-xl font-black my-1 text-white">
                  {d.dayNumber}
                </div>
                <div
                  className={`text-[9px] font-bold uppercase tracking-wider py-0.5 rounded-md ${
                    d.isSunday
                      ? 'text-rose-400/70'
                      : isSelected
                      ? 'text-cyan-300 font-black'
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
        <div className="py-9 flex flex-col items-center justify-center text-xs text-slate-300 space-y-3 bg-slate-950/50 rounded-2xl border border-white/[0.07]">
          <Loader2 className="w-7 h-7 text-cyan-400 animate-spin" />
          <span className="font-semibold text-slate-300">Consultando disponibilidad en tiempo real...</span>
        </div>
      )}

      {/* Error de Conexión */}
      {!loading && fetchError && (
        <div className="p-4 sm:p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-start justify-between gap-3.5 backdrop-blur-md">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-rose-100">Disponibilidad no accesible</p>
              <p className="text-[11px] text-rose-300/90 mt-0.5">{fetchError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchAvailability()}
            className="px-3.5 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 text-rose-100 rounded-xl text-xs font-bold tracking-wide border border-rose-500/40 transition-all shrink-0 cursor-pointer active:scale-95"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Alerta de Cierre */}
      {!loading && !fetchError && !isOpen && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-3.5 backdrop-blur-md">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-100">Día no disponible para atención</p>
            <p className="text-xs text-amber-300/90 mt-0.5">{reasonClosed}</p>
          </div>
        </div>
      )}

      {/* Grilla de Bloques Horarios */}
      {!loading && !fetchError && isOpen && (
        <div className="space-y-3.5 pt-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
              Turnos Disponibles
            </label>
            <span className="text-[11px] text-slate-400 font-medium">Actualización automática</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {slots.map((slot) => {
              const isPast = isSlotPast(slot.startTime, selectedDate);
              const isDisabled = !slot.isAvailable || isPast;
              const isSelected =
                !isDisabled &&
                selectedSlot?.startTime === slot.startTime &&
                selectedSlot?.endTime === slot.endTime;

              return (
                <button
                  key={`${slot.startTime}-${slot.endTime}`}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    if (isDisabled) return;
                    onSlotChange({
                      startTime: slot.startTime,
                      endTime: slot.endTime,
                    });
                  }}
                  className={`p-4 sm:p-5 rounded-2xl border text-left flex items-center justify-between transition-all duration-300 ${
                    isDisabled
                      ? 'opacity-40 bg-slate-950/40 border-white/[0.04] cursor-not-allowed text-slate-500 select-none'
                      : isSelected
                      ? 'border-cyan-400 bg-gradient-to-r from-cyan-500/20 via-blue-600/10 to-slate-900/80 text-white ring-1 ring-cyan-400/50 shadow-xl shadow-cyan-500/15 scale-[1.01] cursor-pointer'
                      : 'border-white/[0.08] bg-slate-950/60 text-slate-200 hover:border-cyan-400/40 hover:bg-slate-900/50 hover:scale-[1.005] cursor-pointer'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="text-sm sm:text-base font-extrabold flex items-center gap-2 text-white">
                      <Clock className={`w-4 h-4 ${isDisabled ? 'text-slate-500' : 'text-cyan-400'}`} />
                      <span className={isDisabled ? 'text-slate-400' : 'text-white'}>
                        {slot.startTime} a {slot.endTime} hs
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 pl-6">
                      {isPast
                        ? 'No disponible (horario ya transcurrido)'
                        : slot.isAvailable
                        ? `${slot.remainingCapacity} ${
                            slot.remainingCapacity === 1 ? 'cupo disponible' : 'cupos disponibles'
                          }`
                        : 'Cupo completo'}
                    </div>
                  </div>

                  <span
                    className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-wider shrink-0 shadow-sm ${
                      isPast
                        ? 'bg-slate-800/70 text-slate-400 border border-slate-700/60'
                        : !slot.isAvailable
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                        : isSelected
                        ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-black'
                        : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                    }`}
                  >
                    {isSelected
                      ? '✓ Seleccionado'
                      : isPast
                      ? 'No disponible'
                      : slot.isAvailable
                      ? 'Disponible'
                      : 'Lleno'}
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
