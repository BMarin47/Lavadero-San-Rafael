import { prisma } from '../prisma';

interface ExternalHolidayResponse {
  motivo: string;
  dia: number;
  mes: number;
  tipo: string;
  id?: string;
}

/**
 * Catálogo estático en memoria de feriados fijos nacionales y provinciales de Mendoza
 * utilizado como fallback instantáneo cuando la base de datos o la caché de Prisma
 * experimenta cold start, latencia o desconexión temporal.
 */
function getStaticFallbackHoliday(dateString: string): { isHoliday: boolean; reason?: string } {
  if (!dateString || dateString.length < 10) return { isHoliday: false };
  const monthDay = dateString.substring(5, 10); // MM-DD

  const staticHolidays: Record<string, string> = {
    '01-01': 'Año Nuevo',
    '03-24': 'Día Nacional de la Memoria por la Verdad y la Justicia',
    '04-02': 'Día del Veterano y de los Caídos en la Guerra de Malvinas',
    '05-01': 'Día del Trabajador',
    '05-25': 'Día de la Revolución de Mayo',
    '06-20': 'Paso a la Inmortalidad del Gral. Manuel Belgrano',
    '07-09': 'Día de la Independencia',
    '07-25': 'Santo Patrono Santiago (Feriado Provincial Mendoza)',
    '09-08': 'Virgen del Carmen de Cuyo (Patrona Provincial de Mendoza)',
    '12-08': 'Inmaculada Concepción de María',
    '12-25': 'Navidad',
  };

  if (staticHolidays[monthDay]) {
    return { isHoliday: true, reason: staticHolidays[monthDay] };
  }

  return { isHoliday: false };
}

/**
 * Ejecuta una promesa con un límite de tiempo (timeout) para evitar que un cold start
 * de PostgreSQL bloquee la respuesta de horarios en el calendario.
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`HolidayCache query timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

export class HolidayService {
  /**
   * Verifica si una fecha determinada (YYYY-MM-DD) es feriado nacional o provincial de Mendoza.
   * Si falla la conexión con Prisma/PostgreSQL (`holidayCache`), degrada de forma silenciosa
   * al catálogo estático en memoria sin bloquear ni romper la consulta de horarios.
   */
  static async isHoliday(dateString: string): Promise<{ isHoliday: boolean; reason?: string }> {
    // 1. Verificación instantánea en catálogo fijo en memoria (0ms)
    const staticCheck = getStaticFallbackHoliday(dateString);
    if (staticCheck.isHoliday) {
      return staticCheck;
    }

    const year = parseInt(dateString.substring(0, 4), 10);

    // 2. Revisar caché local en base de datos con try/catch y timeout corto (2.5s)
    try {
      const cached = await withTimeout(
        prisma.holidayCache.findUnique({
          where: { holidayDate: dateString },
        }),
        2500
      );

      if (cached) {
        return { isHoliday: true, reason: cached.reason };
      }

      // 3. Si el año aún no tiene registros en caché, intentar sincronizar sin bloquear en caso de falla
      const countForYear = await withTimeout(
        prisma.holidayCache.count({
          where: { year },
        }),
        2000
      );

      if (countForYear === 0) {
        await this.syncHolidaysForYear(year);
        const reCheck = await withTimeout(
          prisma.holidayCache.findUnique({
            where: { holidayDate: dateString },
          }),
          2000
        );
        if (reCheck) {
          return { isHoliday: true, reason: reCheck.reason };
        }
      }
    } catch (dbErr: any) {
      console.warn(
        `[HolidayService] Fallback silencioso activado para ${dateString} (DB/Cache no disponible temporalmente):`,
        dbErr?.message || dbErr
      );
      return getStaticFallbackHoliday(dateString);
    }

    return { isHoliday: false };
  }

  /**
   * Sincroniza feriados nacionales con la API pública e incorpora los feriados obligatorios de Mendoza.
   * Envuelto en try/catch para nunca propagar excepciones de base de datos o red.
   */
  static async syncHolidaysForYear(year: number): Promise<void> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(
        `https://nolaborables.com.ar/api/v2/feriados/${year}?incluir=opcional`,
        {
          next: { revalidate: 86400 },
          signal: controller.signal,
        }
      ).finally(() => clearTimeout(timeoutId));

      if (response.ok) {
        const data = (await response.json()) as ExternalHolidayResponse[];
        for (const item of data) {
          const mm = String(item.mes).padStart(2, '0');
          const dd = String(item.dia).padStart(2, '0');
          const dateKey = `${year}-${mm}-${dd}`;

          try {
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
          } catch {
            // Si la base de datos no está disponible, abortar el bucle de caché silenciosamente
            return;
          }
        }
      } else {
        await this.populateFallbackHolidays(year);
      }
    } catch (err: any) {
      console.warn(
        `[HolidayService] No se pudo sincronizar API pública para año ${year}, usando fallback local:`,
        err?.message || err
      );
      await this.populateFallbackHolidays(year);
    }

    // Inyectar feriados provinciales obligatorios de Mendoza / San Rafael
    const mendozaHolidays = [
      { month: '07', day: '25', reason: 'Santo Patrono Santiago (Feriado Provincial Mendoza)' },
      { month: '09', day: '08', reason: 'Virgen del Carmen de Cuyo (Patrona Provincial de Mendoza)' },
    ];

    for (const mz of mendozaHolidays) {
      const dateKey = `${year}-${mz.month}-${mz.day}`;
      try {
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
      } catch {
        return;
      }
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
      try {
        await prisma.holidayCache.upsert({
          where: { holidayDate: f.date },
          create: { holidayDate: f.date, reason: f.reason, holidayType: 'NACIONAL', year },
          update: {},
        });
      } catch {
        // Silencioso si la base de datos no responde
        return;
      }
    }
  }
}
