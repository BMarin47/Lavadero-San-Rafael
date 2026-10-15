import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { isSuperAdmin } from '@/lib/auth/admin';
import { EmailService } from '@/lib/services/email.service';
import { generateWhatsAppCancellationUrl } from '@/lib/services/booking.service';
import { Pool } from 'pg';
import { Resend } from 'resend';
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
      null;

    const targetUserId =
      existingBooking?.user_id ||
      existingBooking?.userId ||
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
    const clientName = existingBooking?.client_name || existingBooking?.nombre_cliente || 'Cliente';
    const clientPhone = existingBooking?.client_phone || existingBooking?.phone || null;
    const vehicleFinal = updatePayload.vehicle_details || existingBooking?.vehicle_details || existingBooking?.vehiculo || 'Vehículo';
    const dateFinal = updatePayload.date || existingBooking?.date || 'Fecha programada';
    const timeFinal = updatePayload.time || existingBooking?.time || 'Horario programado';
    const priceFinal = updatePayload.price ?? existingBooking?.price ?? existingBooking?.precio ?? 0;
    const serviceFinal = existingBooking?.service_type || existingBooking?.servicio || 'Lavado Detailing';

    let whatsAppUrl = '';

    // 5. Si el Superadministrador canceló el turno, notificar al cliente por email vía Resend (Fail-safe)
    if (normalizedStatus === 'cancelado') {
      // Envío de correo al cliente informando la cancelación por imprevisto con botón a la web
      if (clientEmail && clientEmail.includes('@')) {
        try {
          const resendApiKey = process.env.RESEND_API_KEY?.trim();
          if (!resendApiKey) {
            console.warn('[Admin Cancelación]: RESEND_API_KEY no configurada. Omitiendo envío de correo al cliente.');
          } else {
            const resend = new Resend(resendApiKey);
            const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || 'Lavadero San Rafael <onboarding@resend.dev>';

            const cancellationHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aviso importante sobre tu turno - Lavadero San Rafael</title>
</head>
<body style="margin: 0; padding: 0; background-color: #06090f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #06090f; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #0d131f; border-radius: 20px; border: 1px solid #1e293b; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 28px 24px; text-align: center; background: linear-gradient(180deg, rgba(239, 68, 68, 0.15) 0%, rgba(13, 19, 31, 0) 100%);">
              <div style="display: inline-block; padding: 6px 14px; border-radius: 9999px; background-color: rgba(239, 68, 68, 0.18); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 14px;">
                ⚠️ Aviso de Cancelación
              </div>
              <h1 style="margin: 0 0 6px; font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">
                AquaShine <span style="color: #22d3ee;">San Rafael</span>
              </h1>
              <p style="margin: 0; font-size: 13px; color: #94a3b8;">
                Estética Vehicular & Detailing Profesional
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 10px 30px 28px;">
              <p style="font-size: 16px; color: #f1f5f9; margin-top: 0; line-height: 1.6;">
                Hola <strong>${clientName}</strong>,
              </p>
              <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin-bottom: 20px;">
                Te contactamos para informarte que, lamentablemente por un <strong>imprevisto operativo</strong> en nuestras instalaciones, hemos tenido que cancelar tu turno programado:
              </p>

              <!-- Card con datos del turno -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #131c2e; border: 1px solid #1e293b; border-radius: 14px; padding: 18px 20px; margin-bottom: 24px;">
                <tr>
                  <td colspan="2" style="padding-bottom: 10px; font-size: 12px; font-weight: 800; color: #f87171; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1px solid #1e293b;">
                    Detalles del Turno Cancelado
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0 4px; font-size: 13px; color: #94a3b8;">🚗 Vehículo:</td>
                  <td style="padding: 10px 0 4px; font-size: 13px; color: #ffffff; text-align: right; font-weight: 700;">${vehicleFinal}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #94a3b8;">📅 Fecha:</td>
                  <td style="padding: 4px 0; font-size: 13px; color: #ffffff; text-align: right; font-weight: 700;">${dateFinal}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #94a3b8;">⏰ Horario:</td>
                  <td style="padding: 4px 0; font-size: 13px; color: #ffffff; text-align: right; font-weight: 700;">${timeFinal}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0 6px; font-size: 13px; color: #94a3b8;">✨ Servicio:</td>
                  <td style="padding: 4px 0 6px; font-size: 13px; color: #22d3ee; text-align: right; font-weight: 700;">${serviceFinal}</td>
                </tr>
              </table>

              <p style="font-size: 14px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px;">
                Te pedimos sinceras disculpas por las molestias ocasionadas. Ya podés elegir un nuevo día y horario disponible ingresando directamente a nuestra plataforma:
              </p>

              <!-- Botón Reprogramar Turno -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 26px;">
                <tr>
                  <td align="center">
                    <a href="https://lavadero-san-rafael.vercel.app" target="_blank" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 800; border-radius: 12px; box-shadow: 0 4px 20px rgba(6, 182, 212, 0.35); letter-spacing: 0.3px;">
                      📅 Reprogramar Mi Turno
                    </a>
                  </td>
                </tr>
              </table>

              <div style="background-color: rgba(30, 41, 59, 0.5); border: 1px solid #1e293b; border-radius: 12px; padding: 14px 16px;">
                <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                  💬 Si abonaste mediante Mercado Pago o preferís coordinar personalmente con nosotros, podés escribirnos respondiendo a este correo o por WhatsApp.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; background-color: #080c14; border-top: 1px solid #1e293b; text-align: center;">
              <p style="margin: 0 0 4px; font-size: 12px; font-weight: 700; color: #cbd5e1;">
                Lavadero San Rafael
              </p>
              <p style="margin: 0; font-size: 11px; color: #64748b;">
                San Rafael, Mendoza, Argentina • Cuidamos cada detalle de tu vehículo
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
            `;

            const emailRes = await resend.emails.send({
              from: fromEmail,
              to: [clientEmail],
              subject: 'Aviso importante sobre tu turno - Lavadero San Rafael',
              html: cancellationHtml,
            });

            if (emailRes.error) {
              console.error('[Admin Cancelación Resend Error]:', emailRes.error);
            } else {
              console.log('[Admin Cancelación Resend Exitoso]: Correo enviado a', clientEmail, 'ID:', emailRes.data?.id);
            }
          }
        } catch (mailErr: any) {
          // Fail-safe: No bloquea la cancelación en la base de datos ni la respuesta 200 al frontend
          console.error('[Admin PATCH Resend Exception Fail-safe]:', mailErr);
        }
      } else {
        console.warn(`[Admin Cancelación]: No se encontró un correo electrónico válido para notificar la cancelación del turno ${id}.`);
      }

      // Notificación complementaria interna y log de trazabilidad
      try {
        await EmailService.sendCancellationNotification({
          bookingId: String(id),
          clientName,
          clientEmail,
          clientPhone,
          vehicle: vehicleFinal,
          category: existingBooking?.category || existingBooking?.categoria || 'General',
          service: serviceFinal,
          date: dateFinal,
          time: timeFinal,
          price: priceFinal,
        });
      } catch (internalMailErr) {
        console.warn('[Admin PATCH Email Notification Warning]:', internalMailErr);
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
