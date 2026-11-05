import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { isSuperAdmin } from '@/lib/auth/admin';
import { EmailService } from '@/lib/services/email.service';
import { generateWhatsAppCancellationUrl } from '@/lib/services/booking.service';
import { Pool } from 'pg';
import { prisma } from '@/lib/prisma';

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: rawId } = await params;
    const body = await request.json().catch(() => ({}));
    const id = rawId || body.id;

    if (!id) {
      return NextResponse.json(
        { error: 'Se requiere el ID del turno para actualizarlo.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const clientToUse = supabaseAdmin || supabase;

    const normalizedStatus = body.status ? String(body.status).toLowerCase().trim() : undefined;

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (normalizedStatus) {
      updatePayload.status = normalizedStatus;
      updatePayload.estado = normalizedStatus;
    }
    if (body.date !== undefined) updatePayload.date = String(body.date).trim();
    if (body.time !== undefined) updatePayload.time = String(body.time).trim();
    if (body.notes !== undefined) {
      updatePayload.notes = String(body.notes).trim();
      updatePayload.indicaciones = String(body.notes).trim();
    }
    if (body.price !== undefined) {
      updatePayload.price = Number(body.price);
      updatePayload.precio = Number(body.price);
    }
    if (body.vehicle !== undefined) {
      updatePayload.vehicle_details = String(body.vehicle).trim();
      updatePayload.vehiculo = String(body.vehicle).trim();
    }

    // 1. Obtener la información del turno antes de actualizar
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
        console.warn('[Admin Bookings PATCH PG Fetch Error]:', pgErr);
      }
    }

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
      try {
        const pUser = await prisma.user.findUnique({ where: { id: targetUserId } });
        if (pUser?.email && pUser.email.includes('@')) {
          clientEmail = pUser.email;
        }
      } catch (_) {}

      if ((!clientEmail || !clientEmail.includes('@')) && supabaseAdmin) {
        try {
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
          if (authUser?.user?.email && authUser.user.email.includes('@')) {
            clientEmail = authUser.user.email;
          }
        } catch (_) {}
      }

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

    // 2. Actualizar en Supabase
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
    } catch (_) {}

    try {
      const turnosPayload: Record<string, any> = {
        fecha_actualizacion: new Date().toISOString(),
      };
      if (updatePayload.estado) turnosPayload.estado = updatePayload.estado;
      if (updatePayload.indicaciones) turnosPayload.indicaciones = updatePayload.indicaciones;
      if (updatePayload.precio !== undefined) turnosPayload.precio = updatePayload.precio;
      if (updatePayload.vehiculo) turnosPayload.vehiculo = updatePayload.vehiculo;

      await clientToUse.from('turnos').update(turnosPayload).eq('id', id);
    } catch (_) {}

    // 3. PostgreSQL
    if (dbUrl && (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://'))) {
      try {
        const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
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
              `UPDATE public.turnos SET estado = $1 WHERE id = $2`,
              [updatePayload.status, id]
            );
          }
        } finally {
          client.release();
          await pool.end();
        }
      } catch (_) {}
    }

    // 4. Prisma
    if (normalizedStatus === 'cancelado' || normalizedStatus === 'cancelled') {
      try {
        await prisma.appointment.updateMany({
          where: { id },
          data: { status: 'CANCELLED' },
        });
      } catch (_) {}
    }

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

    // 5. Envío de Email UNA SOLA VEZ vía EmailService inmediatamente después de actualizar la BD
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
        console.error('[Admin Bookings/[id] EmailService Fail-safe]:', mailErr);
      }

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
      message: (normalizedStatus === 'cancelado' || normalizedStatus === 'cancelled')
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
    }, { status: 200 });
  } catch (error: any) {
    console.error('[Admin Bookings/[id] PATCH Server Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al actualizar el turno.' },
      { status: 500 }
    );
  }
}
