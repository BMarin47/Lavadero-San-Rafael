import { prisma } from '../prisma';

interface ExternalHolidayResponse {
  motivo: string;
  dia: number;
  mes: number;
  tipo: string;
  id?: string;
}

export class HolidayService {
  /**
   * Verifica si una fecha determinada (YYYY-MM-DD) es feriado nacional o provincial de Mendoza.
   */
  static async isHoliday(dateString: string): Promise<{ isHoliday: boolean; reason?: string }> {
    const year = parseInt(dateString.substring(0, 4), 10);

    // 1. Revisar caché local en base de datos
    const cached = await prisma.holidayCache.findUnique({
      where: { holidayDate: dateString },
    });

    if (cached) {
      return { isHoliday: true, reason: cached.reason };
    }

    // 2. Si el año aún no tiene registros en caché, sincronizarlo
    const countForYear = await prisma.holidayCache.count({
      where: { year },
    });

    if (countForYear === 0) {
      await this.syncHolidaysForYear(year);
      const reCheck = await prisma.holidayCache.findUnique({
        where: { holidayDate: dateString },
      });
      if (reCheck) {
        return { isHoliday: true, reason: reCheck.reason };
      }
    }

    return { isHoliday: false };
  }

  /**
   * Sincroniza feriados nacionales con la API pública e incorpora los feriados obligatorios de Mendoza
   */
  static async syncHolidaysForYear(year: number): Promise<void> {
    try {
      const response = await fetch(
        `https://nolaborables.com.ar/api/v2/feriados/${year}?incluir=opcional`,
        { next: { revalidate: 86400 } } // Cache 24h
      );

      if (response.ok) {
        const data = (await response.json()) as ExternalHolidayResponse[];
        for (const item of data) {
          const mm = String(item.mes).padStart(2, '0');
          const dd = String(item.dia).padStart(2, '0');
          const dateKey = `${year}-${mm}-${dd}`;

          await prisma.holidayCache.upsert({
            where: { holidayDate: dateKey },
            create: {
              holidayDate: dateKey,
              reason: item.motivo,
              holidayType: 'NACIONAL',
              year,
            },
            update: { reason: item.motivo },
          });
        }
      } else {
        await this.populateFallbackHolidays(year);
      }
    } catch (err) {
      console.warn(`[HolidayService] Falla contactando API pública, usando catálogo local para año ${year}:`, err);
      await this.populateFallbackHolidays(year);
    }

    // Inyectar feriados provinciales obligatorios de Mendoza / San Rafael
    const mendozaHolidays = [
      { month: '07', day: '25', reason: 'Santo Patrono Santiago (Feriado Provincial Mendoza)' },
      { month: '09', day: '08', reason: 'Virgen del Carmen de Cuyo (Patrona Provincial de Mendoza)' },
    ];

    for (const mz of mendozaHolidays) {
      const dateKey = `${year}-${mz.month}-${mz.day}`;
      await prisma.holidayCache.upsert({
        where: { holidayDate: dateKey },
        create: {
          holidayDate: dateKey,
          reason: mz.reason,
          holidayType: 'PROVINCIAL_MENDOZA',
          year,
        },
        update: { reason: mz.reason },
      });
    }
  }

  /**
   * Feriados fijos inamovibles de Argentina para asegurar funcionamiento offline
   */
  private static async populateFallbackHolidays(year: number): Promise<void> {
    const fixed = [
      { date: `${year}-01-01`, reason: 'Año Nuevo' },
      { date: `${year}-03-24`, reason: 'Día Nacional de la Memoria por la Verdad y la Justicia' },
      { date: `${year}-04-02`, reason: 'Día del Veterano y de los Caídos en Malvinas' },
      { date: `${year}-05-01`, reason: 'Día del Trabajador' },
      { date: `${year}-05-25`, reason: 'Día de la Revolución de Mayo' },
      { date: `${year}-06-20`, reason: 'Paso a la Inmortalidad del Gral. Belgrano' },
      { date: `${year}-07-09`, reason: 'Día de la Independencia' },
      { date: `${year}-12-08`, reason: 'Inmaculada Concepción de María' },
      { date: `${year}-12-25`, reason: 'Navidad' },
    ];

    for (const f of fixed) {
      await prisma.holidayCache.upsert({
        where: { holidayDate: f.date },
        create: { holidayDate: f.date, reason: f.reason, holidayType: 'NACIONAL', year },
        update: {},
      });
    }
  }
}
