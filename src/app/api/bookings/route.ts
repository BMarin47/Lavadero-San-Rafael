import { NextRequest, NextResponse } from 'next/server';
import { BookingService, CreateBookingDTO } from '@/lib/services/booking.service';
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
        { error: 'No autorizado. Debés iniciar sesión para ver tus reservas.' },
        { status: 401 }
      );
    }

    // 1. Consultar tabla bookings en Supabase
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && bookings) {
      return NextResponse.json({ success: true, source: 'supabase', bookings });
    }

    // 2. Fallback a PostgreSQL directo
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://'))) {
      const pool = new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false },
      });
      const client = await pool.connect();
      try {
        const res = await client.query(
          'SELECT * FROM public.bookings WHERE user_id = $1 ORDER BY created_at DESC',
          [user.id]
        );
        return NextResponse.json({ success: true, source: 'postgresql', bookings: res.rows });
      } finally {
        client.release();
        await pool.end();
      }
    }

    return NextResponse.json({ success: true, bookings: [] });
  } catch (error: any) {
    console.error('[API Bookings GET Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener reservas.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateBookingDTO;

    // Validaciones requeridas de reserva
    if (!body.userEmail || !body.vehicleModel || !body.appointmentDate || !body.startTime || !body.endTime) {
      return NextResponse.json(
        { error: 'Datos incompletos para realizar la reserva. Por favor completá el modelo de vehículo y horario.' },
        { status: 400 }
      );
    }

    const appBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      `${request.nextUrl.protocol}//${request.nextUrl.host}`;


    const result = await BookingService.createBooking(body, appBaseUrl);

    return NextResponse.json(
      {
        success: true,
        message:
          body.paymentMethod === 'CASH'
            ? '¡Turno confirmado con éxito! Abonarás en efectivo en el taller al entregar tu vehículo.'
            : result.mpCheckoutUrl
            ? 'Turno reservado temporalmente. Procede al pago con Mercado Pago para asegurar tu lugar.'
            : '¡Turno confirmado exitosamente!',
        data: result,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[API Bookings Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Error procesando la reserva.' },
      { status: 400 }
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
    let updatedInSupabase = false;
    try {
      const { data, error } = await supabase
        .from('bookings')
        .update({
          status: normalizedStatus,
          estado: normalizedStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .maybeSingle();

      if (!error && data) {
        updatedInSupabase = true;
      }
    } catch (sbErr) {
      console.warn('[PATCH /api/bookings Supabase update notice]:', sbErr);
    }

    // 2. Replicar en tabla turnos para consistencia
    try {
      await supabase
        .from('turnos')
        .update({
          estado: normalizedStatus,
        })
        .eq('id', id)
        .eq('user_id', user.id);
    } catch (_) {}

    // 3. Fallback a PostgreSQL remoto si DATABASE_URL existe
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
        console.warn('[PATCH /api/bookings PG update warning]:', pgErr);
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
      updatedInSupabase,
    });
  } catch (err: any) {
    console.error('[API Bookings PATCH Server Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno al actualizar la reserva.' },
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

    // 1. Eliminar en Supabase
    try {
      await supabase.from('bookings').delete().eq('id', id).eq('user_id', user.id);
      await supabase.from('turnos').delete().eq('id', id).eq('user_id', user.id);
    } catch (_) {}

    // 2. Eliminar en PostgreSQL directo
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
    console.error('[API Bookings DELETE Server Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno al eliminar la reserva.' },
      { status: 500 }
    );
  }
}
