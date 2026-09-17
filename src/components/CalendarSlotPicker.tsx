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
  useEffect(() => {
    async function fetchAvailability() {
      setLoading(true);
      setReasonClosed(null);
      onSlotChange(null); // Reset del slot al cambiar fecha

      try {
        const res = await fetch(`/api/schedule/availability?date=${selectedDate}`);
        const data = await res.json();

        if (data.error) {
          setIsOpen(false);
          setReasonClosed(data.error);
          setSlots([]);
        } else if (!data.isOpen) {
          setIsOpen(false);
          setReasonClosed(data.reasonClosed || 'Cerrado');
          setSlots([]);
        } else {
          setIsOpen(true);
          setSlots(data.slots || []);
          // Auto seleccionar el primer slot disponible
          const firstAvailable = data.slots.find((s: SlotAvailability) => s.isAvailable);
          if (firstAvailable) {
            onSlotChange({
              startTime: firstAvailable.startTime,
              endTime: firstAvailable.endTime,
            });
          }
        }
      } catch (err) {
        setIsOpen(false);
        setReasonClosed('No fue posible consultar disponibilidad.');
      } finally {
        setLoading(false);
      }
    }

    if (selectedDate) {
      fetchAvailability();
    }
  }, [selectedDate]);

  return (
    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">
            3
          </span>
          Fecha y Turno Horario
        </h2>
        <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
          San Rafael (UTC-3)
        </span>
      </div>

      {/* Selector de Fecha (Próximos días) */}
      <div className="space-y-1">
        <label className="text-[10px] text-slate-400 font-semibold uppercase">
          Seleccioná el día:
        </label>
        <div className="grid grid-cols-4 gap-1.5">
          {nextDays.map((d) => {
            const isSelected = selectedDate === d.dateString;

            return (
              <button
                key={d.dateString}
                type="button"
                onClick={() => onDateChange(d.dateString)}
                className={`p-2 rounded-xl border text-center transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-500/20 text-white ring-2 ring-blue-500/30'
                    : d.isSunday
                    ? 'border-red-900/30 bg-red-950/20 text-red-400/80 opacity-60'
                    : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="text-[10px] uppercase font-bold tracking-wider">
                  {d.dayName}
                </div>
                <div className="text-sm font-black my-0.5">{d.dayNumber}</div>
                <div className="text-[8px] font-semibold uppercase">
                  {d.isSunday ? 'Cerrado' : 'Abierto'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Estado de carga */}
      {loading && (
        <div className="py-6 flex flex-col items-center justify-center text-xs text-slate-400 space-y-2">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>Verificando cupos y feriados en San Rafael...</span>
        </div>
      )}

      {/* Alerta de Cierre (Feriados o Domingos) */}
      {!loading && !isOpen && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
          <span className="text-xl leading-none">⚠️</span>
          <div>
            <p className="font-bold">Día no disponible para atención</p>
            <p className="text-[11px] text-amber-300/80 mt-0.5">{reasonClosed}</p>
          </div>
        </div>
      )}

      {/* Grilla de Bloques Horarios Oficiales */}
      {!loading && isOpen && (
        <div className="space-y-2 pt-1">
          <label className="text-[10px] text-slate-400 font-semibold uppercase">
            Seleccioná un bloque horario:
          </label>
          <div className="grid grid-cols-2 gap-2">
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
                  className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                    !slot.isAvailable
                      ? 'opacity-40 bg-slate-950/40 border-slate-900 cursor-not-allowed text-slate-500'
                      : isSelected
                      ? 'border-blue-500 bg-blue-500/20 text-white ring-2 ring-blue-500/40'
                      : 'border-slate-800 bg-slate-950/80 text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold">
                      {slot.startTime} a {slot.endTime} hs
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {slot.isAvailable
                        ? `Disponibles: ${slot.remainingCapacity} ${
                            slot.remainingCapacity === 1 ? 'box' : 'boxes'
                          }`
                        : 'Boxes completos'}
                    </div>
                  </div>

                  <span
                    className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      !slot.isAvailable
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                        : isSelected
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {isSelected ? 'Elegido' : slot.isAvailable ? 'Libre' : 'Lleno'}
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
