import { HolidayService } from './holiday.service';
import { prisma } from '../prisma';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import {
  VEHICLE_CATEGORIES_CONFIG,
  calculateEndTimeFromMinutes,
} from '@/lib/config';
import type { VehicleCategoryType } from '@/lib/config';

export type { VehicleCategoryType };

export interface SlotAvailability {
  startTime: string;
  endTime: string;
  totalCapacity: number;
  bookedCount: number;
  remainingCapacity: number;
  isAvailable: boolean;
}

export const MAX_CAPACITY_PER_SLOT = 1;

export const ALLOWED_BOOKING_DATES: readonly string[] = [
  '2026-11-06',
  '2026-11-07',
  '2026-11-10',
  '2026-11-11',
];

export function isAllowedBookingDate(dateString: string): boolean {
  if (!dateString) return false;
  return ALLOWED_BOOKING_DATES.includes(dateString.trim());
}

/**
 * Genera dinámicamente bloques horarios calculando la hora de fin mediante:
 * inicio (en minutos) + duracion_en_minutos
 */
export function buildSlotsFromStartTimes(
  startTimes: readonly string[],
  durationMinutes: number
): { startTime: string; endTime: string }[] {
  return startTimes.map((startTime) => ({
    startTime,
    endTime: calculateEndTimeFromMinutes(startTime, durationMinutes),
  }));
}

export const WEEKDAY_SLOTS = buildSlotsFromStartTimes(
  VEHICLE_CATEGORIES_CONFIG.CAR.weekdayStartTimes,
  VEHICLE_CATEGORIES_CONFIG.CAR.durationMinutes
);

export const SATURDAY_SLOTS = buildSlotsFromStartTimes(
  VEHICLE_CATEGORIES_CONFIG.CAR.saturdayStartTimes,
  VEHICLE_CATEGORIES_CONFIG.CAR.durationMinutes
);

export const PICKUP_SLOTS = buildSlotsFromStartTimes(
  VEHICLE_CATEGORIES_CONFIG.PICKUP.weekdayStartTimes,
  VEHICLE_CATEGORIES_CONFIG.PICKUP.durationMinutes
);

export const LARGE_VEHICLE_SLOTS = buildSlotsFromStartTimes(
  VEHICLE_CATEGORIES_CONFIG.LARGE_PICKUP.weekdayStartTimes,
  VEHICLE_CATEGORIES_CONFIG.LARGE_PICKUP.durationMinutes
);

/**
 * Determina si el vehículo corresponde a "Trafic / Utilitario" (UTILITY - 4 hs).
 */
export function isUtilityVehicle(vehicleType?: unknown): boolean {
  if (!vehicleType) return false;
  const str = String(vehicleType).trim().toLowerCase();
  return (
    str === 'utility' ||
    str === 'trafic' ||
    str === 'traffic' ||
    str === 'utilitario' ||
    str === 'trafic / utilitario' ||
    str === 'trafic/utilitario' ||
    str === 'furgon' ||
    str === 'furgón' ||
    str === 'combi' ||
    str === 'van' ||
    str.includes('trafic') ||
    str.includes('traffic') ||
    str.includes('utilitario') ||
    str.includes('utility') ||
    str.includes('furgon') ||
    str.includes('furgón')
  );
}

/**
 * Determina si el vehículo corresponde a "Camioneta Grande" (LARGE_PICKUP - 4 hs).
 */
export function isLargePickupVehicle(vehicleType?: unknown): boolean {
  if (!vehicleType) return false;
  const str = String(vehicleType).trim().toLowerCase();
  return (
    str === 'large_pickup' ||
    str === 'large-pickup' ||
    str === 'largepickup' ||
    str === 'camioneta grande' ||
    str === 'camioneta_grande' ||
    str === 'camioneta-grande' ||
    str.includes('large_pickup') ||
    str.includes('large-pickup') ||
    str.includes('camioneta grande') ||
    str.includes('camioneta_grande')
  );
}

/**
 * Determina si el vehículo pertenece a las categorías de gran porte (4 horas de lavado):
 * "Camioneta Grande" (LARGE_PICKUP) o "Trafic / Utilitario" (UTILITY).
 */
export function isLargeVehicle(vehicleType?: unknown): boolean {
  return isLargePickupVehicle(vehicleType) || isUtilityVehicle(vehicleType);
}

