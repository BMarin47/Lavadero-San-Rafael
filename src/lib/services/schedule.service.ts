import { HolidayService } from './holiday.service';
import { prisma } from '../prisma';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export interface SlotAvailability {
  startTime: string;
  endTime: string;
  totalCapacity: number;
  bookedCount: number;
  remainingCapacity: number;
  isAvailable: boolean;
}

export const MAX_CAPACITY_PER_SLOT = 1;

export const WEEKDAY_SLOTS = [
  { startTime: '09:00', endTime: '11:00' },
  { startTime: '11:00', endTime: '13:00' },
  { startTime: '16:00', endTime: '18:00' },
  { startTime: '18:00', endTime: '21:00' },
];

export const SATURDAY_SLOTS = [
  { startTime: '09:00', endTime: '11:00' },
  { startTime: '11:00', endTime: '13:00' },
];

export const PICKUP_SLOTS = [
  { startTime: '09:00', endTime: '12:00' },
  { startTime: '16:00', endTime: '19:00' },
];

/**
 * Determina si el tipo de vehículo corresponde a Camioneta (PICKUP) admitiendo
 * cualquiera de los identificadores habituales: 'PICKUP', 'camioneta', 'Camioneta', 'truck', etc.
 */
export function isPickupVehicle(vehicleType?: unknown): boolean {
  if (!vehicleType) return false;
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
 * Normaliza cualquier variante de ID de vehículo a los tipos estándar ('CAR' | 'SUV' | 'PICKUP').
 */
export function normalizeVehicleType(vehicleType?: unknown): 'CAR' | 'SUV' | 'PICKUP' {
  if (isPickupVehicle(vehicleType)) return 'PICKUP';
  if (!vehicleType) return 'CAR';
  const str = String(vehicleType).trim().toLowerCase();
  if (str === 'suv' || str.includes('suv')) return 'SUV';
  return 'CAR';
}

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

    // 2. Comprobar feriados nacionales y provinciales de Mendoza
    const holidayCheck = await HolidayService.isHoliday(dateString);
    if (holidayCheck.isHoliday) {
      return {
        isOpen: false,
        reasonClosed: `Cerrado por Feriado: ${holidayCheck.reason}`,
        slots: [],
      };
    }

    // 3. Obtener bloques según tipo de vehículo y día (L-V o Sábado)
    const isPickup = isPickupVehicle(vehicleType);

    const allowedSlots = isPickup
      ? (dayOfWeek === 6 ? [{ startTime: '09:00', endTime: '12:00' }] : PICKUP_SLOTS)
      : dayOfWeek === 6
      ? SATURDAY_SLOTS
      : WEEKDAY_SLOTS;

    // 4. Consultar turnos ya reservados en la base de datos
    // Rango normalizado para San Rafael (UTC-3) tolerante a marcas UTC y locales
    const startOfDay = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 0, 0, 0));
    const endOfDay = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + 1, 3, 0, 0));

    const slotBookedIds = new Map<string, Set<string>>();
    const registerSlotBooking = (rawTime: string | null | undefined, bookingKey: string) => {
      if (!rawTime) return;
      const match = rawTime.match(/(\d{1,2}:\d{2})/);
      const key = match ? match[1].padStart(5, '0') : rawTime.substring(0, 5);
      if (!slotBookedIds.has(key)) {
        slotBookedIds.set(key, new Set<string>());
      }
      slotBookedIds.get(key)!.add(bookingKey);
    };

    try {
      const activeAppointments = await prisma.appointment.findMany({
        where: {
          appointmentDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
          status: { in: ['CONFIRMED', 'PENDING_PAYMENT', 'IN_PROGRESS'] },
        },
        select: { id: true, startTime: true },
      });

      for (const app of activeAppointments) {
        registerSlotBooking(app.startTime, app.id || `app_${app.startTime}`);
      }
    } catch (_) {}

    // Consultar también tabla bookings en Prisma / PostgreSQL para máxima consistencia
    try {
      const activeBookings = await prisma.booking.findMany({
        where: {
          date: dateString,
          NOT: {
            status: {
              in: ['cancelado', 'cancelled', 'rechazado', 'CANCELLED', 'REJECTED'],
            },
          },
        },
        select: { id: true, time: true },
      });

      for (const b of activeBookings) {
        registerSlotBooking(b.time, b.id || `booking_${b.time}`);
      }
    } catch (_) {}

    // Consultar también Supabase Cloud si están configuradas las credenciales de servicio
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
        const { data: sbBookings } = await sb
          .from('bookings')
          .select('id, time, status')
          .eq('date', dateString)
          .not('status', 'in', '("cancelado","cancelled","rechazado","CANCELLED","REJECTED")');

        if (Array.isArray(sbBookings)) {
          for (const b of sbBookings) {
            registerSlotBooking(b.time, String(b.id || `sb_${b.time}`));
          }
        }
      }
    } catch (_) {}

    // 5. Construir slots con cálculo de capacidad (1 único cupo por bloque horario)
    const slots: SlotAvailability[] = allowedSlots.map((slot) => {
      const rawBooked = slotBookedIds.get(slot.startTime)?.size || 0;
      const booked = Math.min(MAX_CAPACITY_PER_SLOT, rawBooked);
      const remaining = Math.max(0, MAX_CAPACITY_PER_SLOT - booked);
      return {
        startTime: slot.startTime,
        endTime: slot.endTime,
        totalCapacity: MAX_CAPACITY_PER_SLOT,
        bookedCount: booked,
        remainingCapacity: remaining,
        isAvailable: remaining > 0,
      };
    });

    return { isOpen: true, slots };
  }
}
