import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { EmailService } from '@/lib/services/email.service';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. Manejo especializado para avisos de Cancelación de Turnos
    if (
      body.type === 'cancellation' ||
      body.action === 'cancellation' ||
      body.isCancellation === true ||
      body.status === 'cancelado'
    ) {
      if (!body.bookingId && !body.clientEmail && !body.userEmail) {
        return NextResponse.json(
          { error: 'Parámetros insuficientes para la notificación de cancelación.' },
          { status: 400 }
        );
      }

      const cancellationResult = await EmailService.sendCancellationNotification({
        bookingId: body.bookingId || body.id || '',
        clientName: body.clientName || body.userFullName || body.nombre_cliente || 'Cliente',
        clientEmail: body.clientEmail || body.userEmail || body.email,
        clientPhone: body.clientPhone || body.userPhone || body.phone,
        vehicle:
          body.vehicle ||
          body.vehiculo ||
          `${body.vehicleBrand || ''} ${body.vehicleModel || ''}`.trim() ||
          'Vehículo',
        category: body.category || body.categoria || body.vehicleType,
        service: body.service || body.serviceDescription || body.servicio || 'Lavado Completo',
        date: body.date || body.appointmentDate || 'Fecha programada',
        time: body.time || (body.startTime ? `${body.startTime} a ${body.endTime} hs` : 'Horario programado'),
        price: body.price || body.precio || body.amount,
        notes: body.notes || body.indicaciones,
      });

      return NextResponse.json({
        message: 'Notificación de cancelación enviada correctamente.',
        ...cancellationResult,
      });
    }

    const {
      userEmail,
      userFullName,
      userPhone,
      vehicleType,
      vehicleBrand,
      vehicleModel,
      appointmentDate,
      startTime,
      endTime,
      serviceDescription,
      amount,
      homeDelivery,
      deliveryAddress,
      notes,
    } = body;

    // VALIDACIÓN ESTRICTA DE ENTRADA (Anti-Spam / Anti-Relay abuse)
    if (!userEmail || !appointmentDate || !startTime) {
      return NextResponse.json(
        { error: 'Faltan parámetros obligatorios para registrar la reserva (userEmail, appointmentDate, startTime).' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(userEmail).trim())) {
      return NextResponse.json(
        { error: 'El formato del correo electrónico es inválido.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY?.trim();

    if (!apiKey) {
      console.log('[Resend Error]: RESEND_API_KEY no está configurada en las variables de entorno de Vercel.');
      return NextResponse.json(
        { error: 'RESEND_API_KEY no configurada en las variables de entorno de Vercel.' },
        { status: 500 }
      );
    }

    const resend = new Resend(apiKey);

    // Remitente forzado para cumplir con el sandbox de Resend
    const fromEmail = 'onboarding@resend.dev';

    // Destinatario estático fijado SIEMPRE a la casilla del administrador
    const toEmail = 'bruno.marin.soporte@gmail.com';

    // Datos del cliente enviados desde el formulario
    const clientName = userFullName?.trim() || 'Cliente';
    const clientEmail = (userEmail || body.email || 'No proporcionado').trim();
    const clientPhone = (userPhone || body.phone || 'No proporcionado').trim();
    const vehicleText = `${vehicleBrand || ''} ${vehicleModel || ''}`.trim() || 'Vehículo';

    const categoryMap: Record<string, string> = {
      CAR: 'Auto (Hatchback / Sedán)',
      SUV: 'SUV / Monovolumen',
      PICKUP: 'Camioneta / Utilitario',
    };
    const categoryLabel = categoryMap[vehicleType] || vehicleType || 'Auto';

    const formattedAmount = typeof amount === 'number'
      ? amount.toLocaleString('es-AR')
      : amount || '0';

    // Número limpio para el botón de respuesta al cliente vía WhatsApp
    const rawDigits = clientPhone.replace(/\D/g, '');
    const cleanCustomerDigits = rawDigits.startsWith('549')
      ? rawDigits
      : rawDigits.startsWith('54')
      ? `549${rawDigits.slice(2).replace(/^0+/, '')}`
      : `549${rawDigits.replace(/^0+/, '')}`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nueva Reserva - Lavadero San Rafael</title>
</head>
<body style="margin: 0; padding: 0; background-color: #06090f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #06090f; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #0d131f; border-radius: 20px; border: 1px solid #1e293b; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 30px 20px; text-align: center; background: linear-gradient(180deg, rgba(6, 182, 212, 0.18) 0%, rgba(13, 19, 31, 0) 100%);">
              <div style="display: inline-block; padding: 5px 14px; border-radius: 9999px; background-color: rgba(6, 182, 212, 0.2); border: 1px solid rgba(6, 182, 212, 0.4); color: #22d3ee; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 12px;">
                🔔 Alerta de Nueva Reserva (Admin)
              </div>
              <h1 style="margin: 0 0 6px; font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">
                AquaShine <span style="color: #22d3ee;">San Rafael</span>
              </h1>
              <p style="margin: 0; font-size: 13px; color: #94a3b8;">
                Se ha generado una nueva solicitud de turno a través de la Web App
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 10px 30px 25px;">
              <p style="font-size: 15px; color: #e2e8f0; margin-top: 0; line-height: 1.6;">
                Hola <strong>Administrador</strong>, un cliente acaba de confirmar un turno para el lavadero:
              </p>

              <!-- Card: Datos del Cliente -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #131c2e; border: 1px solid #1e293b; border-radius: 14px; padding: 18px 20px; margin-bottom: 16px;">
                <tr>
                  <td colspan="2" style="padding-bottom: 8px; font-size: 12px; font-weight: 800; color: #22d3ee; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1px solid #1e293b;">
                    👤 Información del Cliente
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0 4px; font-size: 13px; color: #94a3b8;">Nombre y Apellido:</td>
                  <td style="padding: 8px 0 4px; font-size: 13px; color: #ffffff; text-align: right; font-weight: 700;">${clientName}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #94a3b8;">Correo del Cliente:</td>
                  <td style="padding: 4px 0; font-size: 13px; color: #22d3ee; text-align: right; font-weight: 600;">${clientEmail}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0 8px; font-size: 13px; color: #94a3b8;">WhatsApp / Teléfono:</td>
                  <td style="padding: 4px 0 8px; font-size: 13px; color: #ffffff; text-align: right; font-weight: 700;">${clientPhone}</td>
                </tr>
              </table>

              <!-- Card: Detalles del Turno y Vehículo -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #131c2e; border: 1px solid #1e293b; border-radius: 14px; padding: 18px 20px; margin-bottom: 24px;">
                <tr>
                  <td colspan="2" style="padding-bottom: 8px; font-size: 12px; font-weight: 800; color: #22d3ee; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1px solid #1e293b;">
                    🚗 Detalles del Vehículo y Turno
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0 4px; font-size: 13px; color: #94a3b8;">Vehículo (Marca y Modelo):</td>
                  <td style="padding: 8px 0 4px; font-size: 13px; color: #ffffff; text-align: right; font-weight: 700;">${vehicleText}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #94a3b8;">Categoría:</td>
                  <td style="padding: 4px 0; font-size: 13px; color: #ffffff; text-align: right;">${categoryLabel}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #94a3b8;">Servicio:</td>
                  <td style="padding: 4px 0; font-size: 13px; color: #22d3ee; text-align: right; font-weight: 700;">${serviceDescription || 'Lavado Completo'}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #94a3b8;">Fecha solicitada:</td>
                  <td style="padding: 4px 0; font-size: 13px; color: #ffffff; text-align: right; font-weight: 700;">📅 ${appointmentDate}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #94a3b8;">Horario de atención:</td>
                  <td style="padding: 4px 0; font-size: 13px; color: #ffffff; text-align: right; font-weight: 700;">⏰ ${startTime} a ${endTime} hs</td>
                </tr>
                ${
                  homeDelivery && deliveryAddress
                    ? `
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #94a3b8;">Entrega a domicilio:</td>
                  <td style="padding: 4px 0; font-size: 13px; color: #ffffff; text-align: right;">🚚 ${deliveryAddress}</td>
                </tr>`
                    : ''
                }
                ${
                  notes
                    ? `
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #94a3b8;">Indicaciones especiales:</td>
                  <td style="padding: 4px 0; font-size: 13px; color: #facc15; text-align: right;">📝 ${notes}</td>
                </tr>`
                    : ''
                }
                <tr>
                  <td style="padding: 10px 0 4px; font-size: 14px; color: #ffffff; border-top: 1px solid #1e293b; font-weight: 800;">Monto Total:</td>
                  <td style="padding: 10px 0 4px; font-size: 18px; color: #22d3ee; text-align: right; border-top: 1px solid #1e293b; font-weight: 900;">$${formattedAmount} ARS</td>
                </tr>
              </table>

              <!-- Botón Contactar al Cliente por WhatsApp -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 15px;">
                <tr>
                  <td align="center">
                    <a href="https://wa.me/${cleanCustomerDigits}?text=${encodeURIComponent(`Hola ${clientName}, nos comunicamos desde AquaShine San Rafael para coordinar tu turno de ${vehicleText} el día ${appointmentDate}.`)}" target="_blank" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; border-radius: 12px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);">
                      💬 Abrir WhatsApp con ${clientName}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px 30px; background-color: #080c14; border-top: 1px solid #1e293b; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #475569;">
                Sistema de Notificaciones Automáticas • AquaShine San Rafael
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

    console.log(`[Resend]: Enviando notificación interna de reserva a "${toEmail}" desde "${fromEmail}"...`);

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [toEmail],
      subject: `🚨 ¡Nueva Reserva Recibida! - ${clientName} (${vehicleText} • ${appointmentDate})`,
      html: htmlContent,
    });

    if (error) {
      console.log('[Resend Error Detalle Servidor]:', JSON.stringify(error, null, 2));
      return NextResponse.json(
        {
          error: error.message || 'Error enviando el correo de alerta interna con Resend.',
          details: error,
        },
        { status: 500 }
      );
    }

    console.log('[Resend Éxito]: Notificación enviada al admin con éxito:', toEmail, 'ID de entrega:', data?.id);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (err: any) {
    console.log('[SendEmail API Error Servidor]:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno del servidor al procesar el correo.' },
      { status: 500 }
    );
  }
}
