import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { isSuperAdmin } from '@/lib/auth/admin';
import { EmailService } from '@/lib/services/email.service';
import { generateWhatsAppCancellationUrl } from '@/lib/services/booking.service';
import { Pool } from 'pg';
import { Resend } from 'resend';
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
      null;

    const targetUserId =
      existingBooking?.user_id ||
      existingBooking?.userId ||
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

    const clientName = existingBooking?.client_name || existingBooking?.nombre_cliente || 'Cliente';
    const clientPhone = existingBooking?.client_phone || existingBooking?.phone || null;
    const vehicleFinal = updatePayload.vehicle_details || existingBooking?.vehicle_details || existingBooking?.vehiculo || 'Vehículo';
    const dateFinal = updatePayload.date || existingBooking?.date || 'Fecha programada';
    const timeFinal = updatePayload.time || existingBooking?.time || 'Horario programado';
    const priceFinal = updatePayload.price ?? existingBooking?.price ?? existingBooking?.precio ?? 0;
    const serviceFinal = existingBooking?.service_type || existingBooking?.servicio || 'Lavado Detailing';

    let whatsAppUrl = '';

    // 5. Envío de Email con Resend (Fail-safe)
    if (normalizedStatus === 'cancelado' || normalizedStatus === 'cancelled') {
      if (clientEmail && clientEmail.includes('@')) {
        try {
          const resendApiKey = process.env.RESEND_API_KEY?.trim();
          if (!resendApiKey) {
            console.warn('[Admin Bookings/[id] Resend]: RESEND_API_KEY no configurada.');
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
          <tr>
            <td style="padding: 10px 30px 28px;">
              <p style="font-size: 16px; color: #f1f5f9; margin-top: 0; line-height: 1.6;">
                Hola <strong>${clientName}</strong>,
              </p>
              <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin-bottom: 20px;">
                Te contactamos para informarte que, lamentablemente por un <strong>imprevisto operativo</strong> en nuestras instalaciones, hemos tenido que cancelar tu turno programado:
              </p>
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

            await resend.emails.send({
              from: fromEmail,
              to: [clientEmail],
              subject: 'Aviso importante sobre tu turno - Lavadero San Rafael',
              html: cancellationHtml,
            });
          }
        } catch (mailErr: any) {
          console.error('[Admin Bookings/[id] Resend Fail-safe]:', mailErr);
        }
      }

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
      } catch (_) {}

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
