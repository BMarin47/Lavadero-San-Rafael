import webpush from 'web-push';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { Pool } from 'pg';

/**
 * Constantes de Zona Horaria de Argentina
 * San Rafael, Mendoza se encuentra en huso UTC-3 todo el año (sin horario de verano).
 */
export const ARGENTINA_TIMEZONE = 'America/Argentina/Mendoza';
export const ARGENTINA_OFFSET = '-03:00';

const vapidPublicKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim();
const vapidPrivateKey = (process.env.VAPID_PRIVATE_KEY || '').trim();
const vapidSubject = (
  process.env.VAPID_SUBJECT || 'mailto:bruno.marin.soporte@gmail.com'
).trim();

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  } catch (err) {
    console.error('[WebPush VAPID Init Warning]:', err);
  }
}

/**
 * Normaliza y extrae el horario de inicio (HH:mm) desde cualquier cadena de texto.
 * Ej: "09:00", "09:00 a 11:00 hs", "Turno: 2026-10-01 09:00", "11:00"
 */
export function extractStartTime(timeStr: string | null | undefined): string {
  if (!timeStr) return '09:00';
  const match = timeStr.match(/(\d{1,2}:\d{2})/);
  if (match) {
    return match[1].padStart(5, '0');
  }
  return '09:00';
}

/**
 * Convierte una fecha y hora local de Argentina a un objeto Date absoluto en UTC,
 * aplicando estrictamente el desplazamiento UTC-3 (San Rafael, Mendoza).
 * Esto evita desfases de 3 horas cuando el código se ejecuta en servidores Vercel (UTC).
 */
