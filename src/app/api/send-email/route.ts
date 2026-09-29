import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(request: Request) {
  try {
    const body = await request.json();

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

    // Capturar y sanitizar correctamente el email del cliente
    const recipientEmail = (userEmail || body.email || body.to || '').trim();

    if (!recipientEmail) {
      console.log('[Resend Error]: No se proporcionó correo de destinatario en el formulario.');
      return NextResponse.json(
        { error: 'El correo electrónico del cliente es obligatorio.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY?.trim();

    if (!apiKey) {
      console.log('[Resend Error]: RESEND_API_KEY no está configurada en las variables de entorno del servidor.');
      return NextResponse.json(
        { error: 'RESEND_API_KEY no configurada en las variables de entorno de Vercel.' },
        { status: 500 }
      );
    }

    const resend = new Resend(apiKey);

    // Remitente EXACTO para la capa gratuita de Resend
    const fromEmail = 'onboarding@resend.dev';

    const formattedAmount = typeof amount === 'number'
      ? amount.toLocaleString('es-AR')
      : amount || '0';

    const vehicleText = `${vehicleBrand || ''} ${vehicleModel || ''}`.trim() || 'Vehículo';
    const clientName = userFullName || 'Cliente';

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Turno Confirmado - AquaShine San Rafael</title>
</head>
<body style="margin: 0; padding: 0; background-color: #06090f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #06090f; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #0d131f; border-radius: 20px; border: 1px solid #1e293b; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 30px 20px; text-align: center; background: linear-gradient(180deg, rgba(6, 182, 212, 0.12) 0%, rgba(13, 19, 31, 0) 100%);">
              <div style="display: inline-block; padding: 4px 12px; border-radius: 9999px; background-color: rgba(6, 182, 212, 0.15); border: 1px solid rgba(6, 182, 212, 0.3); color: #22d3ee; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
                Reserva Confirmada
              </div>
              <h1 style="margin: 0 0 6px; font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">
                AquaShine <span style="color: #22d3ee;">San Rafael</span>
              </h1>
              <p style="margin: 0; font-size: 13px; color: #94a3b8;">
                Lavadero Artesanal & Detailing de Alta Gama
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 10px 30px 25px;">
              <p style="font-size: 15px; color: #e2e8f0; margin-top: 0; line-height: 1.6;">
                ¡Hola <strong>${clientName}</strong>! 👋
              </p>
              <p style="font-size: 14px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px;">
                Tu turno para el cuidado de tu vehículo ha sido registrado con éxito. A continuación encontrarás el resumen de tu reserva:
              </p>

              <!-- Card Detalle -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #131c2e; border: 1px solid #1e293b; border-radius: 14px; padding: 18px 20px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #94a3b8;">📅 <strong>Fecha:</strong></td>
                  <td style="padding: 6px 0; font-size: 13px; color: #ffffff; text-align: right; font-weight: 600;">${appointmentDate}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #94a3b8;">⏰ <strong>Horario:</strong></td>
                  <td style="padding: 6px 0; font-size: 13px; color: #ffffff; text-align: right; font-weight: 600;">${startTime} a ${endTime} hs</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #94a3b8;">🚗 <strong>Vehículo:</strong></td>
                  <td style="padding: 6px 0; font-size: 13px; color: #ffffff; text-align: right; font-weight: 600;">${vehicleText}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #94a3b8;">🧼 <strong>Servicio:</strong></td>
                  <td style="padding: 6px 0; font-size: 13px; color: #22d3ee; text-align: right; font-weight: 600;">${serviceDescription || 'Lavado Completo'}</td>
                </tr>
                ${
                  homeDelivery && deliveryAddress
                    ? `
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #94a3b8;">🚚 <strong>Entrega a domicilio:</strong></td>
                  <td style="padding: 6px 0; font-size: 13px; color: #ffffff; text-align: right;">${deliveryAddress}</td>
                </tr>`
                    : ''
                }
                <tr>
                  <td style="padding: 10px 0 4px; font-size: 14px; color: #ffffff; border-top: 1px solid #1e293b; font-weight: 700;">💰 <strong>Total:</strong></td>
                  <td style="padding: 10px 0 4px; font-size: 17px; color: #22d3ee; text-align: right; border-top: 1px solid #1e293b; font-weight: 900;">$${formattedAmount} ARS</td>
                </tr>
              </table>

              <!-- Botón Contactar WhatsApp -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
                <tr>
                  <td align="center">
                    <a href="https://wa.me/5492604654255" target="_blank" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; border-radius: 12px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);">
                      💬 Abrir WhatsApp del Lavadero
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size: 12px; color: #64748b; line-height: 1.5; text-align: center; margin: 0;">
                📍 San Rafael, Mendoza • Contacto directo: +54 9 260 465-4255<br>
                Te esperamos 10 minutos antes del horario indicado para la recepción de la unidad.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px 30px; background-color: #080c14; border-top: 1px solid #1e293b; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #475569;">
                © ${new Date().getFullYear()} AquaShine San Rafael. Todos los derechos reservados.
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

    console.log(`[Resend]: Iniciando envío de correo hacia "${recipientEmail}" desde remitente forzado "${fromEmail}"...`);

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [recipientEmail],
      subject: `¡Turno Confirmado! - AquaShine San Rafael (${appointmentDate})`,
      html: htmlContent,
    });

    if (error) {
      console.log('[Resend Error Detalle Servidor]:', JSON.stringify(error, null, 2));
      return NextResponse.json(
        {
          error: error.message || 'Error enviando el correo de confirmación con Resend.',
          details: error,
        },
        { status: 500 }
      );
    }

    console.log('[Resend Éxito]: Correo enviado satisfactoriamente a:', recipientEmail, 'ID de entrega:', data?.id);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (err: any) {
    console.log('[SendEmail API Error Servidor]:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}
