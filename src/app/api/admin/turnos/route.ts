import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { isSuperAdmin } from '@/lib/auth/admin';
import { EmailService } from '@/lib/services/email.service';
import { generateWhatsAppCancellationUrl } from '@/lib/services/booking.service';
import { Pool } from 'pg';

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

    // Normalizar datos para la interfaz de administración
    const normalizedTurnos = allBookings.map((b) => ({
      id: b.id,
      user_id: b.user_id,
      nombre_cliente: b.client_name || b.nombre_cliente || 'Cliente',
      client_email: b.client_email || null,
      client_phone: b.client_phone || b.phone || null,
      vehiculo: b.vehicle_details || b.vehiculo || 'Vehículo',
      categoria: b.service_type || b.categoria || 'General',
      precio: Number(b.price || b.precio || 0),
      indicaciones: b.notes || b.indicaciones || null,
      estado: b.status || b.estado || 'confirmado',
      date: b.date || (b.created_at ? b.created_at.split('T')[0] : ''),
      time: b.time || 'Por coordinar',
      fecha_creacion: b.created_at || b.fecha_creacion || new Date().toISOString(),
    }));

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

    // Datos consolidados para avisos
    const clientName = existingBooking?.client_name || existingBooking?.nombre_cliente || 'Cliente';
    const clientEmail = existingBooking?.client_email || null;
    const clientPhone = existingBooking?.client_phone || existingBooking?.phone || null;
    const vehicleFinal = updatePayload.vehicle_details || existingBooking?.vehicle_details || existingBooking?.vehiculo || 'Vehículo';
    const dateFinal = updatePayload.date || existingBooking?.date || 'Fecha programada';
    const timeFinal = updatePayload.time || existingBooking?.time || 'Horario programado';
    const priceFinal = updatePayload.price ?? existingBooking?.price ?? existingBooking?.precio ?? 0;

    let whatsAppUrl = '';

    // 5. Si el Superadministrador canceló el turno, notificar por email y por WhatsApp
    if (normalizedStatus === 'cancelado') {
      try {
        await EmailService.sendCancellationNotification({
          bookingId: String(id),
          clientName,
          clientEmail,
          clientPhone,
          vehicle: vehicleFinal,
          category: existingBooking?.category || existingBooking?.categoria || 'General',
          service: existingBooking?.service_type || existingBooking?.servicio || 'Lavado Detailing',
          date: dateFinal,
          time: timeFinal,
          price: priceFinal,
        });
      } catch (mailErr) {
        console.error('[Admin PATCH Email Notification Warning]:', mailErr);
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