export function parseArgentinaAppointmentDate(
  dateStr: string | null | undefined,
  timeStr?: string | null | undefined
): Date | null {
  if (!dateStr) return null;

  // Extraer año, mes y día (YYYY-MM-DD)
  const dateMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!dateMatch) {
    return null;
  }
  const [, year, month, day] = dateMatch;
  const startTime = extractStartTime(timeStr);

  // Generar string ISO con el offset exacto de Argentina (-03:00)
  const isoString = `${year}-${month}-${day}T${startTime}:00${ARGENTINA_OFFSET}`;
  const parsedDate = new Date(isoString);

  if (isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

/**
 * Obtiene la hora actual formateada tanto en UTC como en la hora local de Argentina (UTC-3).
 */
export function getArgentinaNowInfo() {
  const nowUtc = new Date();

  // Fecha y hora local de Argentina usando Intl
  const argDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: ARGENTINA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const argTimeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: ARGENTINA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const todayArg = argDateFormatter.format(nowUtc); // YYYY-MM-DD
  const timeArg = argTimeFormatter.format(nowUtc);  // HH:mm:ss

  // Mañana en Argentina (+24 horas)
  const tomorrowArgDate = new Date(nowUtc.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowArg = argDateFormatter.format(tomorrowArgDate);

  // Pasado mañana en Argentina (+48 horas)
  const dayAfterArgDate = new Date(nowUtc.getTime() + 48 * 60 * 60 * 1000);
  const dayAfterArg = argDateFormatter.format(dayAfterArgDate);

  return {
    nowUtc,
    utcIso: nowUtc.toISOString(),
    todayArg,
    timeArg,
    tomorrowArg,
    dayAfterArg,
    argentinaLocalStr: `${todayArg} ${timeArg} (UTC-3)`,
  };
}

export interface ReminderTurno {
  id: string;
  user_id: string;
  client_name: string;
  client_email?: string | null;
  client_phone?: string | null;
  vehiculo: string;
  categoria: string;
  date: string;
  time: string;
  status: string;
  appointmentUtc: Date;
  diffHours: number;
  sourceTable: 'bookings' | 'turnos';
  reminder_24h_sent?: boolean;
}

export interface CronRunResult {
  success: boolean;
  executedAtUtc: string;
  executedAtArgentina: string;
  candidatesEvaluated: number;
  in24hWindowCount: number;
  notificationsSent: number;
  notificationsFailed: number;
  expiredCleaned: number;
  turnosReminded: Array<{
    id: string;
    client: string;
    vehicle: string;
    date: string;
    time: string;
    diffHours: number;
    pushSent: boolean;
    reason?: string;
  }>;
  logs: string[];
}

export class ReminderService {
  /**
   * Obtiene un cliente Supabase con Service Role Key si existe para omitir RLS
   * en tareas de fondo / cron jobs.
   */
  private static getSupabaseAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY;

    if (url && serviceKey) {
      return createSupabaseClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }
    return null;
  }

  /**
   * Busca los turnos activos en Supabase y PostgreSQL que caen en la ventana
   * de 24 horas antes de su inicio.
   */
  static async findTurnosIn24hWindow(options?: {
    minHours?: number;
    maxHours?: number;
    forceTurnoId?: string;
  }): Promise<{ turnos: ReminderTurno[]; logs: string[] }> {
    const logs: string[] = [];
    const minHours = options?.minHours ?? 22.5; // Margen de tolerancia para ejecuciones horarias
    const maxHours = options?.maxHours ?? 25.5; // [22.5h - 25.5h] cubre exactamente la ventana de 24h

    const nowInfo = getArgentinaNowInfo();
    logs.push(
      `[ReminderService] Consulta iniciada. UTC: ${nowInfo.utcIso} | San Rafael (UTC-3): ${nowInfo.argentinaLocalStr}`
    );

    const adminSupabase = this.getSupabaseAdminClient();
    let supabaseClient = adminSupabase;
    if (!supabaseClient) {
      try {
        supabaseClient = await createClient();
      } catch (err: any) {
        logs.push(`[ReminderService] Advertencia al crear cliente supabase: ${err.message}`);
      }
    }

    const turnosMap = new Map<string, ReminderTurno>();

    // 1. Consultar tabla bookings en Supabase
    if (supabaseClient) {
      try {
        const { data: bookingsData, error: bErr } = await supabaseClient
          .from('bookings')
          .select('*')
          .not('status', 'in', '("cancelado","rechazado","completado","CANCELLED","REJECTED")')
          .order('date', { ascending: true });

        if (!bErr && Array.isArray(bookingsData)) {
          logs.push(`[ReminderService] Bookings recuperados de Supabase: ${bookingsData.length}`);
          for (const b of bookingsData) {
            const dateStr = b.date || (b.created_at ? b.created_at.split('T')[0] : null);
            const timeStr = b.time || '09:00';
            const appointmentDate = parseArgentinaAppointmentDate(dateStr, timeStr);

            if (appointmentDate) {
              const diffHours = (appointmentDate.getTime() - Date.now()) / (1000 * 60 * 60);
              turnosMap.set(String(b.id), {
                id: String(b.id),
                user_id: String(b.user_id),
                client_name: b.client_name || b.nombre_cliente || 'Cliente',
                client_email: b.client_email || null,
                client_phone: b.client_phone || b.phone || null,
                vehiculo: b.vehicle_details || b.vehiculo || 'Vehículo',
                categoria: b.service_type || b.categoria || 'Servicio General',
                date: dateStr,
                time: timeStr,
                status: b.status || b.estado || 'confirmado',
                appointmentUtc: appointmentDate,
                diffHours: Number(diffHours.toFixed(2)),
                sourceTable: 'bookings',
                reminder_24h_sent: !!(b.reminder_24h_sent || (b as any).recordatorio_24h_enviado),
              });
            }
          }
        } else if (bErr) {
          logs.push(`[ReminderService] Error consultando bookings Supabase: ${bErr.message}`);
        }
      } catch (sbErr: any) {
        logs.push(`[ReminderService] Excepción Supabase bookings: ${sbErr.message}`);
      }
    }

    // 2. Consultar tabla turnos en Supabase (compatibilidad)
    if (supabaseClient) {
      try {
        const { data: turnosData, error: tErr } = await supabaseClient
          .from('turnos')
          .select('*')
          .not('estado', 'in', '("cancelado","rechazado","completado")');

        if (!tErr && Array.isArray(turnosData)) {
          logs.push(`[ReminderService] Turnos recuperados de Supabase: ${turnosData.length}`);
          for (const t of turnosData) {
            if (turnosMap.has(String(t.id))) continue;

            let dateStr = (t as any).date || (t as any).fecha;
            let timeStr = (t as any).time || (t as any).hora;

            // Extraer de indicaciones si no vino en campos directos
            if (!dateStr && t.indicaciones) {
              const mDate = t.indicaciones.match(/\b(202\d-\d{2}-\d{2})\b/);
              if (mDate) dateStr = mDate[1];
            }
            if (!timeStr && t.indicaciones) {
              const mTime = t.indicaciones.match(/(\d{1,2}:\d{2})/);
              if (mTime) timeStr = mTime[1];
            }

            const appointmentDate = parseArgentinaAppointmentDate(dateStr, timeStr);
            if (appointmentDate) {
              const diffHours = (appointmentDate.getTime() - Date.now()) / (1000 * 60 * 60);
              turnosMap.set(String(t.id), {
                id: String(t.id),
                user_id: String(t.user_id),
                client_name: t.nombre_cliente || 'Cliente',
                client_email: (t as any).client_email || null,
                client_phone: (t as any).client_phone || null,
                vehiculo: t.vehiculo || 'Vehículo',
                categoria: t.categoria || 'Servicio General',
                date: dateStr || 'Por coordinar',
                time: timeStr || '09:00',
                status: t.estado || 'confirmado',
                appointmentUtc: appointmentDate,
                diffHours: Number(diffHours.toFixed(2)),
                sourceTable: 'turnos',
                reminder_24h_sent: !!((t as any).reminder_24h_sent || (t as any).recordatorio_24h_enviado),
              });
            }
          }
        }
      } catch (sbTurnosErr: any) {
        logs.push(`[ReminderService] Excepción Supabase turnos: ${sbTurnosErr.message}`);
      }
    }

    // 3. Fallback PostgreSQL directo si DATABASE_URL existe
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://'))) {
      try {
        const pool = new Pool({
          connectionString: dbUrl,
          ssl: { rejectUnauthorized: false },
        });
        const client = await pool.connect();
        try {
          // Consultar bookings
          try {
            const resB = await client.query(
              `SELECT * FROM public.bookings 
               WHERE status NOT IN ('cancelado', 'rechazado', 'completado', 'CANCELLED')`
            );
            for (const b of resB.rows) {
              if (!turnosMap.has(String(b.id))) {
                const dateStr = b.date;
                const timeStr = b.time;
                const appDate = parseArgentinaAppointmentDate(dateStr, timeStr);
                if (appDate) {
                  const diffHours = (appDate.getTime() - Date.now()) / (1000 * 60 * 60);
                  turnosMap.set(String(b.id), {
                    id: String(b.id),
                    user_id: String(b.user_id),
                    client_name: b.client_name || b.nombre_cliente || 'Cliente',
                    client_email: b.client_email,
                    client_phone: b.client_phone,
                    vehiculo: b.vehicle_details || b.vehiculo || 'Vehículo',
                    categoria: b.service_type || b.categoria || 'General',
                    date: dateStr,
                    time: timeStr,
                    status: b.status,
                    appointmentUtc: appDate,
                    diffHours: Number(diffHours.toFixed(2)),
                    sourceTable: 'bookings',
                    reminder_24h_sent: !!b.reminder_24h_sent,
                  });
                }
              }
            }
          } catch (_) {}

          // Consultar turnos
          try {
            const resT = await client.query(
              `SELECT * FROM public.turnos 
               WHERE estado NOT IN ('cancelado', 'rechazado', 'completado')`
            );
            for (const t of resT.rows) {
              if (!turnosMap.has(String(t.id))) {
                const appDate = parseArgentinaAppointmentDate((t as any).date, (t as any).time);
                if (appDate) {
                  const diffHours = (appDate.getTime() - Date.now()) / (1000 * 60 * 60);
                  turnosMap.set(String(t.id), {
                    id: String(t.id),
                    user_id: String(t.user_id),
                    client_name: t.nombre_cliente || 'Cliente',
                    vehiculo: t.vehiculo || 'Vehículo',
                    categoria: t.categoria || 'General',
                    date: (t as any).date || '',
                    time: (t as any).time || '',
                    status: t.estado,
                    appointmentUtc: appDate,
                    diffHours: Number(diffHours.toFixed(2)),
                    sourceTable: 'turnos',
                    reminder_24h_sent: !!t.reminder_24h_sent,
                  });
                }
              }
            }
          } catch (_) {}
        } finally {
          client.release();
          await pool.end();
        }
      } catch (pgErr: any) {
        logs.push(`[ReminderService] Excepción PostgreSQL: ${pgErr.message}`);
      }
    }

    const allTurnos = Array.from(turnosMap.values());
    logs.push(`[ReminderService] Total turnos activos evaluados: ${allTurnos.length}`);

    // Filtrar los que caen en la ventana de 24 horas y aún no recibieron el recordatorio
    const inWindow = allTurnos.filter((t) => {
      // Si se forzó un ID específico para prueba
      if (options?.forceTurnoId && t.id === options.forceTurnoId) {
        return true;
      }

      // Si ya fue enviado el recordatorio de 24hs, omitir
      if (t.reminder_24h_sent) {
        return false;
      }

      // Ventana de 24hs con margen: [minHours <= diffHours <= maxHours]
      return t.diffHours >= minHours && t.diffHours <= maxHours;
    });

    logs.push(
      `[ReminderService] Turnos calificados dentro de la ventana de 24hs [${minHours}h - ${maxHours}h]: ${inWindow.length}`
    );

    return { turnos: inWindow, logs };
  }

  /**
   * Obtiene las suscripciones Web Push activas vinculadas a un user_id.
   */
  private static async getPushSubscriptionsForUser(
    userId: string,
    supabaseClient: any
  ): Promise<any[]> {
    let subs: any[] = [];

    // 1. Supabase
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', userId);

        if (!error && Array.isArray(data) && data.length > 0) {
          subs = data;
        }
      } catch (_) {}
    }

    // 2. Fallback PostgreSQL
    if (subs.length === 0 && process.env.DATABASE_URL) {
      try {
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false },
        });
        const client = await pool.connect();
        try {
          const res = await client.query(
            'SELECT * FROM public.push_subscriptions WHERE user_id = $1',
            [userId]
          );
          if (res.rows.length > 0) {
            subs = res.rows;
          }
        } finally {
          client.release();
          await pool.end();
        }
      } catch (_) {}
    }

    return subs;
  }

  /**
   * Marca el turno como notificado para no repetir el recordatorio de 24hs.
   */
  private static async markReminderSent(
    turnoId: string,
    sourceTable: 'bookings' | 'turnos',
    supabaseClient: any
  ) {
    const nowIso = new Date().toISOString();

    // 1. Supabase bookings y turnos
    if (supabaseClient) {
      try {
        await supabaseClient
          .from('bookings')
          .update({
            reminder_24h_sent: true,
            reminder_24h_sent_at: nowIso,
            updated_at: nowIso,
          })
          .eq('id', turnoId);
      } catch (_) {}

      try {
        await supabaseClient
          .from('turnos')
          .update({
            reminder_24h_sent: true,
            reminder_24h_sent_at: nowIso,
          })
          .eq('id', turnoId);
      } catch (_) {}
    }

    // 2. PostgreSQL
    if (process.env.DATABASE_URL) {
      try {
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false },
        });
        const client = await pool.connect();
        try {
          await client.query(
            `UPDATE public.bookings 
             SET reminder_24h_sent = TRUE, reminder_24h_sent_at = NOW(), updated_at = NOW() 
             WHERE id = $1`,
            [turnoId]
          );
          await client.query(
            `UPDATE public.turnos 
             SET reminder_24h_sent = TRUE, reminder_24h_sent_at = NOW() 
             WHERE id = $1`,
            [turnoId]
          );
        } finally {
          client.release();
          await pool.end();
        }
      } catch (_) {}
    }
  }

  /**
   * Elimina endpoints de suscripción expirados (HTTP 410 Gone / 404 Not Found).
   */
  private static async cleanExpiredSubscriptions(
    endpoints: string[],
    supabaseClient: any
  ) {
    if (!endpoints || endpoints.length === 0) return;

    if (supabaseClient) {
      try {
        await supabaseClient
          .from('push_subscriptions')
          .delete()
          .in('endpoint', endpoints);
      } catch (_) {}
    }

    if (process.env.DATABASE_URL) {
      try {
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false },
        });
        const client = await pool.connect();
        try {
          await client.query(
            'DELETE FROM public.push_subscriptions WHERE endpoint = ANY($1)',
            [endpoints]
          );
        } finally {
          client.release();
          await pool.end();
        }
      } catch (_) {}
    }
  }

  /**
   * Ejecuta el proceso integral de recordatorios de 24 horas.
   * Diseñado para invocación periódica desde Vercel Cron ("/api/cron/reminders").
   */
  static async process24hReminders(options?: {
    minHours?: number;
    maxHours?: number;
    forceTurnoId?: string;
  }): Promise<CronRunResult> {
    const startTimeMs = Date.now();
    const nowInfo = getArgentinaNowInfo();
    const logs: string[] = [];

    logs.push(`================================================================`);
    logs.push(`[Cron Recordatorio 24hs] Inicio de ejecución.`);
    logs.push(`Horario Servidor (UTC): ${nowInfo.utcIso}`);
    logs.push(`Horario San Rafael, Mendoza (UTC-3): ${nowInfo.argentinaLocalStr}`);

    if (!vapidPublicKey || !vapidPrivateKey) {
      const msg = '[WebPush Error] Claves VAPID no configuradas en Vercel/.env.';
      logs.push(msg);
      console.error(msg);
      return {
        success: false,
        executedAtUtc: nowInfo.utcIso,
        executedAtArgentina: nowInfo.argentinaLocalStr,
        candidatesEvaluated: 0,
        in24hWindowCount: 0,
        notificationsSent: 0,
        notificationsFailed: 0,
        expiredCleaned: 0,
        turnosReminded: [],
        logs,
      };
    }

    try {
      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    } catch (_) {}

    const adminSupabase = this.getSupabaseAdminClient();
    let supabaseClient = adminSupabase;
    if (!supabaseClient) {
      try {
        supabaseClient = await createClient();
      } catch (_) {}
    }

    // 1. Localizar los turnos que cumplen la regla de 24 horas
    const { turnos: qualifiedTurnos, logs: queryLogs } = await this.findTurnosIn24hWindow(options);
    logs.push(...queryLogs);

    let sentCount = 0;
    let failedCount = 0;
    const expiredEndpoints: string[] = [];
    const remindedList: CronRunResult['turnosReminded'] = [];

    // 2. Procesar cada turno calificado
    for (const turno of qualifiedTurnos) {
      logs.push(
        `[Procesando Turno] ID: ${turno.id} | Cliente: ${turno.client_name} | Vehículo: ${turno.vehiculo} | Fecha: ${turno.date} ${turno.time} | Faltan: ${turno.diffHours}hs`
      );

      // Buscar suscripciones activas del usuario
      const subscriptions = await this.getPushSubscriptionsForUser(
        turno.user_id,
        supabaseClient
      );

      if (subscriptions.length === 0) {
        logs.push(
          `[Push 24h Aviso] El usuario ${turno.user_id} (${turno.client_name}) no tiene dispositivos en push_subscriptions.`
        );
        remindedList.push({
          id: turno.id,
          client: turno.client_name,
          vehicle: turno.vehiculo,
          date: turno.date,
          time: turno.time,
          diffHours: turno.diffHours,
          pushSent: false,
          reason: 'Usuario sin dispositivos registrados en push_subscriptions',
        });

        // Marcamos como procesado para no recalcularlo en cada hora consecutiva
        await this.markReminderSent(turno.id, turno.sourceTable, supabaseClient);
        continue;
      }

      // Preparar payload atractivo y amigable
      const payload = JSON.stringify({
        title: '⏰ Recordatorio: Mañana es tu turno de lavado',
        body: `Hola ${turno.client_name}! Te recordamos que mañana a las ${turno.time} hs tenés tu turno en AquaShine San Rafael para tu ${turno.vehiculo}. ¡Te esperamos!`,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        url: '/dashboard',
        data: {
          url: '/dashboard',
          bookingId: turno.id,
          type: 'reminder_24h',
        },
      });

      let turnoSuccess = false;

      // Enviar a todos los dispositivos registrados del cliente
      for (const sub of subscriptions) {
        if (!sub.endpoint || !sub.p256dh || !sub.auth) {
          failedCount++;
          continue;
        }

        const webPushSub = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          const pushRes = await webpush.sendNotification(webPushSub, payload);
          sentCount++;
          turnoSuccess = true;
          logs.push(
            `[Push 24h Enviado Exitosamente] Dispositivo: ${sub.endpoint.slice(0, 35)}... (Status: ${pushRes.statusCode})`
          );
        } catch (pushErr: any) {
          failedCount++;
          const status = pushErr.statusCode || pushErr.status;
          logs.push(
            `[Push 24h Error de Envío] Dispositivo: ${sub.endpoint.slice(0, 35)}... Código: ${status}. Error: ${pushErr.message}`
          );

          // Error 410 Gone / 404 Not Found: suscripción revocada o expirada
          if (status === 410 || status === 404) {
            logs.push(
              `[Push 24h Limpieza] Suscripción expirada en el navegador (HTTP ${status}). Se marcará para eliminación.`
            );
            expiredEndpoints.push(sub.endpoint);
          } else if (status === 400 || status === 413) {
            logs.push(
              `[Push 24h Payload Inválido] El navegador rechazó el payload (HTTP ${status}).`
            );
          }
        }
      }

      remindedList.push({
        id: turno.id,
        client: turno.client_name,
        vehicle: turno.vehiculo,
        date: turno.date,
        time: turno.time,
        diffHours: turno.diffHours,
        pushSent: turnoSuccess,
        reason: turnoSuccess ? 'Notificación despachada' : 'Fallo en envío push a dispositivos',
      });

      // Marcar turno como recordado para no duplicar el aviso
      await this.markReminderSent(turno.id, turno.sourceTable, supabaseClient);
    }

    // 3. Limpiar suscripciones expiradas de la base de datos
    if (expiredEndpoints.length > 0) {
      logs.push(
        `[Limpieza Suscripciones] Eliminando ${expiredEndpoints.length} endpoint(s) expirado(s) de la base de datos...`
      );
      await this.cleanExpiredSubscriptions(expiredEndpoints, supabaseClient);
    }

    const elapsedMs = Date.now() - startTimeMs;
    logs.push(
      `[Cron Recordatorio 24hs] Finalizado en ${elapsedMs}ms. Enviados: ${sentCount}, Fallidos: ${failedCount}, Expirados limpiados: ${expiredEndpoints.length}`
    );
    logs.push(`================================================================`);

    return {
      success: true,
      executedAtUtc: nowInfo.utcIso,
      executedAtArgentina: nowInfo.argentinaLocalStr,
      candidatesEvaluated: qualifiedTurnos.length,
      in24hWindowCount: qualifiedTurnos.length,
      notificationsSent: sentCount,
      notificationsFailed: failedCount,
      expiredCleaned: expiredEndpoints.length,
      turnosReminded: remindedList,
      logs,
    };
  }
}
