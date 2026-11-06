'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SlotAvailability,
  MAX_CAPACITY_PER_SLOT,
  normalizeVehicleType,
  areTimeSlotsOverlapping,
  getAllowedSlotsForVehicle,
  getVehicleDurationHours,
} from '@/lib/config';
import type { VehicleType } from '@/components/VehicleSelector';
import { Clock, Calendar, AlertCircle, Loader2 } from 'lucide-react';

interface CalendarSlotPickerProps {
  selectedDate: string; // YYYY-MM-DD
  onDateChange: (date: string) => void;
  selectedSlot: { startTime: string; endTime: string } | null;
  onSlotChange: (slot: { startTime: string; endTime: string } | null) => void;
  onSlotSelect?: (slot: { startTime: string; endTime: string }) => void;
  contactRef?: React.RefObject<HTMLDivElement | null>;
  vehicleType?: VehicleType | string;
  compact?: boolean;
}

/**
 * Fechas bloqueadas por excepción específica (ej. Jueves 12 de noviembre de 2026).
 * Todos los días laborables habituales (lunes a sábados) están abiertos salvo estas excepciones.
 */
export const BLOCKED_BOOKING_DATES: readonly string[] = [
  '2026-11-12', // Jueves 12 de noviembre de 2026
];

export const isBlockedDate = (dateString: string): boolean => {
  if (!dateString) return false;
  return BLOCKED_BOOKING_DATES.includes(dateString.trim());
};