/**
 * Determina si el tipo de vehículo corresponde a Camioneta estándar (PICKUP - 3 hs) admitiendo
 * cualquiera de los identificadores habituales: 'PICKUP', 'camioneta', 'Camioneta', 'truck', etc.,
 * excluyendo "Camioneta Grande" y "Trafic / Utilitario".
 */
export function isPickupVehicle(vehicleType?: unknown): boolean {
  if (!vehicleType) return false;
  if (isLargePickupVehicle(vehicleType) || isUtilityVehicle(vehicleType)) {
    return false;
  }
  const str = String(vehicleType).trim().toLowerCase();
  return (
    str === 'pickup' ||
    str === 'pick-up' ||
    str === 'pick_up' ||
    str === 'camioneta' ||
    str === 'truck' ||
    str.includes('pickup') ||
    str.includes('camioneta') ||
    str.includes('truck')
  );
}

/**
 * Normaliza cualquier variante de ID o nombre de vehículo a los tipos estándar:
 * ('CAR' | 'SUV' | 'PICKUP' | 'LARGE_PICKUP' | 'UTILITY').
 */
export function normalizeVehicleType(vehicleType?: unknown): VehicleCategoryType {
  if (isUtilityVehicle(vehicleType)) return 'UTILITY';
  if (isLargePickupVehicle(vehicleType)) return 'LARGE_PICKUP';
  if (isPickupVehicle(vehicleType)) return 'PICKUP';
  if (!vehicleType) return 'CAR';
  const str = String(vehicleType).trim().toLowerCase();
  if (str === 'suv' || str.includes('suv')) return 'SUV';
  return 'CAR';
}

/**
 * Devuelve la duración estimada de lavado en minutos según el tipo de vehículo.
 */
export function getVehicleDurationMinutes(vehicleType?: unknown): number {
  const normalized = normalizeVehicleType(vehicleType);
  return VEHICLE_CATEGORIES_CONFIG[normalized]?.durationMinutes ?? 120;
}

/**
 * Devuelve la duración estimada de lavado en horas según el tipo de vehículo:
 * - Auto (CAR) / SUV: 2 horas
 * - Camioneta (PICKUP): 3 horas
 * - Camioneta Grande (LARGE_PICKUP) / Trafic / Utilitario (UTILITY): 4 horas
 */
export function getVehicleDurationHours(vehicleType?: unknown): number {
  const normalized = normalizeVehicleType(vehicleType);
  return VEHICLE_CATEGORIES_CONFIG[normalized]?.durationHours ?? 2;
}

/**
 * Calcula la hora de finalización exacta dinámicamente sumando los minutos correspondientes a la categoría del vehículo.
 * Ejemplo: "18:00" con 120 min -> "20:00".
 */
export function calculateSlotEndTime(startTime: string, vehicleType?: unknown): string {
  const durationMinutes = getVehicleDurationMinutes(vehicleType);
  return calculateEndTimeFromMinutes(startTime, durationMinutes);
}

/**
 * Obtiene los bloques horarios correspondientes al tipo de vehículo y día de la semana
 * calculados matemáticamente a partir de las horas de inicio y la duración del servicio en minutos.
 */
export function getAllowedSlotsForVehicle(
  vehicleType?: unknown,
  dayOfWeek?: number
): { startTime: string; endTime: string }[] {
  const normalized = normalizeVehicleType(vehicleType);
  const isSaturday = dayOfWeek === 6;
  const config = VEHICLE_CATEGORIES_CONFIG[normalized];
  const startTimes = isSaturday ? config.saturdayStartTimes : config.weekdayStartTimes;

  return buildSlotsFromStartTimes(startTimes, config.durationMinutes);
}

/**
 * Convierte un texto de hora "HH:mm" a minutos desde la medianoche.
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

/**
 * Extrae las horas de inicio y fin en minutos de un string de horario o rango.
 * Soporta formatos comunes:
 * - "09:00 a 11:00"
 * - "09:00 a 12:00 hs"
 * - "09:00 a 13:00 hs"
 * - "09:00 - 11:00"
 * - "09:00" (si solo viene una hora, usa fallbackDurationMinutes, ej: 120 min)
 */
export function parseTimeInterval(
  timeStr: string,
  fallbackDurationMinutes: number = 120
): { start: number; end: number } | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const matches = Array.from(timeStr.matchAll(/(\d{1,2}):(\d{2})/g));
  if (matches.length === 0) return null;

  const start = parseInt(matches[0][1], 10) * 60 + parseInt(matches[0][2], 10);
  let end: number;

  if (matches.length >= 2) {
    end = parseInt(matches[1][1], 10) * 60 + parseInt(matches[1][2], 10);
  } else {
    end = start + fallbackDurationMinutes;
  }

  return { start, end };
}

