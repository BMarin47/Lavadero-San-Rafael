import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { isSuperAdmin } from '@/lib/auth/admin';
import { EmailService } from '@/lib/services/email.service';
import { generateWhatsAppCancellationUrl } from '@/lib/services/booking.service';
import { Pool } from 'pg';
import { prisma } from '@/lib/prisma';

/**
 * Obtiene el cliente Supabase Admin si la Service Role Key está configurada,
 * permitiendo omitir las políticas RLS para operaciones del Superadministrador.
 */
function getSupabaseAdmin() {
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

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !isSuperAdmin(user.email)) {
      return NextResponse.json(
        { error: 'Acceso denegado. Se requieren permisos de Superadministrador.' },
        { status: 403 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const clientToUse = supabaseAdmin || supabase;

    // 1. Consultar todos los bookings en Supabase (todos los usuarios, sin bloqueo RLS)
    let allBookings: any[] = [];
    try {
      const { data, error } = await clientToUse
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        allBookings = data;
      } else {
        const { data: turnosData, error: turnosErr } = await clientToUse
          .from('turnos')
          .select('*')
          .order('fecha_creacion', { ascending: false });
        if (!turnosErr && Array.isArray(turnosData) && turnosData.length > 0) {
          allBookings = turnosData;
        }
      }
    } catch (sbErr) {
      console.warn('[Admin Turnos GET Supabase]:', sbErr);
    }

    // 2. Si no trajo resultados o para complementar, consultar PostgreSQL directo
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://'))) {
      try {
        const pool = new Pool({
          connectionString: dbUrl,
          ssl: { rejectUnauthorized: false },
        });
        const client = await pool.connect();
        try {
          const res = await client.query('SELECT * FROM public.bookings ORDER BY created_at DESC');
          if (res.rows && res.rows.length > 0) {
            const existingIds = new Set(allBookings.map((b) => String(b.id)));
            for (const row of res.rows) {
              if (!existingIds.has(String(row.id))) {
                allBookings.push(row);
                existingIds.add(String(row.id));
              }
            }
          } else {
            const resTurnos = await client.query('SELECT * FROM public.turnos ORDER BY fecha_creacion DESC');
            if (resTurnos.rows && resTurnos.rows.length > 0) {
              const existingIds = new Set(allBookings.map((b) => String(b.id)));
              for (const row of resTurnos.rows) {
                if (!existingIds.has(String(row.id))) {
                  allBookings.push(row);
                  existingIds.add(String(row.id));
                }
              }
            }
          }
        } finally {
          client.release();
          await pool.end();
        }
      } catch (pgErr) {
        console.warn('[Admin Turnos GET PostgreSQL]:', pgErr);
      }
    }

    // Función auxiliar para determinar si un turno ya expiró en base a su fecha y hora de finalización
    const isPastTurno = (dateStr?: string, timeStr?: string) => {
      if (!dateStr || !timeStr) return false;
      const cleanDate = dateStr.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) return false;

      // Extraer hora de fin o calcular por defecto
      let endH = 20;
      let endM = 0;
      const matches = Array.from(timeStr.matchAll(/(\d{1,2}):(\d{2})/g));
      if (matches.length >= 2) {
        endH = parseInt(matches[1][1], 10);
        endM = parseInt(matches[1][2], 10);
      } else if (matches.length === 1) {
        endH = parseInt(matches[0][1], 10) + 2;
        endM = parseInt(matches[0][2], 10);
      }

      const [y, m, d] = cleanDate.split('-').map(Number);
      // Turno en hora de Argentina (UTC-3)
      const turnoEndUtc = new Date(Date.UTC(y, m - 1, d, endH + 3, endM, 0));
      return turnoEndUtc.getTime() <= Date.now();
    };

    // Normalizar datos para la interfaz de administración con auto-finalización de turnos pasados
    const normalizedTurnos = allBookings.map((b) => {
      const rawDate = b.date || (b.created_at ? b.created_at.split('T')[0] : '');
      const rawTime = b.time || 'Por coordinar';
      const rawStatus = (b.status || b.estado || 'confirmado').toLowerCase().trim();

      let finalStatus = rawStatus;
      // Si el turno no está cancelado pero su horario ya transcurrió, se marca como finalizado
      if (rawStatus !== 'cancelado' && rawStatus !== 'cancelled') {
        if (isPastTurno(rawDate, rawTime)) {
          finalStatus = 'finalizado';
        }
      }

      return {
        id: b.id,
        user_id: b.user_id,
        nombre_cliente: b.client_name || b.nombre_cliente || 'Cliente',
        client_email: b.client_email || null,
        client_phone: b.client_phone || b.phone || null,
        vehiculo: b.vehicle_details || b.vehiculo || 'Vehículo',
        categoria: b.service_type || b.categoria || 'General',
        precio: Number(b.price || b.precio || 0),
        indicaciones: b.notes || b.indicaciones || null,
        estado: finalStatus,
        date: rawDate,
        time: rawTime,
        fecha_creacion: b.created_at || b.fecha_creacion || new Date().toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      turnos: normalizedTurnos,
      total: normalizedTurnos.length,
    });
  } catch (error: any) {
    console.error('[Admin Turnos GET Server Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener los turnos.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !isSuperAdmin(user.email)) {
      return NextResponse.json(
        { error: 'Acceso denegado. Se requieren permisos de Superadministrador.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { id, status, date, time, notes, price, vehicle } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Se requiere el ID del turno para actualizarlo.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const clientToUse = supabaseAdmin || supabase;

    // Normalizar estado
    const normalizedStatus = status ? String(status).toLowerCase().trim() : undefined;

    // Construir objeto dinámico de actualización
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (normalizedStatus) {
      updatePayload.status = normalizedStatus;
      updatePayload.estado = normalizedStatus;
    }
    if (date !== undefined) updatePayload.date = String(date).trim();
    if (time !== undefined) updatePayload.time = String(time).trim();
    if (notes !== undefined) {
      updatePayload.notes = String(notes).trim();
      updatePayload.indicaciones = String(notes).trim();
    }
    if (price !== undefined) {
      updatePayload.price = Number(price);
      updatePayload.precio = Number(price);
    }
    if (vehicle !== undefined) {
      updatePayload.vehicle_details = String(vehicle).trim();
      updatePayload.vehiculo = String(vehicle).trim();
    }

    // 1. Obtener la información del turno antes de actualizar para garantizar datos de notificación
    let existingBooking: any = null;
    try {
      const { data: bData } = await clientToUse
        .from('bookings')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (bData) existingBooking = bData;
    } catch (_) {}

    if (!existingBooking) {
      try {
        const { data: tData } = await clientToUse
          .from('turnos')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (tData) existingBooking = tData;
      } catch (_) {}
    }

    const dbUrl = process.env.DATABASE_URL;
    if (!existingBooking && dbUrl && (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://'))) {
      try {
        const pool = new Pool({
          connectionString: dbUrl,
          ssl: { rejectUnauthorized: false },
        });
        const client = await pool.connect();
        try {
          const pgRes = await client.query('SELECT * FROM public.bookings WHERE id = $1 LIMIT 1', [id]);
          if (pgRes.rows.length > 0) {
            existingBooking = pgRes.rows[0];
          } else {
            const pgResT = await client.query('SELECT * FROM public.turnos WHERE id = $1 LIMIT 1', [id]);
            if (pgResT.rows.length > 0) {
              existingBooking = pgResT.rows[0];
            }
          }
        } finally {
          client.release();
          await pool.end();
        }
      } catch (pgErr) {
        console.warn('[Admin PATCH PG Fetch Error]:', pgErr);
      }
    }

    // Si aún no se encontró el turno, buscar en Prisma (Appointment)
    if (!existingBooking) {
      try {
        const pApp = await prisma.appointment.findUnique({
          where: { id },
          include: { user: true, vehicle: true },
        });
        if (pApp) {
          existingBooking = {
            id: pApp.id,
            user_id: pApp.userId,
            client_name: pApp.user.fullName,
            client_email: pApp.user.email,
            client_phone: pApp.user.phone,
            vehicle_details: `${pApp.vehicle.brand} ${pApp.vehicle.model}`.trim(),
            date: pApp.appointmentDate.toISOString().split('T')[0],
            time: `${pApp.startTime} a ${pApp.endTime} hs`,
            status: pApp.status,
            price: pApp.basePrice,
          };
        }
      } catch (_) {}
    }

    // Recuperar el email del cliente asociado a la reserva (garantizando el email de Google Auth)
    let clientEmail =
      existingBooking?.client_email ||
      existingBooking?.email ||
      existingBooking?.user_email ||
      body.clientEmail ||
      body.client_email ||
      body.bookingDetails?.client_email ||
      null;

    const targetUserId =
      existingBooking?.user_id ||
      existingBooking?.userId ||
      body.bookingDetails?.user_id ||
      null;

    if ((!clientEmail || !clientEmail.includes('@')) && targetUserId) {
      // 1. Buscar en Prisma User
      try {
        const pUser = await prisma.user.findUnique({ where: { id: targetUserId } });
        if (pUser?.email && pUser.email.includes('@')) {
          clientEmail = pUser.email;
        }
      } catch (_) {}

      // 2. Buscar en Supabase Auth Admin
      if ((!clientEmail || !clientEmail.includes('@')) && supabaseAdmin) {
        try {
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
          if (authUser?.user?.email && authUser.user.email.includes('@')) {
            clientEmail = authUser.user.email;
          }
        } catch (_) {}
      }

      // 3. Fallback directo a PostgreSQL (auth.users o public."User")
      if ((!clientEmail || !clientEmail.includes('@')) && dbUrl) {
        try {
          const pool = new Pool({
            connectionString: dbUrl,
            ssl: { rejectUnauthorized: false },
          });
          const client = await pool.connect();
          try {
            const pgU = await client.query('SELECT email FROM auth.users WHERE id::text = $1 LIMIT 1', [String(targetUserId)]);
            if (pgU.rows.length > 0 && pgU.rows[0].email) {
              clientEmail = pgU.rows[0].email;
            } else {
              const pgU2 = await client.query('SELECT email FROM public."User" WHERE id = $1 LIMIT 1', [String(targetUserId)]);
              if (pgU2.rows.length > 0 && pgU2.rows[0].email) {
                clientEmail = pgU2.rows[0].email;
              }
            }
          } finally {
            client.release();
            await pool.end();
          }
        } catch (_) {}
      }
    }

    const previousStatus = String(
      existingBooking?.status || existingBooking?.estado || ''
    )
      .toLowerCase()
      .trim();
    const wasAlreadyCancelled =
      previousStatus === 'cancelado' || previousStatus === 'cancelled';

    // 2. Actualizar en Supabase (tabla bookings) con permisos de administrador
    let updated = false;
    try {
      const { data, error } = await clientToUse
        .from('bookings')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (!error && data) {
        updated = true;
        existingBooking = { ...existingBooking, ...data };
      }
    } catch (sbErr) {
      console.warn('[Admin PATCH Supabase bookings]:', sbErr);
    }

    // 3. Replicar en tabla turnos
    try {
      const turnosPayload: Record<string, any> = {
        fecha_actualizacion: new Date().toISOString(),
      };
      if (updatePayload.estado) turnosPayload.estado = updatePayload.estado;
      if (updatePayload.indicaciones) turnosPayload.indicaciones = updatePayload.indicaciones;
      if (updatePayload.precio !== undefined) turnosPayload.precio = updatePayload.precio;
      if (updatePayload.vehiculo) turnosPayload.vehiculo = updatePayload.vehiculo;

      await clientToUse
        .from('turnos')
        .update(turnosPayload)
        .eq('id', id);
    } catch (_) {}

    // 4. Fallback y sincronización asegurada en PostgreSQL
    if (dbUrl && (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://'))) {
      try {
        const pool = new Pool({
          connectionString: dbUrl,
          ssl: { rejectUnauthorized: false },
        });
        const client = await pool.connect();
        try {
          if (updatePayload.status && updatePayload.date && updatePayload.time) {
            await client.query(
              `UPDATE public.bookings 
               SET status = $1, estado = $1, date = $2, time = $3, updated_at = NOW() 
               WHERE id = $4`,
              [updatePayload.status, updatePayload.date, updatePayload.time, id]
            );
          } else if (updatePayload.status) {
            await client.query(
              `UPDATE public.bookings 
               SET status = $1, estado = $1, updated_at = NOW() 
               WHERE id = $2`,
              [updatePayload.status, id]
            );
          }
          if (updatePayload.status) {
            await client.query(
              `UPDATE public.turnos 
               SET estado = $1 
               WHERE id = $2`,
              [updatePayload.status, id]
            );
          }
        } finally {
          client.release();
          await pool.end();
        }
      } catch (pgErr) {
        console.warn('[Admin PATCH PostgreSQL]:', pgErr);
      }
    }

    // Replicar en Prisma si corresponde
    if (normalizedStatus === 'cancelado') {
      try {
        await prisma.appointment.updateMany({
          where: { id },
          data: { status: 'CANCELLED' },
        });
      } catch (_) {}
    }

    // Datos consolidados para avisos
    const clientName =
      existingBooking?.client_name ||
      existingBooking?.nombre_cliente ||
      body.bookingDetails?.nombre_cliente ||
      'Cliente';
    const clientPhone =
      existingBooking?.client_phone ||
      existingBooking?.phone ||
      body.bookingDetails?.client_phone ||
      null;
    const vehicleFinal =
      updatePayload.vehicle_details ||
      existingBooking?.vehicle_details ||
      existingBooking?.vehiculo ||
      body.bookingDetails?.vehiculo ||
      'Vehículo';
    const dateFinal =
      updatePayload.date ||
      existingBooking?.date ||
      body.bookingDetails?.date ||
      'Fecha programada';
    const timeFinal =
      updatePayload.time ||
      existingBooking?.time ||
      body.bookingDetails?.time ||
      'Horario programado';
    const priceFinal =
      updatePayload.price ??
      existingBooking?.price ??
      existingBooking?.precio ??
      body.bookingDetails?.precio ??
      0;
    const serviceFinal =
      existingBooking?.service_type ||
      existingBooking?.servicio ||
      existingBooking?.categoria ||
      body.bookingDetails?.categoria ||
      'Lavado Detailing';

    let whatsAppUrl = '';

    // 5. Si el Superadministrador canceló el turno, enviar correo de cancelación UNA SOLA VEZ inmediatamente después de actualizar la BD
    if (normalizedStatus === 'cancelado' || normalizedStatus === 'cancelled') {
      const email =
        clientEmail && clientEmail.includes('@')
          ? clientEmail.trim()
          : 'bruno.marin.soporte@gmail.com';

      try {
        console.log('Enviando correo de cancelación a:', email);
        await EmailService.sendCustomerCancellationEmail({
          bookingId: String(id),
          clientEmail: email,
          clientName,
          vehicle: vehicleFinal,
          date: dateFinal,
          time: timeFinal,
          service: serviceFinal,
        });
      } catch (mailErr: any) {
        console.error('[Admin PATCH EmailService Exception Fail-safe]:', mailErr);
      }

      // Generar URL de WhatsApp dirigida al teléfono del cliente
      whatsAppUrl = generateWhatsAppCancellationUrl({
        clientPhone,
        clientName,
        vehicle: vehicleFinal,
        date: dateFinal,
        time: timeFinal,
      });
    }

    return NextResponse.json({
      success: true,
      message: normalizedStatus === 'cancelado'
        ? 'Turno cancelado exitosamente en la base de datos.'
        : 'Turno actualizado con éxito por el Superadministrador.',
      id,
      status: normalizedStatus || 'actualizado',
      whatsAppUrl,
      turno: {
        id,
        nombre_cliente: clientName,
        client_phone: clientPhone,
        client_email: clientEmail,
        vehiculo: vehicleFinal,
        date: dateFinal,
        time: timeFinal,
        estado: normalizedStatus || existingBooking?.status || 'confirmado',
      },
      updated,
    });
  } catch (error: any) {
    console.error('[Admin Turnos PATCH Server Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al actualizar el turno.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !isSuperAdmin(user.email)) {
      return NextResponse.json(
        { error: 'Acceso denegado. Se requieren permisos de Superadministrador.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Se requiere el ID del turno para eliminarlo.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const clientToUse = supabaseAdmin || supabase;

    // 1. Eliminar de Supabase bookings y turnos
    await clientToUse.from('bookings').delete().eq('id', id);
    await clientToUse.from('turnos').delete().eq('id', id);

    try {
      await prisma.appointment.deleteMany({ where: { id } });
    } catch (_) {}

    // 2. Fallback PostgreSQL
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://'))) {
      try {
        const pool = new Pool({
          connectionString: dbUrl,
          ssl: { rejectUnauthorized: false },
        });
        const client = await pool.connect();
        try {
          await client.query('DELETE FROM public.bookings WHERE id = $1', [id]);
          await client.query('DELETE FROM public.turnos WHERE id = $1', [id]);
        } finally {
          client.release();
          await pool.end();
        }
      } catch (pgErr) {
        console.warn('[Admin DELETE PG]:', pgErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Turno eliminado permanentemente por el Superadministrador.',
      id,
    });
  } catch (error: any) {
    console.error('[Admin Turnos DELETE Server Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al eliminar el turno.' },
      { status: 500 }
    );
  }
}