export const shouldDisableDate = (dateString: string): boolean => {
  if (!dateString) return true;
  const trimmed = dateString.trim();
  const parts = trimmed.split('-').map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    const dateObj = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
    if (dateObj.getUTCDay() === 0) return true; // Domingos cerrado
  }
  return isBlockedDate(trimmed);
};

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
  onSlotSelect,
  contactRef,
  vehicleType = 'CAR',
  compact = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [reasonClosed, setReasonClosed] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotAvailability[]>([]);
  const isFetchingRef = useRef<boolean>(false);

  const handleDaySelect = (dateString: string, isDisabled: boolean) => {
    // Bloquear clic en otros días o doble clic mientras la API está cargando horarios
    if (isDisabled || loading || isFetchingRef.current) return;
    if (dateString === selectedDate && !fetchError) return;

    isFetchingRef.current = true;
    setLoading(true);
    setFetchError(null);
    onDateChange(dateString);
    onSlotChange(null);
  };

  const durationHours = getVehicleDurationHours(vehicleType);

  // Determinar los horarios disponibles condicionalmente según el tipo de vehículo seleccionado:
  // - "Auto" (CAR) / "SUV": turnos de 2 horas
  // - "Camioneta" (PICKUP): turnos de 3 horas ("09:00 a 12:00" y "16:00 a 19:00")
  // - "Camioneta Grande" (LARGE_PICKUP) / "Trafic / Utilitario" (UTILITY): turnos de 4 horas ("09:00 a 13:00" y "16:00 a 20:00")
  // En todos los casos se asegura validación bidireccional de solapamiento cruzado (Time Overlap).
  const displayedSlots = React.useMemo<SlotAvailability[]>(() => {
    let dayOfWeek: number | undefined = undefined;
    if (selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      const parts = selectedDate.split('-').map(Number);
      const dateObj = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
      dayOfWeek = dateObj.getUTCDay();
    }

    const expectedSlots = getAllowedSlotsForVehicle(vehicleType, dayOfWeek);

    // 1. Si la API ya trajo los turnos que corresponden a esta categoría, usarlos directamente
    const apiMatchingSlots = slots.filter((s) =>
      expectedSlots.some(
        (exp) => exp.startTime === s.startTime && exp.endTime === s.endTime
      )
    );

    if (apiMatchingSlots.length === expectedSlots.length && apiMatchingSlots.length > 0) {
      return apiMatchingSlots;
    }

    // 2. Si todavía no llegaron de la API o hubo un cambio de categoría inmediato,
    // proyectar los bloques correspondientes y validar solapamiento cruzado con 'slots'
    return expectedSlots.map((targetSlot) => {
      const targetStr = `${targetSlot.startTime} a ${targetSlot.endTime}`;
      const hasOverlapConflict = slots.some(
        (s) =>
          !s.isAvailable &&
          areTimeSlotsOverlapping(`${s.startTime} a ${s.endTime}`, targetStr)
      );
      return {
        startTime: targetSlot.startTime,
        endTime: targetSlot.endTime,
        totalCapacity: MAX_CAPACITY_PER_SLOT,
        bookedCount: hasOverlapConflict ? 1 : 0,
        remainingCapacity: hasOverlapConflict ? 0 : MAX_CAPACITY_PER_SLOT,
        isAvailable: !hasOverlapConflict,
      };
    });
  }, [slots, vehicleType, selectedDate]);

  // Generar los días del calendario habilitando lunes a sábados como ABIERTO, domingos como CERRADO y bloqueando 2026-11-12 como CERRADO
  const nextDays = React.useMemo(() => {
    const days = [];
    const today = new Date();
    const minEndDate = new Date(2026, 10, 14); // Asegurar cobertura de la ventana de días (incluyendo 12/11)
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diffDays = Math.ceil((minEndDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const totalDays = Math.max(9, diffDays);

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);

      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateString = `${yyyy}-${mm}-${dd}`;
      const isSunday = d.getDay() === 0;
      const isBlocked = isBlockedDate(dateString);
      const isOpenDay = !isSunday && !isBlocked;
      const isDisabled = !isOpenDay;

      days.push({
        dateString,
        dayName: d.toLocaleDateString('es-AR', { weekday: 'short' }),
        dayNumber: d.getDate(),
        isSunday,
        isBlocked,
        isOpen: isOpenDay,
        isDisabled,
      });
    }
    return days;
  }, []);

  // Consultar disponibilidad al cambiar de fecha o categoría de vehículo
  const fetchAvailability = React.useCallback(async () => {
    if (!selectedDate) {
      isFetchingRef.current = false;
      setLoading(false);
      return;
    }
    if (shouldDisableDate(selectedDate)) {
      isFetchingRef.current = false;
      setLoading(false);
      setIsOpen(false);
      setReasonClosed('El lavadero permanece cerrado en esta fecha.');
      setSlots([]);
      onSlotChange(null);
      return;
    }

    isFetchingRef.current = true;
    setLoading(true);
    setFetchError(null);
    setReasonClosed(null);
    onSlotChange(null);

    try {
      const normalizedVehicle = normalizeVehicleType(vehicleType);
      const queryParams = new URLSearchParams({
        date: selectedDate,
        vehicleType: normalizedVehicle,
      });
      const res = await fetch(`/api/schedule/availability?${queryParams.toString()}`, {
        cache: 'no-store',
      });
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
      }
    } catch (err: any) {
      setFetchError('No fue posible conectar con el servicio de disponibilidad. Por favor, reintentá.');
      setSlots([]);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, [selectedDate, vehicleType, onSlotChange]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  // Si el turno seleccionado quedó en el pasado o se agotó, deseleccionarlo
  useEffect(() => {
    if (!selectedSlot) return;
    if (isSlotPast(selectedSlot.startTime, selectedDate)) {
      onSlotChange(null);
      return;
    }
    const matched = displayedSlots.find(
      (s) => s.startTime === selectedSlot.startTime && s.endTime === selectedSlot.endTime
    );
    if (!matched || !matched.isAvailable) {
      onSlotChange(null);
    }
  }, [selectedDate, selectedSlot, displayedSlots, onSlotChange]);

  // Forzar actualización periódica cada 30 segundos para reflejar turnos que van pasando o agotándose en vivo
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(async () => {
      setTick((t) => t + 1);
      if (selectedDate) {
        try {
          const normalizedVehicle = normalizeVehicleType(vehicleType);
          const queryParams = new URLSearchParams({
            date: selectedDate,
            vehicleType: normalizedVehicle,
          });
          const res = await fetch(`/api/schedule/availability?${queryParams.toString()}`, {
            cache: 'no-store',
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.isOpen && Array.isArray(data.slots)) {
              setSlots(data.slots);
            }
          }
        } catch {
          // Silencioso en refresco de fondo
        }
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [selectedDate, vehicleType]);

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
              const isDisabled = d.isDisabled;
              const isSelected = !isDisabled && selectedDate === d.dateString;
              const isButtonDisabled = isDisabled || loading;

              return (
                <motion.button
                  key={d.dateString}
                  type="button"
                  disabled={isButtonDisabled}
                  aria-disabled={isButtonDisabled}
                  whileHover={!isButtonDisabled ? { scale: 1.05, y: -2 } : undefined}
                  whileTap={!isButtonDisabled ? { scale: 0.95 } : undefined}
                  onClick={() => handleDaySelect(d.dateString, isDisabled)}
                  className={`min-w-[58px] py-2 px-1.5 rounded-xl border text-center transition-colors duration-200 shrink-0 snap-start ${
                    isSelected
                      ? 'border-cyan-400 bg-gradient-to-b from-cyan-500/25 to-blue-600/15 text-white ring-1 ring-cyan-400/50 shadow-md shadow-cyan-500/20 cursor-pointer disabled:cursor-wait'
                      : isDisabled
                      ? 'border-white/[0.04] bg-slate-950/30 text-slate-600 cursor-not-allowed opacity-35 select-none'
                      : loading
                      ? 'border-white/[0.06] bg-slate-950/40 text-slate-500 cursor-wait opacity-50 select-none'
                      : 'border-white/[0.08] bg-slate-950/60 text-slate-300 hover:border-cyan-400/30 hover:bg-slate-900/50 cursor-pointer'
                  }`}
                >
                  <div className="text-[9px] uppercase font-bold text-slate-400">
                    {d.dayName}
                  </div>
                  <div className={`text-base font-black my-0.5 ${isDisabled ? 'text-slate-500' : 'text-white'}`}>
                    {d.dayNumber}
                  </div>
                  <div
                    className={`text-[8px] font-bold uppercase tracking-wider py-0.5 rounded-md flex items-center justify-center gap-0.5 ${
                      isDisabled
                        ? 'text-rose-400/70'
                        : isSelected
                        ? 'text-cyan-300 font-black'
                        : 'text-emerald-400'
                    }`}
                  >
                    {isSelected && loading ? (
                      <>
                        <Loader2 className="w-2.5 h-2.5 animate-spin text-cyan-300" />
                        <span>...</span>
                      </>
                    ) : !d.isOpen ? (
                      'Cerrado'
                    ) : (
                      'Abierto'
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* ============================================================== */}
        {/* RENDERIZADO CONDICIONAL DE HORARIOS DISPONIBLES (SOLO TRAS CLIC EN DÍA) */}
        {/* ============================================================== */}
        <AnimatePresence mode="wait">
          {Boolean(selectedDate) && (
            <motion.div
              key={selectedDate}
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="space-y-2 overflow-hidden transition-all duration-300 ease-out transform"
            >
              {/* Estado de carga claro con Spinner + Skeleton animado */}
              {loading && (
                <div className="space-y-2 pt-1.5 border-t border-white/[0.06] transition-opacity duration-200">
                  <div className="flex items-center justify-between px-1 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                    <div className="flex items-center gap-2 text-cyan-300 text-xs font-bold">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400 shrink-0" />
                      <span>Cargando horarios disponibles...</span>
                    </div>
                    <span className="text-[10px] text-cyan-400/80 font-medium">Aguardá un instante</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="h-11 rounded-xl border border-white/[0.06] bg-slate-950/60 p-2 flex items-center justify-between overflow-hidden relative"
                      >
                        <div className="space-y-1.5 flex-1 pr-2">
                          <div className="h-3 w-16 rounded skeleton-shimmer" />
                          <div className="h-2 w-10 rounded skeleton-shimmer" />
                        </div>
                        <div className="w-7 h-4 rounded-md skeleton-shimmer" />
                      </div>
                    ))}
                  </div>
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
                    className="px-2 py-1 bg-rose-600/30 text-rose-100 rounded-lg text-[10px] font-bold shrink-0 cursor-pointer active:scale-95"
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

              {/* Grilla Compacta de Bloques Horarios (2 columnas) con microinteracciones */}
              {!loading && !fetchError && isOpen && (
                <div className="space-y-1.5 pt-1 border-t border-white/[0.06]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-cyan-400" />
                      <span>Horarios Disponibles ({durationHours} hs)</span>
                    </span>
                    <span className="text-[10px] text-cyan-400 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping inline-block" />
                      Turnos en vivo
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                    {displayedSlots.map((slot) => {
                      const isPast = isSlotPast(slot.startTime, selectedDate);
                      const isDisabled = !slot.isAvailable || isPast;
                      const isSelected =
                        !isDisabled &&
                        selectedSlot?.startTime === slot.startTime &&
                        selectedSlot?.endTime === slot.endTime;

                      return (
                        <motion.button
                          key={`${slot.startTime}-${slot.endTime}`}
                          type="button"
                          disabled={isDisabled}
                          whileHover={!isDisabled ? { scale: 1.02, y: -1 } : undefined}
                          whileTap={!isDisabled ? { scale: 0.97 } : undefined}
                          onClick={() => {
                            if (isDisabled) return;
                            const newSlot = {
                              startTime: slot.startTime,
                              endTime: slot.endTime,
                            };
                            onSlotChange(newSlot);
                            onSlotSelect?.(newSlot);
                            if (contactRef?.current) {
                              contactRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                          }}
                          className={`py-2 px-2.5 rounded-xl border text-left flex items-center justify-between transition-colors ${
                            isDisabled
                              ? 'opacity-35 bg-slate-950/40 border-white/[0.04] cursor-not-allowed text-slate-500'
                              : isSelected
                              ? 'border-cyan-400 bg-gradient-to-r from-cyan-500/25 via-blue-500/15 to-cyan-500/20 text-white ring-1 ring-cyan-400/60 shadow-md shadow-cyan-500/20 cursor-pointer'
                              : 'border-white/[0.08] bg-slate-950/60 text-slate-200 hover:border-cyan-400/40 hover:bg-slate-900/60 cursor-pointer'
                          }`}
                        >
                          <div className="min-w-0 pr-1">
                            <div className="text-xs font-bold text-white whitespace-nowrap">
                              {slot.startTime} a {slot.endTime}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {isPast ? 'Transcurrido' : slot.isAvailable ? `1 cupo (${durationHours} hs)` : 'Agotado'}
                            </div>
                          </div>

                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase shrink-0 transition-transform ${
                              isSelected
                                ? 'bg-cyan-400 text-slate-950 scale-105'
                                : isPast
                                ? 'bg-slate-800 text-slate-500'
                                : !slot.isAvailable
                                ? 'bg-rose-500/20 text-rose-400'
                                : 'bg-emerald-500/20 text-emerald-400'
                            }`}
                          >
                            {isSelected ? '✓' : isPast ? 'Off' : slot.isAvailable ? 'Disp.' : 'Agotado'}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
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
              Seleccioná el día y bloque horario para tu reserva (duración est. {durationHours} hs)
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
            const isDisabled = d.isDisabled;
            const isSelected = !isDisabled && selectedDate === d.dateString;
            const isButtonDisabled = isDisabled || loading;

            return (
              <motion.button
                key={d.dateString}
                type="button"
                disabled={isButtonDisabled}
                aria-disabled={isButtonDisabled}
                whileHover={!isButtonDisabled ? { scale: 1.05, y: -2 } : undefined}
                whileTap={!isButtonDisabled ? { scale: 0.95 } : undefined}
                onClick={() => handleDaySelect(d.dateString, isDisabled)}
                className={`p-3.5 rounded-2xl border text-center transition-colors duration-300 relative ${
                  isSelected
                    ? 'border-cyan-400 bg-gradient-to-b from-cyan-500/25 via-blue-600/15 to-slate-950/80 text-white ring-1 ring-cyan-400/50 shadow-xl shadow-cyan-500/20 cursor-pointer disabled:cursor-wait'
                    : isDisabled
                    ? 'border-white/[0.04] bg-slate-950/30 text-slate-600 cursor-not-allowed opacity-40 select-none'
                    : loading
                    ? 'border-white/[0.06] bg-slate-950/40 text-slate-500 cursor-wait opacity-50 select-none'
                    : 'border-white/[0.08] bg-slate-950/60 text-slate-300 hover:border-cyan-400/40 hover:bg-slate-900/60 hover:text-white cursor-pointer'
                }`}
              >
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  {d.dayName}
                </div>
                <div className={`text-xl font-black my-1 ${isDisabled ? 'text-slate-500' : 'text-white'}`}>
                  {d.dayNumber}
                </div>
                <div
                  className={`text-[9px] font-bold uppercase tracking-wider py-0.5 rounded-md flex items-center justify-center gap-1 ${
                    isDisabled
                      ? 'text-rose-400/70'
                      : isSelected
                      ? 'text-cyan-300 font-black'
                      : 'text-emerald-400'
                  }`}
                >
                  {isSelected && loading ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin text-cyan-300" />
                      <span>Cargando</span>
                    </>
                  ) : !d.isOpen ? (
                    'Cerrado'
                  ) : (
                    'Abierto'
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ============================================================== */}
      {/* RENDERIZADO CONDICIONAL DE HORARIOS DISPONIBLES (SOLO TRAS CLIC EN DÍA) */}
      {/* ============================================================== */}
      <AnimatePresence mode="wait">
        {Boolean(selectedDate) && (
          <motion.div
            key={selectedDate}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="space-y-7 transition-all duration-300 ease-out transform"
          >
            {/* Estado de carga claro con Spinner + Skeleton */}
            {loading && (
              <div className="space-y-3.5 pt-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/25">
                  <div className="flex items-center gap-2.5 text-cyan-300 text-xs sm:text-sm font-bold">
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
                    <span>Cargando horarios disponibles...</span>
                  </div>
                  <span className="text-[11px] text-cyan-400/80 font-medium">Consultando agenda</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-20 rounded-2xl border border-white/[0.07] bg-slate-950/60 p-4 flex items-center justify-between overflow-hidden relative"
                    >
                      <div className="space-y-2">
                        <div className="h-4 w-28 rounded skeleton-shimmer" />
                        <div className="h-3 w-20 rounded skeleton-shimmer" />
                      </div>
                      <div className="w-16 h-6 rounded-full skeleton-shimmer" />
                    </div>
                  ))}
                </div>
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
                    Turnos Disponibles ({durationHours} horas)
                  </label>
                  <span className="text-[11px] text-slate-400 font-medium">Actualización automática</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {displayedSlots.map((slot) => {
                    const isPast = isSlotPast(slot.startTime, selectedDate);
                    const isDisabled = !slot.isAvailable || isPast;
                    const isSelected =
                      !isDisabled &&
                      selectedSlot?.startTime === slot.startTime &&
                      selectedSlot?.endTime === slot.endTime;

                    return (
                      <motion.button
                        key={`${slot.startTime}-${slot.endTime}`}
                        type="button"
                        disabled={isDisabled}
                        whileHover={!isDisabled ? { scale: 1.015, y: -1 } : undefined}
                        whileTap={!isDisabled ? { scale: 0.98 } : undefined}
                        onClick={() => {
                          if (isDisabled) return;
                          const newSlot = {
                            startTime: slot.startTime,
                            endTime: slot.endTime,
                          };
                          onSlotChange(newSlot);
                          onSlotSelect?.(newSlot);
                          if (contactRef?.current) {
                            contactRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }
                        }}
                        className={`p-4 sm:p-5 rounded-2xl border text-left flex items-center justify-between transition-colors duration-200 ${
                          isDisabled
                            ? 'opacity-40 bg-slate-950/40 border-white/[0.04] cursor-not-allowed text-slate-500 select-none'
                            : isSelected
                            ? 'border-cyan-400 bg-gradient-to-r from-cyan-500/25 via-blue-600/15 to-slate-900/90 text-white ring-1 ring-cyan-400/60 shadow-xl shadow-cyan-500/20 cursor-pointer'
                            : 'border-white/[0.08] bg-slate-950/60 text-slate-200 hover:border-cyan-400/40 hover:bg-slate-900/60 cursor-pointer'
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
                              ? `1 cupo disponible (${durationHours} hs)`
                              : 'Agotado'}
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
                            : 'Agotado'}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
