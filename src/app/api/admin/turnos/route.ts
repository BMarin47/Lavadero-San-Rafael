import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isSuperAdmin } from '@/lib/auth/admin';
import { EmailService } from '@/lib/services/email.service';
import { Pool } from 'pg';

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

    // 1. Consultar todos los bookings en Supabase (todos los usuarios)
    let allBookings: any[] = [];
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        allBookings = data;
      }
    } catch (sbErr) {
      console.warn('[Admin Turnos GET Supabase]:', sbErr);
    }

    // 2. Si no trajo resultados o para complementar, consultar PostgreSQL directo
    const dbUrl = process.env.DATABASE_URL;
    if (allBookings.length === 0 && dbUrl && (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://'))) {
      try {
        const pool = new Pool({
          connectionString: dbUrl,
          ssl: { rejectUnauthorized: false },
        });
        const client = await pool.connect();
        try {
          const res = await client.query('SELECT * FROM public.bookings ORDER BY created_at DESC');
          if (res.rows && res.rows.length > 0) {
            allBookings = res.rows;
          } else {
            const resTurnos = await client.query('SELECT * FROM public.turnos ORDER BY fecha_creacion DESC');
            allBookings = resTurnos.rows;
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

    // Construir objeto dinámico de actualización
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (status !== undefined) {
      const normalizedStatus = String(status).toLowerCase().trim();
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

    // 1. Obtener la información del turno antes de actualizar
    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    // 2. Actualizar en Supabase (tabla bookings)
    let updated = false;
    try {
      const { data, error } = await supabase
        .from('bookings')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (!error && data) {
        updated = true;
      }
    } catch (sbErr) {
      console.warn('[Admin PATCH Supabase bookings]:', sbErr);
    }

    // 3. Replicar en tabla turnos
    try {
      const turnosPayload: Record<string, any> = {};
      if (updatePayload.estado) turnosPayload.estado = updatePayload.estado;
      if (updatePayload.indicaciones) turnosPayload.indicaciones = updatePayload.indicaciones;
      if (updatePayload.precio) turnosPayload.precio = updatePayload.precio;
      if (updatePayload.vehiculo) turnosPayload.vehiculo = updatePayload.vehiculo;

      await supabase
        .from('turnos')
        .update(turnosPayload)
        .eq('id', id);
    } catch (_) {}

    // 4. Fallback PostgreSQL
    const dbUrl = process.env.DATABASE_URL;
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
        } finally {
          client.release();
          await pool.end();
        }
      } catch (pgErr) {
        console.warn('[Admin PATCH PostgreSQL]:', pgErr);
      }
    }

    // 5. Si el Superadministrador canceló el turno, notificar por email
    if (updatePayload.status === 'cancelado') {
      try {
        await EmailService.sendCancellationNotification({
          bookingId: String(id),
          clientName: existingBooking?.client_name || existingBooking?.nombre_cliente || 'Cliente',
          clientEmail: existingBooking?.client_email,
          clientPhone: existingBooking?.client_phone || existingBooking?.phone,
          vehicle: existingBooking?.vehicle_details || existingBooking?.vehiculo || 'Vehículo',
          category: existingBooking?.category || existingBooking?.categoria,
          service: existingBooking?.service_type || existingBooking?.servicio || 'Lavado',
          date: updatePayload.date || existingBooking?.date || 'Fecha programada',
          time: updatePayload.time || existingBooking?.time || 'Horario programado',
          price: updatePayload.price || existingBooking?.price,
        });
      } catch (mailErr) {
        console.error('[Admin PATCH Email Notification Warning]:', mailErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Turno actualizado con éxito por el Superadministrador.',
      id,
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

    // 1. Eliminar de Supabase bookings y turnos
    await supabase.from('bookings').delete().eq('id', id);
    await supabase.from('turnos').delete().eq('id', id);

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
