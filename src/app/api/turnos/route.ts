import { NextResponse } from 'next/server';
import { EmailService } from '@/lib/services/email.service';
import { resolveVehicleDisplayName } from '@/lib/services/booking.service';
import { ScheduleService, normalizeVehicleType, areTimeSlotsOverlapping } from '@/lib/services/schedule.service';
import {
  VehicleCategorySchema,
  sanitizePlainText,
  sanitizeEmailInput,
  formatWhatsAppArgPhone,
} from '@/lib/validations/booking.schema';
import { BRAND_CONFIG, calculateBookingPrice } from '@/lib/config';
import { createClient } from '@/utils/supabase/server';
import { parseArgentinaAppointmentDate } from '@/lib/services/reminder.service';
import { Pool } from 'pg';
import { prisma } from '@/lib/prisma';

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
    // Obtener usuario si existe sesión activa (opcional, para vincular el turno)
    let user: any = null;
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      user = data?.user || null;
    } catch {
      user = null;
    }

    const body = await request.json();
    const clientName = sanitizePlainText(body.nombre_cliente || body.client_name || '', 80);
    const normalizedCategory = VehicleCategorySchema.catch('CAR').parse(
      body.categoria || body.vehicleType || body.vehiculo || 'CAR'
    );
    const rawVehicleDetails = sanitizePlainText(body.vehiculo || body.vehicle_details || '', 80);
    const vehicleDetails = resolveVehicleDisplayName(rawVehicleDetails || normalizedCategory);
    const serviceType = sanitizePlainText(
      body.categoria
        ? body.service_type || 'Lavado Completo Individual'
        : body.service_type || body.categoria || '',
      120
    );
    const numPrice = Number(body.precio ?? body.price ?? 0);
    const notesText =
      body.indicaciones || body.notes
        ? sanitizePlainText(body.indicaciones || body.notes, 300)
        : null;
    const bookingDate = sanitizePlainText(
      body.date || body.appointmentDate || new Date().toISOString().split('T')[0],
      20
    );
    const bookingTime = sanitizePlainText(
      body.time || (body.startTime ? `${body.startTime} a ${body.endTime} hs` : 'Por coordinar'),
      40
    );
    // Requerimiento: Todo turno nuevo solicitado ingresa directamente como CONFIRMADO
    const bookingStatus = 'confirmado';
    const effectiveUserId = user?.id || body.user_id || body.userId || `anon_${Date.now()}`;
    const effectiveEmail =
      sanitizeEmailInput(user?.email || body.client_email || body.userEmail || body.email) ||
      'cliente@lavadero.com';
    const effectivePhone = formatWhatsAppArgPhone(body.client_phone || body.phone || '');

    if (!clientName || !vehicleDetails || !serviceType) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios para registrar el turno.' },
        { status: 400 }
      );
    }

    const parsedStartTime =
      body.startTime ||
      bookingTime.match(/(\d{1,2}:\d{2})/)?.[1]?.padStart(5, '0') ||
      bookingTime.split(' ')[0] ||
      '09:00';
    const parsedEndTime =
      body.endTime ||
      bookingTime.split(' ')[2] ||
      '11:00';

    // Validar disponibilidad estricta (1 único cupo por bloque horario con solapamiento cruzado)
    if (/^\d{4}-\d{2}-\d{2}$/.test(bookingDate) && parsedStartTime) {
      const availability = await ScheduleService.getAvailability(
        bookingDate,
        body.categoria
      );
      if (!availability.isOpen) {
        return NextResponse.json(
          { error: availability.reasonClosed || 'El lavadero se encuentra cerrado en la fecha seleccionada.' },
          { status: 400 }
        );
      }
      const candidateStr = `${parsedStartTime} a ${parsedEndTime}`;
      const slotMatch = availability.slots.find(
        (s) =>
          s.startTime === parsedStartTime ||
          areTimeSlotsOverlapping(`${s.startTime} a ${s.endTime}`, candidateStr)
      );
      if (slotMatch && !slotMatch.isAvailable) {
        return NextResponse.json(
          { error: 'Lo sentimos, este horario ya fue reservado o colisiona con otro turno agendado. Por favor seleccioná otro turno disponible.' },
          { status: 409 }
        );
      }
    }

    const sharedBookingId = crypto.randomUUID();
    let createdRecord: any = null;
    let usedSource = 'none';

    // 1. Guardar turno en Prisma para registrar la reserva en la base de datos
    try {
      const userRecord = await prisma.user.upsert({
        where: { email: effectiveEmail },
        update: {
          fullName: clientName || undefined,
          phone: effectivePhone || undefined,
        },
        create: {
          email: effectiveEmail,
          fullName: clientName || 'Cliente',
          phone: effectivePhone || '',
          role: 'CUSTOMER',
        },
      });

      const vehicleRecord = await prisma.vehicle.create({
        data: {
          userId: userRecord.id,
          vehicleType: normalizeVehicleType(body.categoria),
          brand: body.brand || 'General',
          model: vehicleDetails || 'Vehículo',
        },
      });

      const parts = bookingDate.split('-').map(Number);
      const appDate =
        parts.length === 3
          ? new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0))
          : new Date();

      const prismaAppointment = await prisma.appointment.create({
        data: {
          id: sharedBookingId,
          userId: userRecord.id,
          vehicleId: vehicleRecord.id,
          appointmentDate: appDate,
          startTime: parsedStartTime,
          endTime: parsedEndTime,
          status: 'CONFIRMED',
          basePrice: numPrice,
          notes: notesText,
        },
      });

      createdRecord = {
        id: prismaAppointment.id,
        user_id: userRecord.id,
        nombre_cliente: clientName,
        vehiculo: vehicleDetails,
        categoria: serviceType,
        precio: numPrice,
        indicaciones: notesText,
        estado: bookingStatus,
        fecha_creacion: prismaAppointment.createdAt.toISOString(),
        date: bookingDate,
        time: bookingTime,
      };
      usedSource = 'prisma:appointment';
    } catch (prismaErr) {
      console.warn('[Prisma Booking Notice]:', prismaErr);
    }

    // 2. Intentar inserción en la tabla 'bookings' o 'turnos' de Supabase Cloud
    try {
      const supabase = await createClient();
      const { data: bookingSupabase, error: bookingErr } = await supabase
        .from('bookings')
        .insert({
          id: sharedBookingId,
          user_id: effectiveUserId,
          vehicle_details: vehicleDetails,
          service_type: serviceType,
          date: bookingDate,
          time: bookingTime,
          status: bookingStatus,
          client_name: clientName,
          client_email: effectiveEmail,
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
        if (!createdRecord) {
          createdRecord = bookingSupabase;
          usedSource = 'supabase:bookings';
        }
      } else {
        const { data: turnoSupabase, error: turnoErr } = await supabase
          .from('turnos')
          .insert({
            id: sharedBookingId,
            user_id: effectiveUserId,
            nombre_cliente: clientName,
            vehiculo: vehicleDetails,
            categoria: serviceType,
            precio: numPrice,
            indicaciones: notesText,
            estado: bookingStatus,
          })
          .select()
          .single();

        if (!turnoErr && turnoSupabase && !createdRecord) {
          createdRecord = turnoSupabase;
          usedSource = 'supabase:turnos';
        }
      }
    } catch (sbErr) {
      console.warn('[Supabase Booking Notice]:', sbErr);
    }

    if (!createdRecord) {
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
              effectiveUserId,
              vehicleDetails,
              serviceType,
              bookingDate,
              bookingTime,
              bookingStatus,
              clientName,
              effectiveEmail,
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

          createdRecord = insertRes.rows[0];
          usedSource = 'postgresql:bookings';
        } finally {
          client.release();
          await pool.end();
        }
      }
    }

    if (createdRecord) {
      let emailStatus: {
        sent: boolean;
        emailId?: string;
        errorCategory?: string;
        errorMessage?: string;
      } = { sent: false };

      try {
        emailStatus = await EmailService.sendBookingConfirmation({
          appointmentId: String(createdRecord.id || ''),
          userFullName: clientName,
          userEmail: effectiveEmail,
          userPhone: effectivePhone,
          vehicleType: normalizedCategory,
          vehicleSummary: vehicleDetails,
          appointmentDate: bookingDate,
          startTime: bookingTime,
          serviceDescription: serviceType,
          paymentMethod: body.paymentMethod || body.metodo_pago,
          amount: numPrice,
          notes: notesText,
        });

        if (!emailStatus.sent) {
          console.error(
            '[API Turnos POST][Email Failure en Vercel]: El turno se guardó pero falló el envío del correo a bruno.marin.soporte@gmail.com:',
            emailStatus
          );
        }
      } catch (emailErr: any) {
        console.error(
          '[API Turnos POST][Excepción Crítica Email en Vercel]:',
          {
            message: emailErr?.message,
            code: emailErr?.code,
            stack: emailErr?.stack,
          }
        );
      }

      return NextResponse.json({
        success: true,
        source: usedSource,
        message: 'Turno registrado correctamente.',
        turno: createdRecord,
        emailSent: emailStatus.sent,
        emailErrorCategory: emailStatus.errorCategory,
        emailErrorMessage: emailStatus.errorMessage,
      });
    }

    return NextResponse.json(
      { error: 'No se pudo guardar el turno en la base de datos. Verificá la configuración de la base de datos.' },
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
    let bookingToCancelData: any = null;
    if (normalizedStatus === 'cancelado') {
      const { data: bookingToCancel } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle();

      bookingToCancelData = bookingToCancel;
      if (!bookingToCancelData) {
        const { data: turnoToCancel } = await supabase
          .from('turnos')
          .select('*')
          .eq('id', id)
          .eq('user_id', user.id)
          .maybeSingle();
        bookingToCancelData = turnoToCancel;
      }

      const dateToCheck = bookingToCancelData?.date || (bookingToCancelData as any)?.fecha;
      const timeToCheck = bookingToCancelData?.time || (bookingToCancelData as any)?.hora;

      if (dateToCheck) {
        const appointmentDate = parseArgentinaAppointmentDate(dateToCheck, timeToCheck);
        if (appointmentDate) {
          const diffHours = (appointmentDate.getTime() - Date.now()) / (1000 * 60 * 60);

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

    // 4. Si se canceló exitosamente, sincronizar con Prisma y enviar alerta por email automática con Resend
    if (normalizedStatus === 'cancelado') {
      try {
        await prisma.appointment.updateMany({
          where: { id },
          data: { status: 'CANCELLED' },
        });
      } catch (_) {}

      try {
        const clientName =
          bookingToCancelData?.client_name ||
          bookingToCancelData?.nombre_cliente ||
          user.user_metadata?.full_name ||
          user.email?.split('@')[0] ||
          'Cliente';

        const clientEmail =
          bookingToCancelData?.client_email ||
          user.email;

        const clientPhone =
          bookingToCancelData?.client_phone ||
          bookingToCancelData?.phone ||
          user.user_metadata?.phone;

        const vehicle =
          bookingToCancelData?.vehicle_details ||
          bookingToCancelData?.vehiculo ||
          'Vehículo';

        const category =
          bookingToCancelData?.category ||
          bookingToCancelData?.categoria;

        const service =
          bookingToCancelData?.service_type ||
          bookingToCancelData?.servicio ||
          bookingToCancelData?.categoria ||
          'Lavado Completo';

        const date =
          bookingToCancelData?.date ||
          (bookingToCancelData as any)?.fecha ||
          'Fecha programada';

        const time =
          bookingToCancelData?.time ||
          (bookingToCancelData as any)?.hora ||
          'Horario programado';

        const price =
          bookingToCancelData?.price ||
          bookingToCancelData?.precio;

        const email =
          clientEmail && clientEmail.includes('@')
            ? clientEmail.trim()
            : 'bruno.marin.soporte@gmail.com';

        console.log('Enviando correo de cancelación a:', email);
        await EmailService.sendCancellationNotification({
          bookingId: String(id),
          clientName,
          clientEmail: email,
          clientPhone,
          vehicle,
          category,
          service,
          date,
          time,
          price,
        });
      } catch (emailErr) {
        console.error('[Error enviando email de cancelación en /api/turnos]:', emailErr);
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

    try {
      await prisma.appointment.deleteMany({ where: { id } });
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
