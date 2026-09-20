import { HolidayService } from './holiday.service';
import { prisma } from '../prisma';

export interface SlotAvailability {
  startTime: string;
  endTime: string;
  totalCapacity: number;
  bookedCount: number;
  remainingCapacity: number;
  isAvailable: boolean;
}

export const MAX_CAPACITY_PER_SLOT = 3;

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

export class ScheduleService {
  /**
   * Obtiene los bloques de turnos disponibles para una fecha YYYY-MM-DD
   */
  static async getAvailability(dateString: string): Promise<{
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

    // 3. Obtener bloques según día (L-V o Sábado)
    const allowedSlots = dayOfWeek === 6 ? SATURDAY_SLOTS : WEEKDAY_SLOTS;

    // 4. Consultar turnos ya reservados en la base de datos
    // Rango normalizado para San Rafael (UTC-3) tolerante a marcas UTC y locales
    const startOfDay = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 0, 0, 0));
    const endOfDay = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + 1, 3, 0, 0));

    const activeAppointments = await prisma.appointment.findMany({
      where: {
        appointmentDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: { in: ['CONFIRMED', 'PENDING_PAYMENT', 'IN_PROGRESS'] },
      },
      select: { startTime: true },
    });

    const slotCounts = new Map<string, number>();
    for (const app of activeAppointments) {
      const key = app.startTime.substring(0, 5);
      slotCounts.set(key, (slotCounts.get(key) || 0) + 1);
    }

    // 5. Construir slots con cálculo de capacidad
    const slots: SlotAvailability[] = allowedSlots.map((slot) => {
      const booked = slotCounts.get(slot.startTime) || 0;
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
