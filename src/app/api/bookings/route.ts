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

    // Intentar registrar complementariamente en la tabla bookings de Supabase
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.id) {
        const vehicleSummary = `${body.vehicleBrand || ''} ${body.vehicleModel}`.trim() || body.vehicleType;
        const timeRange = `${body.startTime} a ${body.endTime} hs`;
        await supabase.from('bookings').insert({
          user_id: user.id,
          vehicle_details: vehicleSummary,
          service_type: body.serviceMode === 'SUBSCRIPTION' ? `Suscripción ${body.subscriptionPlanCode || ''}` : 'Lavado Individual',
          date: body.appointmentDate,
          time: timeRange,
          status: body.paymentMethod === 'CASH' ? 'confirmado' : 'pendiente',
          client_name: body.userFullName,
          client_email: body.userEmail,
          client_phone: body.userPhone,
          notes: body.notes || null,
          nombre_cliente: body.userFullName,
          vehiculo: vehicleSummary,
          categoria: body.vehicleType,
          indicaciones: body.notes || null,
          estado: body.paymentMethod === 'CASH' ? 'confirmado' : 'pendiente',
        });
      }
    } catch (sbErr) {
      console.warn('[API Bookings Supabase sync notice]:', sbErr);
    }

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