/**
 * Determina si dos cadenas de horarios se solapan en el tiempo (Time Overlap):
 * Condición matemática estricta: startA < endB && endA > startB
 *
 * Ejemplos:
 * - "09:00 a 11:00" y "09:00 a 12:00" -> true (se solapan)
 * - "09:00 a 13:00" y "11:00 a 13:00" -> true (se solapan)
 * - "16:00 a 20:00" y "18:00 a 20:00" -> true (se solapan)
 * - "09:00 a 11:00" y "11:00 a 13:00" -> false (son contiguos, no solapan)
 */
export function areTimeSlotsOverlapping(
  slotA: string,
  slotB: string,
  fallbackDurationMinutes: number = 120
): boolean {
  const intervalA = parseTimeInterval(slotA, fallbackDurationMinutes);
  const intervalB = parseTimeInterval(slotB, fallbackDurationMinutes);

  if (!intervalA || !intervalB) return false;

  return intervalA.start < intervalB.end && intervalA.end > intervalB.start;
}

// Aliases para máxima compatibilidad con distintas nomenclaturas
export const checkTimeOverlap = areTimeSlotsOverlapping;
export const isTimeOverlap = areTimeSlotsOverlapping;
export const hasTimeOverlap = areTimeSlotsOverlapping;

export class ScheduleService {
  /**
   * Obtiene los bloques de turnos disponibles para una fecha YYYY-MM-DD
   */
  static async getAvailability(
    dateString: string,
    vehicleType?: string
  ): Promise<{
    isOpen: boolean;
    reasonClosed?: string;
    slots: SlotAvailability[];
  }> {
    // Parsear fecha considerando huso horario de San Rafael Mendoza (UTC-3)
    const parts = dateString.split('-').map(Number);
    // Usamos fecha UTC al mediodía para determinar con certeza el día de la semana sin sesgos de zona horaria
    const dateObj = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
    const dayOfWeek = dateObj.getUTCDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado

    // 1. Domingos siempre cerrado
    if (dayOfWeek === 0) {
      return {
        isOpen: false,
        reasonClosed: 'El lavadero permanece cerrado los días domingos.',
        slots: [],
      };
    }

    // 1.b Restricción estricta a las fechas habilitadas en el calendario
    if (!isAllowedBookingDate(dateString)) {
      return {
        isOpen: false,
        reasonClosed: 'Esta fecha se encuentra completa / no disponible para nuevas reservas.',
        slots: [],
      };
    }

    // 2. Comprobar feriados nacionales y provinciales de Mendoza (con fallback silencioso si falla DB)
    try {
      const holidayCheck = await HolidayService.isHoliday(dateString);
      if (holidayCheck.isHoliday) {
        return {
          isOpen: false,
          reasonClosed: `Cerrado por Feriado: ${holidayCheck.reason}`,
          slots: [],
        };
      }
    } catch (holidayErr: any) {
      console.warn(
        `[ScheduleService] Omitiendo chequeo de feriado por error de conexión (${dateString}):`,
        holidayErr?.message || holidayErr
      );
    }

    // 3. Obtener bloques según tipo de vehículo y día (L-V o Sábado)
    const allowedSlots = getAllowedSlotsForVehicle(vehicleType, dayOfWeek);

    // 4. Consultar turnos ya reservados en la base de datos en paralelo con timeout corto
    // Rango normalizado para San Rafael (UTC-3) tolerante a marcas UTC y locales
    const startOfDay = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 0, 0, 0));
    const endOfDay = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + 1, 3, 0, 0));

    // Registro unificado de reservas activas del día: Map<bookingKey, timeString>
    const activeBookingSlots = new Map<string, string>();
    const registerBooking = (bookingKey: string, rawTime: string | null | undefined) => {
      if (!rawTime || !rawTime.trim()) return;
      if (!activeBookingSlots.has(bookingKey)) {
        activeBookingSlots.set(bookingKey, rawTime.trim());
      }
    };

    const withDbTimeout = <T>(promise: Promise<T>, ms = 3000): Promise<T> =>
      new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('DB query timeout')), ms);
        promise
          .then((val) => {
            clearTimeout(timer);
            resolve(val);
          })
          .catch((err) => {
            clearTimeout(timer);
            reject(err);
          });
      });

    // Ejecutar consultas en paralelo (Supabase REST API por HTTPS no sufre agotamiento de conexiones TCP)
    const supabaseQueryTask = async () => {
      try {
        const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const sbKey =
          process.env.SUPABASE_SERVICE_ROLE_KEY ||
          process.env.SUPABASE_SERVICE_KEY ||
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (sbUrl && sbKey) {
          const sb = createSupabaseClient(sbUrl, sbKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          });
          const [bookingsRes, turnosRes] = await Promise.allSettled([
            sb
              .from('bookings')
              .select('id, time, status')
              .eq('date', dateString)
              .not('status', 'in', '("cancelado","cancelled","rechazado","CANCELLED","REJECTED")'),
            sb
              .from('turnos')
              .select('id, time, estado')
              .eq('date', dateString)
              .not('estado', 'in', '("cancelado","cancelled","rechazado","CANCELLED","REJECTED")'),
          ]);

          if (bookingsRes.status === 'fulfilled' && Array.isArray(bookingsRes.value.data)) {
            for (const b of bookingsRes.value.data) {
              registerBooking(String(b.id || `sb_${b.time}`), b.time);
            }
          }
          if (turnosRes.status === 'fulfilled' && Array.isArray(turnosRes.value.data)) {
            for (const t of turnosRes.value.data) {
              registerBooking(String(t.id || `sbt_${t.time}`), t.time);
            }
          }
        }
      } catch (_) {}
    };

    const prismaAppointmentsTask = async () => {
      try {
        const activeAppointments = await withDbTimeout(
          prisma.appointment.findMany({
            where: {
              appointmentDate: {
                gte: startOfDay,
                lte: endOfDay,
              },
              status: { in: ['CONFIRMED', 'PENDING_PAYMENT', 'IN_PROGRESS'] },
            },
            select: {
              id: true,
              startTime: true,
              endTime: true,
              vehicle: { select: { vehicleType: true } },
            },
          }),
          3000
        );

        for (const app of activeAppointments) {
          const id = app.id || `app_${app.startTime}_${app.endTime}`;
          const computedEndTime =
            app.endTime || calculateSlotEndTime(app.startTime, app.vehicle?.vehicleType);
          const timeStr = `${app.startTime} a ${computedEndTime}`;
          registerBooking(id, timeStr);
        }
      } catch (_) {}
    };

    const prismaBookingsTask = async () => {
      try {
        const activeBookings = await withDbTimeout(
          prisma.booking.findMany({
            where: {
              date: dateString,
              NOT: {
                status: {
                  in: ['cancelado', 'cancelled', 'rechazado', 'CANCELLED', 'REJECTED'],
                },
              },
            },
            select: { id: true, time: true },
          }),
          3000
        );

        for (const b of activeBookings) {
          registerBooking(b.id || `booking_${b.time}`, b.time);
        }
      } catch (_) {}
    };

    await Promise.allSettled([
      supabaseQueryTask(),
      prismaAppointmentsTask(),
      prismaBookingsTask(),
    ]);

    // 5. Construir slots con cálculo de capacidad y solapamiento de horarios cruzados (Time Overlap)
    // No busca coincidencia de texto exacto: itera sobre todas las reservas existentes del día
    const existingBookings = Array.from(activeBookingSlots.values());

    const slots: SlotAvailability[] = allowedSlots.map((slot) => {
      const slotRangeStr = `${slot.startTime} a ${slot.endTime}`;

      // Contar reservas activas que se solapan en tiempo con este bloque horario
      let overlappingCount = 0;
      for (const bookedTime of existingBookings) {
        if (areTimeSlotsOverlapping(slotRangeStr, bookedTime)) {
          overlappingCount++;
        }
      }

      // Si AL MENOS UNA reserva existente se solapa, el cupo restante debe ser 0 (ocupado/agotado)
      const booked = Math.min(MAX_CAPACITY_PER_SLOT, overlappingCount);
      const remaining = overlappingCount > 0 ? 0 : MAX_CAPACITY_PER_SLOT;
      const isAvailable = remaining > 0;

      return {
        startTime: slot.startTime,
        endTime: slot.endTime,
        totalCapacity: MAX_CAPACITY_PER_SLOT,
        bookedCount: booked,
        remainingCapacity: remaining,
        isAvailable,
      };
    });

    return { isOpen: true, slots };
  }
}
