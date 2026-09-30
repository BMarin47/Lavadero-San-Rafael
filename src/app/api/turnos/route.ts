import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { Pool } from 'pg';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autorizado. Debés iniciar sesión para ver tus turnos.' },
        { status: 401 }
      );
    }

    // 1. Intentar consultar desde la tabla 'bookings' en Supabase Cloud
    const { data: bookingsSupabase, error: bookingsError } = await supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false });

    if (!bookingsError && bookingsSupabase && bookingsSupabase.length > 0) {
      const normalized = bookingsSupabase.map((b: any) => ({
        id: b.id,
        user_id: b.user_id,
        nombre_cliente: b.client_name || b.nombre_cliente || user.user_metadata?.full_name || 'Cliente',
        vehiculo: b.vehicle_details || b.vehiculo || 'Vehículo',
        categoria: b.service_type || b.categoria || 'Servicio General',
        precio: Number(b.price ?? b.precio ?? 0),
        indicaciones: b.notes || b.indicaciones || (b.date && b.time ? `Turno: ${b.date} ${b.time}` : null),
        estado: b.status || b.estado || 'pendiente',
        fecha_creacion: b.created_at || b.fecha_creacion || new Date().toISOString(),
        date: b.date,
        time: b.time,
      }));
      return NextResponse.json({ success: true, source: 'supabase', table: 'bookings', turnos: normalized });
    }

    // 2. Si no hay turnos en bookings o la tabla no está creada, consultar la tabla 'turnos' en Supabase
    const { data: turnosSupabase, error: dbError } = await supabase
      .from('turnos')
      .select('*')
      .order('fecha_creacion', { ascending: false });

    if (!dbError && turnosSupabase && turnosSupabase.length > 0) {
      return NextResponse.json({ success: true, source: 'supabase', table: 'turnos', turnos: turnosSupabase });
    }

    // 3. Fallback a base de datos PostgreSQL remota (DATABASE_URL)
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://'))) {
      const pool = new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false },
      });
      const client = await pool.connect();
      try {
        // Buscar en bookings primero
        try {
          const resBookings = await client.query(
            'SELECT * FROM public.bookings WHERE user_id = $1 ORDER BY created_at DESC',
            [user.id]
          );
          if (resBookings.rows.length > 0) {
            const mapped = resBookings.rows.map((b: any) => ({
              id: b.id,
              user_id: b.user_id,
              nombre_cliente: b.client_name || b.nombre_cliente || 'Cliente',
              vehiculo: b.vehicle_details || b.vehiculo,
              categoria: b.service_type || b.categoria,
              precio: Number(b.price ?? b.precio ?? 0),
              indicaciones: b.notes || b.indicaciones,
              estado: b.status || b.estado || 'pendiente',
              fecha_creacion: b.created_at || b.fecha_creacion,
              date: b.date,
              time: b.time,
            }));
            return NextResponse.json({ success: true, source: 'postgresql', table: 'bookings', turnos: mapped });
          }
        } catch (_) {}

        // Fallback a turnos en Postgres
        const res = await client.query(
          'SELECT * FROM public.turnos WHERE user_id = $1 ORDER BY fecha_creacion DESC',
          [user.id]
        );
        return NextResponse.json({ success: true, source: 'postgresql', table: 'turnos', turnos: res.rows });
      } finally {
        client.release();
        await pool.end();
      }
    }

    return NextResponse.json({ success: true, turnos: [] });
  } catch (err: any) {
    console.error('[API Turnos GET Server Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autorizado. Iniciá sesión para registrar tu reserva.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const clientName = String(body.nombre_cliente || body.client_name || '').trim();
    const vehicleDetails = String(body.vehiculo || body.vehicle_details || '').trim();
    const serviceType = String(body.categoria || body.service_type || '').trim();
    const numPrice = Number(body.precio ?? body.price ?? 0);
    const notesText = body.indicaciones || body.notes ? String(body.indicaciones || body.notes).trim() : null;
    const bookingDate = String(body.date || body.appointmentDate || new Date().toISOString().split('T')[0]);
    const bookingTime = String(body.time || (body.startTime ? `${body.startTime} a ${body.endTime} hs` : 'Por coordinar'));
    const bookingStatus = String(body.status || body.estado || 'confirmado');

    if (!clientName || !vehicleDetails || !serviceType) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios para registrar el turno.' },
        { status: 400 }
      );
    }

    let createdRecord: any = null;
    let usedSource = 'none';

    // 1. Intentar inserción en la tabla 'bookings' de Supabase Cloud
    const { data: bookingSupabase, error: bookingErr } = await supabase
      .from('bookings')
      .insert({
        user_id: user.id,
        vehicle_details: vehicleDetails,
        service_type: serviceType,
        date: bookingDate,
        time: bookingTime,
        status: bookingStatus,
        client_name: clientName,
        client_email: user.email,
        price: numPrice,
        notes: notesText,
        nombre_cliente: clientName,
        vehiculo: vehicleDetails,
        categoria: serviceType,
        precio: numPrice,
        indicaciones: notesText,
        estado: bookingStatus,
      })
      .select()
      .single();

    if (!bookingErr && bookingSupabase) {
      createdRecord = bookingSupabase;
      usedSource = 'supabase:bookings';
    } else {
      // 2. Si falló bookings en Supabase, probar la tabla 'turnos'
      const { data: turnoSupabase, error: turnoErr } = await supabase
        .from('turnos')
        .insert({
          user_id: user.id,
          nombre_cliente: clientName,
          vehiculo: vehicleDetails,
          categoria: serviceType,
          precio: numPrice,
          indicaciones: notesText,
          estado: bookingStatus,
        })
        .select()
        .single();

      if (!turnoErr && turnoSupabase) {
        createdRecord = turnoSupabase;
        usedSource = 'supabase:turnos';
      }
    }

    if (createdRecord) {
      return NextResponse.json({
        success: true,
        source: usedSource,
        message: 'Turno registrado correctamente en Supabase.',
        turno: createdRecord,
      });
    }

    // 3. Fallback directo a base de datos PostgreSQL remota (DATABASE_URL)
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://'))) {
      const pool = new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false },
      });
      const client = await pool.connect();
      try {
        // Asegurar que la tabla bookings exista en PostgreSQL
        await client.query(`
          CREATE TABLE IF NOT EXISTS public.bookings (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id TEXT NOT NULL,
              vehicle_details TEXT NOT NULL,
              service_type TEXT NOT NULL,
              date TEXT NOT NULL,
              time TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'pendiente',
              created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
              client_name TEXT,
              client_email TEXT,
              client_phone TEXT,
              price NUMERIC NOT NULL DEFAULT 0,
              notes TEXT,
              nombre_cliente TEXT,
              vehiculo TEXT,
              categoria TEXT,
              precio NUMERIC,
              indicaciones TEXT,
              estado TEXT DEFAULT 'pendiente',
              fecha_creacion TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
          );

          CREATE TABLE IF NOT EXISTS public.turnos (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id TEXT NOT NULL,
              nombre_cliente TEXT NOT NULL,
              vehiculo TEXT NOT NULL,
              categoria TEXT NOT NULL,
              precio NUMERIC NOT NULL,
              indicaciones TEXT,
              estado TEXT NOT NULL DEFAULT 'pendiente',
              fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
          );
        `);

        const insertRes = await client.query(
          `INSERT INTO public.bookings (
            user_id, vehicle_details, service_type, date, time, status,
            client_name, client_email, price, notes,
            nombre_cliente, vehiculo, categoria, precio, indicaciones, estado
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
           RETURNING *`,
          [
            user.id,
            vehicleDetails,
            serviceType,
            bookingDate,
            bookingTime,
            bookingStatus,
            clientName,
            user.email,
            numPrice,
            notesText,
            clientName,
            vehicleDetails,
            serviceType,
            numPrice,
            notesText,
            bookingStatus,
          ]
        );

        return NextResponse.json({
          success: true,
          source: 'postgresql:bookings',
          message: 'Turno registrado correctamente en la base de datos PostgreSQL.',
          turno: insertRes.rows[0],
        });
      } finally {
        client.release();
        await pool.end();
      }
    }

    return NextResponse.json(
      { error: 'No se pudo guardar el turno en la base de datos. Verificá la configuración de Supabase.' },
      { status: 500 }
    );
  } catch (err: any) {
    console.error('[API Turnos POST Server Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autorizado. Debés iniciar sesión para actualizar reservas.' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos: id y status son obligatorios.' },
        { status: 400 }
      );
    }

    const normalizedStatus = String(status).toLowerCase().trim();

    // Restricción de Cancelación: Solo si faltan más de 24 horas
    if (normalizedStatus === 'cancelado') {
      const { data: bookingToCancel } = await supabase
        .from('bookings')
        .select('date, time')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (bookingToCancel && bookingToCancel.date) {
        let startTime = '09:00';
        const match = bookingToCancel.time?.match(/(\d{1,2}:\d{2})/);
        if (match) {
          startTime = match[1].padStart(5, '0');
        }
        const [year, month, day] = bookingToCancel.date.split('-').map(Number);
        const [hour, minute] = startTime.split(':').map(Number);
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
          const appointmentDate = new Date(year, month - 1, day, hour || 9, minute || 0, 0);
          const now = new Date();
          const diffHours = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);

          if (diffHours < 24) {
            return NextResponse.json(
              {
                error:
                  'La opción de cancelar turno solo está disponible si faltan más de 24 horas para la fecha y hora programada del lavado.',
              },
              { status: 400 }
            );
          }
        }
      }
    }

    // 1. Actualizar en Supabase (tabla bookings)
    try {
      await supabase
        .from('bookings')
        .update({
          status: normalizedStatus,
          estado: normalizedStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id);
    } catch (_) {}

    // 2. Actualizar en Supabase (tabla turnos)
    try {
      await supabase
        .from('turnos')
        .update({
          estado: normalizedStatus,
        })
        .eq('id', id)
        .eq('user_id', user.id);
    } catch (_) {}

    // 3. Fallback en PostgreSQL
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://'))) {
      const pool = new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false },
      });
      const client = await pool.connect();
      try {
        await client.query(
          `UPDATE public.bookings 
           SET status = $1, estado = $1, updated_at = NOW() 
           WHERE id = $2 AND user_id = $3`,
          [normalizedStatus, id, user.id]
        );
        await client.query(
          `UPDATE public.turnos 
           SET estado = $1 
           WHERE id = $2 AND user_id = $3`,
          [normalizedStatus, id, user.id]
        );
      } catch (pgErr) {
        console.warn('[PATCH /api/turnos PG update warning]:', pgErr);
      } finally {
        client.release();
        await pool.end();
      }
    }

    return NextResponse.json({
      success: true,
      message: `El estado del turno ha sido actualizado a "${normalizedStatus}".`,
      id,
      status: normalizedStatus,
    });
  } catch (err: any) {
    console.error('[API Turnos PATCH Server Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno al actualizar la reserva.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autorizado. Debés iniciar sesión para eliminar tus reservas.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Se requiere el parámetro id de la reserva a eliminar.' },
        { status: 400 }
      );
    }

    try {
      await supabase.from('bookings').delete().eq('id', id).eq('user_id', user.id);
      await supabase.from('turnos').delete().eq('id', id).eq('user_id', user.id);
    } catch (_) {}

    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://'))) {
      const pool = new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false },
      });
      const client = await pool.connect();
      try {
        await client.query('DELETE FROM public.bookings WHERE id = $1 AND user_id = $2', [id, user.id]);
        await client.query('DELETE FROM public.turnos WHERE id = $1 AND user_id = $2', [id, user.id]);
      } finally {
        client.release();
        await pool.end();
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Reserva eliminada exitosamente.',
      id,
    });
  } catch (err: any) {
    console.error('[API Turnos DELETE Server Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno al eliminar la reserva.' },
      { status: 500 }
    );
  }
}
