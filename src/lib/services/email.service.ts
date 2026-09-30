import { Resend } from 'resend';
import { sanitizeWhatsAppPhone } from './booking.service';

export interface CancellationEmailParams {
  bookingId: string;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  vehicle: string;
  category?: string | null;
  service?: string | null;
  date: string;
  time: string;
  price?: number | string | null;
  notes?: string | null;
}

/**
 * Servicio centralizado para el envío de correos electrónicos vía Resend.
 * Incluye protección contra rate-limiting, manejo seguro de errores y
 * plantillas HTML profesionales con el diseño de AquaShine San Rafael.
 */
export class EmailService {
  /**
   * Envía un correo con reintento automático en caso de rate-limit (código HTTP 429).
   */
  private static async sendWithRateLimitRetry(
    resend: Resend,
    payload: {
      from: string;
      to: string[];
      subject: string;
      html: string;
    },
    maxRetries = 2
  ) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await resend.emails.send(payload);
        if (result.error) {
          const errStatus = (result.error as any).statusCode || (result.error as any).status;
          if (errStatus === 429 && attempt < maxRetries) {
            console.warn(`[Resend Rate-Limit]: Esperando ${(attempt + 1) * 800}ms antes de reintentar...`);
            await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 800));
            continue;
          }
        }
        return result;
      } catch (err: any) {
        if ((err?.statusCode === 429 || err?.status === 429) && attempt < maxRetries) {
          console.warn(`[Resend Rate-Limit Catch]: Reintentando en ${(attempt + 1) * 800}ms...`);
          await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 800));
          continue;
        }
        throw err;
      }
    }
    return { data: null, error: new Error('Excedido el número máximo de reintentos') };
  }

  /**
   * Envía notificación inmediata por email al administrador (y al cliente)
   * cuando un turno es cancelado cumpliendo la regla de 24 horas.
   */
  static async sendCancellationNotification(params: CancellationEmailParams) {
    const apiKey = process.env.RESEND_API_KEY?.trim();

    if (!apiKey) {
      console.warn(
        '[Resend Cancelación]: RESEND_API_KEY no configurada en las variables de entorno. Se omite el envío de email.'
      );
      return { success: false, reason: 'missing_api_key' };
    }

    const resend = new Resend(apiKey);

    const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || 'onboarding@resend.dev';
    const adminEmail = process.env.ADMIN_EMAIL?.trim() || 'bruno.marin.soporte@gmail.com';

    const clientName = params.clientName?.trim() || 'Cliente';
    const clientEmail = params.clientEmail?.trim() || '';
    const clientPhone = params.clientPhone?.trim() || 'No proporcionado';
    const vehicle = params.vehicle?.trim() || 'Vehículo';
    const category = params.category?.trim() || 'General';
    const service = params.service?.trim() || 'Lavado Completo';
    const date = params.date?.trim() || 'Por coordinar';
    const time = params.time?.trim() || 'Por coordinar';
    const bookingIdDisplay = params.bookingId ? params.bookingId.slice(0, 8).toUpperCase() : 'N/A';

    const formattedPrice =
      typeof params.price === 'number'
        ? params.price.toLocaleString('es-AR')
        : params.price || '0';

    const cleanCustomerDigits = sanitizeWhatsAppPhone(clientPhone);

    // ==========================================
    // 1. Plantilla HTML para el Administrador
    // ==========================================
    const adminHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aviso de Turno Cancelado - AquaShine San Rafael</title>
</head>
<body style="margin: 0; padding: 0; background-color: #06090f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #06090f; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #0d131f; border-radius: 20px; border: 1px solid #1e293b; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          
          <!-- Encabezado con gradiente rojo/ámbar para alertar cancelación -->
          <tr>
            <td style="padding: 32px 30px 20px; text-align: center; background: linear-gradient(180deg, rgba(239, 68, 68, 0.22) 0%, rgba(13, 19, 31, 0) 100%);">
              <div style="display: inline-block; padding: 5px 14px; border-radius: 9999px; background-color: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 12px;">
                ⚠️ Alerta de Turno Cancelado (Admin)
              </div>
              <h1 style="margin: 0 0 6px; font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">
                AquaShine <span style="color: #22d3ee;">San Rafael</span>
              </h1>
              <p style="margin: 0; font-size: 13px; color: #94a3b8;">
                Un turno programado ha sido cancelado con más de 24 horas de anticipación
              </p>
            </td>
          </tr>

          <!-- Cuerpo Principal -->
          <tr>
            <td style="padding: 10px 30px 25px;">
              <p style="font-size: 15px; color: #e2e8f0; margin-top: 0; line-height: 1.6;">
                Hola <strong>Administrador</strong>, el cliente <strong>${clientName}</strong> ha cancelado su reserva. El horario indicado a continuación ha quedado <strong>libre y disponible</strong> en el sistema:
              </p>

              <!-- Tarjeta: Datos del Horario y Turno Liberado -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #131c2e; border: 1px solid #1e293b; border-radius: 14px; padding: 18px 20px; margin-bottom: 16px;">
                <tr>
                  <td colspan="2" style="padding-bottom: 8px; font-size: 12px; font-weight: 800; color: #f87171; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1px solid #1e293b;">
                    📅 Horario Liberado en la Agenda
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0 4px; font-size: 13px; color: #94a3b8;">ID de Reserva:</td>
                  <td style="padding: 8px 0 4px; font-size: 13px; color: #ffffff; text-align: right; font-weight: 700;">#${bookingIdDisplay}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #94a3b8;">Fecha del Turno:</td>
                  <td style="padding: 4px 0; font-size: 14px; color: #38bdf8; text-align: right; font-weight: 800;">📅 ${date}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #94a3b8;">Horario Liberado:</td>
                  <td style="padding: 4px 0; font-size: 14px; color: #4ade80; text-align: right; font-weight: 800;">⏰ ${time}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #94a3b8;">Vehículo:</td>
                  <td style="padding: 4px 0; font-size: 13px; color: #ffffff; text-align: right; font-weight: 700;">🚗 ${vehicle}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #94a3b8;">Categoría / Servicio:</td>
                  <td style="padding: 4px 0; font-size: 13px; color: #ffffff; text-align: right;">${category} • ${service}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0 4px; font-size: 14px; color: #ffffff; border-top: 1px solid #1e293b; font-weight: 800;">Monto Original:</td>
                  <td style="padding: 10px 0 4px; font-size: 16px; color: #94a3b8; text-decoration: line-through; text-align: right; border-top: 1px solid #1e293b; font-weight: 700;">$${formattedPrice} ARS</td>
                </tr>
              </table>

              <!-- Tarjeta: Información del Cliente -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #131c2e; border: 1px solid #1e293b; border-radius: 14px; padding: 18px 20px; margin-bottom: 24px;">
                <tr>
                  <td colspan="2" style="padding-bottom: 8px; font-size: 12px; font-weight: 800; color: #22d3ee; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1px solid #1e293b;">
                    👤 Datos del Cliente
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0 4px; font-size: 13px; color: #94a3b8;">Nombre y Apellido:</td>
                  <td style="padding: 8px 0 4px; font-size: 13px; color: #ffffff; text-align: right; font-weight: 700;">${clientName}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #94a3b8;">Correo Electrónico:</td>
                  <td style="padding: 4px 0; font-size: 13px; color: #22d3ee; text-align: right; font-weight: 600;">${clientEmail || 'No informado'}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0 8px; font-size: 13px; color: #94a3b8;">WhatsApp / Teléfono:</td>
                  <td style="padding: 4px 0 8px; font-size: 13px; color: #ffffff; text-align: right; font-weight: 700;">${clientPhone}</td>
                </tr>
              </table>

              <!-- Botón Contactar al Cliente por WhatsApp si tiene teléfono -->
              ${
                cleanCustomerDigits
                  ? `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 15px;">
                <tr>
                  <td align="center">
                    <a href="https://wa.me/${cleanCustomerDigits}?text=${encodeURIComponent(
                      `Hola ${clientName}, nos comunicamos desde AquaShine San Rafael sobre la cancelación de tu turno del día ${date} a las ${time}.`
                    )}" target="_blank" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; border-radius: 12px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);">
                      💬 Abrir WhatsApp con ${clientName}
                    </a>
                  </td>
                </tr>
              </table>`
                  : ''
              }

              <div style="background-color: rgba(34, 211, 238, 0.08); border: 1px solid rgba(34, 211, 238, 0.2); border-radius: 12px; padding: 12px 16px; margin-top: 10px;">
                <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                  ℹ️ <strong>Estado del Cupo:</strong> El turno ha sido actualizado a estado <em>'cancelado'</em> y el espacio queda disponible para futuras reservas en el sistema.
                </p>
              </div>

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

    console.log(
      `[Resend Cancelación]: Enviando alerta de cancelación a admin "${adminEmail}" desde "${fromEmail}"...`
    );

    let adminResult: any = null;
    let clientResult: any = null;

    try {
      adminResult = await this.sendWithRateLimitRetry(resend, {
        from: fromEmail,
        to: [adminEmail],
        subject: `🚨 Turno Cancelado - ${clientName} (${vehicle} • ${date} ${time}) - Cupo Liberado`,
        html: adminHtml,
      });

      if (adminResult.error) {
        console.error('[Resend Error Admin Cancelación]:', adminResult.error);
      } else {
        console.log(
          '[Resend Éxito Admin Cancelación]: Alerta enviada con éxito. ID:',
          adminResult.data?.id
        );
      }
    } catch (err: any) {
      console.error('[Resend Fallo Fatal Admin Cancelación]:', err);
    }

    // ==========================================
    // 2. Copia opcional de Confirmación al Cliente
    // ==========================================
    if (
      clientEmail &&
      clientEmail.includes('@') &&
      clientEmail.toLowerCase() !== adminEmail.toLowerCase()
    ) {
      try {
        const clientHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Cancelación de Turno Confirmada - AquaShine San Rafael</title>
</head>
<body style="margin: 0; padding: 0; background-color: #06090f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #06090f; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #0d131f; border-radius: 20px; border: 1px solid #1e293b; overflow: hidden;">
          <tr>
            <td style="padding: 30px; text-align: center; background: linear-gradient(180deg, rgba(6, 182, 212, 0.18) 0%, rgba(13, 19, 31, 0) 100%);">
              <h1 style="margin: 0 0 6px; font-size: 22px; font-weight: 900; color: #ffffff;">
                AquaShine <span style="color: #22d3ee;">San Rafael</span>
              </h1>
              <p style="margin: 0; font-size: 13px; color: #94a3b8;">
                Confirmación de Cancelación de Turno
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 25px 30px;">
              <p style="font-size: 15px; color: #e2e8f0; line-height: 1.6;">
                Hola <strong>${clientName}</strong>,
              </p>
              <p style="font-size: 14px; color: #94a3b8; line-height: 1.6;">
                Te confirmamos que tu turno para <strong>${vehicle}</strong> programado para el día <strong>${date}</strong> a las <strong>${time}</strong> ha sido cancelado exitosamente en nuestra plataforma cumpliendo la política de anticipación mínima.
              </p>
              <p style="font-size: 14px; color: #94a3b8; line-height: 1.6;">
                Si deseas reprogramar tu lavado para otra fecha o realizar alguna consulta, puedes hacerlo directamente desde nuestra Web App o escribirnos por WhatsApp.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 30px; background-color: #080c14; border-top: 1px solid #1e293b; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #475569;">
                AquaShine San Rafael • Cuidamos cada detalle de tu vehículo
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

        clientResult = await this.sendWithRateLimitRetry(resend, {
          from: fromEmail,
          to: [clientEmail],
          subject: `Cancelación de Turno Confirmada - AquaShine San Rafael (${date})`,
          html: clientHtml,
        });

        if (clientResult.error) {
          console.log(
            '[Resend Aviso Cliente Cancelación]: No se pudo entregar copia al cliente (esperable si el dominio no está verificado en Resend):',
            clientResult.error.message || clientResult.error
          );
        } else {
          console.log(
            '[Resend Éxito Cliente Cancelación]: Confirmación enviada al cliente. ID:',
            clientResult.data?.id
          );
        }
      } catch (clientErr: any) {
        console.log(
          '[Resend Aviso Cliente Excepción]: Omitiendo copia al cliente sin afectar al admin:',
          clientErr.message || clientErr
        );
      }
    }

    return {
      success: true,
      adminSent: !!adminResult?.data?.id,
      clientSent: !!clientResult?.data?.id,
      adminEmailId: adminResult?.data?.id,
    };
  }
}
