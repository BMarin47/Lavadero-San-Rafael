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

export interface CustomerCancellationEmailParams {
  clientEmail: string;
  clientName?: string;
  vehicle?: string;
  date?: string;
  time?: string;
  service?: string;
  notes?: string | null;
}

export interface BookingConfirmationEmailParams {
  appointmentId?: string;
  userFullName: string;
  userEmail: string;
  userPhone?: string;
  vehicleType?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleSummary?: string;
  appointmentDate: string;
  startTime: string;
  endTime?: string;
  serviceDescription?: string;
  paymentMethod?: string;
  amount?: number | string;
  homeDelivery?: boolean;
  deliveryAddress?: string;
  notes?: string | null;
}

export const ADMIN_CONFIRMATION_EMAIL =
  process.env.NOTIFICATION_EMAIL?.trim() ||
  process.env.ADMIN_EMAIL?.trim() ||
  'bruno.marin.soporte@gmail.com';

/**
 * Clasifica cualquier error de envío de correo (Resend API / SMTP / Red / Credenciales)
 * para mostrar el motivo exacto en la pestaña 'Logs' de Vercel.
 */
export function classifyEmailError(error: any): {
  category:
    | 'CREDENTIALS_MISSING'
    | 'AUTH_OR_INVALID_API_KEY'
    | 'RESEND_SANDBOX_RESTRICTION'
    | 'RATE_LIMIT_EXCEEDED'
    | 'PORT_OR_NETWORK_BLOCKED'
    | 'TIMEOUT_ERROR'
    | 'DNS_ERROR'
    | 'UNKNOWN_ERROR';
  diagnosticMessage: string;
} {
  const code = String(error?.code || error?.name || '').toUpperCase();
  const statusCode = Number(error?.statusCode || error?.status || error?.responseCode || 0);
  const msg = String(error?.message || error || '');
  const response = String(error?.response || '');
  const combined = `${code} ${msg} ${response}`;

  if (code === 'CREDENTIALS_MISSING' || /missing_api_key|no configurada/i.test(combined)) {
    return {
      category: 'CREDENTIALS_MISSING',
      diagnosticMessage:
        'Falta configurar la variable de entorno RESEND_API_KEY en Vercel (Settings -> Environment Variables). Asegurate de cargarla en Production/Preview y hacer Redeploy.',
    };
  }

  if (
    statusCode === 403 &&
    /only send testing emails to your own email address|verify a domain|onboarding@resend\.dev/i.test(
      combined
    )
  ) {
    return {
      category: 'RESEND_SANDBOX_RESTRICTION',
      diagnosticMessage: `Bloqueo de Sandbox de Resend (HTTP 403): Con el remitente de prueba "onboarding@resend.dev", Resend solo permite enviar correos a la misma dirección de email con la que creaste tu cuenta en Resend.com. Detalle de Resend: "${msg}". Solución: Creá la API Key en una cuenta de Resend registrada con bruno.marin.soporte@gmail.com, o verificá un dominio propio en Resend.`,
    };
  }

  if (
    statusCode === 401 ||
    statusCode === 403 ||
    code === 'EAUTH' ||
    statusCode === 535 ||
    statusCode === 534 ||
    /api key is invalid|unauthorized|invalid_api_key|invalid login|username and password not accepted|authentication failed/i.test(
      combined
    )
  ) {
    return {
      category: 'AUTH_OR_INVALID_API_KEY',
      diagnosticMessage: `Error de credenciales / autenticación rechazada (HTTP ${statusCode || code}): La RESEND_API_KEY (o credencial SMTP) configurada en Vercel es inválida, expiró o fue revocada. Detalle: "${msg}".`,
    };
  }

  if (statusCode === 429 || /rate_limit|too many requests/i.test(combined)) {
    return {
      category: 'RATE_LIMIT_EXCEEDED',
      diagnosticMessage: `Límite de velocidad o cuota de Resend alcanzado (HTTP 429): "${msg}".`,
    };
  }

  if (
    code === 'ETIMEDOUT' ||
    code === 'ESOCKETTIMEDOUT' ||
    code === 'ECONNRESET' ||
    error?.name === 'AbortError' ||
    /timeout|timed out|socket hang up/i.test(combined)
  ) {
    return {
      category: 'TIMEOUT_ERROR',
      diagnosticMessage: `Error de Timeout (${code || 'TIMEOUT'}): El servidor de correo tardó demasiado en responder o la función Serverless de Vercel cortó la conexión.`,
    };
  }

  if (
    code === 'ECONNREFUSED' ||
    code === 'EACCES' ||
    code === 'EHOSTUNREACH' ||
    code === 'ENETUNREACH' ||
    /connection refused|port.*blocked|fetch failed/i.test(combined)
  ) {
    return {
      category: 'PORT_OR_NETWORK_BLOCKED',
      diagnosticMessage: `Error de red o bloqueo de puerto (${code || 'NETWORK_ERR'}): No se pudo establecer conexión saliente desde Vercel hacia el proveedor de correo. Detalle: "${msg}".`,
    };
  }

  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return {
      category: 'DNS_ERROR',
      diagnosticMessage: `Error de DNS (${code}): No se pudo resolver el host del servidor de correo.`,
    };
  }

  return {
    category: 'UNKNOWN_ERROR',
    diagnosticMessage: `Error inesperado al enviar el correo en Vercel (código ${statusCode || code || 'N/A'}): ${msg}`,
  };
}

/**
 * Servicio centralizado para el envío de correos electrónicos vía Resend.
 * Incluye protección contra rate-limiting, manejo seguro de errores (try/catch) y
 * logs detallados con console.error para la pestaña 'Logs' de Vercel.
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
      replyTo?: string;
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
            console.warn(
              `[Resend Rate-Limit]: Esperando ${(attempt + 1) * 800}ms antes de reintentar...`
            );
            await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 800));
            continue;
          }
        }
        return result;
      } catch (err: any) {
        if ((err?.statusCode === 429 || err?.status === 429) && attempt < maxRetries) {
          console.warn(
            `[Resend Rate-Limit Catch]: Reintentando en ${(attempt + 1) * 800}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 800));
          continue;
        }
        throw err;
      }
    }
    return { data: null, error: new Error('Excedido el número máximo de reintentos') };
  }

  /**
   * Envía el correo de confirmación de Nueva Reserva a bruno.marin.soporte@gmail.com
   * con manejo de errores try/catch y console.error exhaustivo para Vercel Logs.
   */
  static async sendBookingConfirmation(params: BookingConfirmationEmailParams): Promise<{
    sent: boolean;
    emailId?: string;
    errorCategory?: string;
    errorMessage?: string;
    errorDetails?: any;
  }> {
    const startTimestamp = Date.now();
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || 'onboarding@resend.dev';
    const toEmail = ADMIN_CONFIRMATION_EMAIL;

    const clientName = params.userFullName?.trim() || 'Cliente';
    const clientEmail = (params.userEmail || 'No proporcionado').trim();
    const clientPhone = (params.userPhone || 'No proporcionado').trim();
    const vehicleText =
      params.vehicleSummary?.trim() ||
      `${params.vehicleBrand || ''} ${params.vehicleModel || ''}`.trim() ||
      'Vehículo';

    const categoryMap: Record<string, string> = {
      CAR: 'Auto (Hatchback / Sedán)',
      SUV: 'SUV / Monovolumen',
      PICKUP: 'Camioneta / Utilitario',
    };
    const categoryLabel =
      (params.vehicleType && categoryMap[params.vehicleType]) ||
      params.vehicleType ||
      'Auto';

    const formattedAmount =
      typeof params.amount === 'number'
        ? params.amount.toLocaleString('es-AR')
        : params.amount || '0';

    const timeRange = params.endTime
      ? `${params.startTime} a ${params.endTime} hs`
      : params.startTime;

    const cleanCustomerDigits = sanitizeWhatsAppPhone(clientPhone);

    console.log('[EmailService][Confirmación] Preparando envío de correo de reserva...', {
      appointmentId: params.appointmentId || 'N/A',
      toEmail,
      fromEmail,
      clientName,
      clientEmail,
      appointmentDate: params.appointmentDate,
      timeRange,
      hasResendApiKey: Boolean(apiKey),
      resendApiKeyPrefix: apiKey ? `${apiKey.slice(0, 6)}...` : 'NO_DEFINIDA',
      vercelEnv: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
    });

    try {
      if (!apiKey) {
        const missingKeyErr: any = new Error(
          'RESEND_API_KEY no está configurada en las variables de entorno de Vercel.'
        );
        missingKeyErr.code = 'CREDENTIALS_MISSING';
        throw missingKeyErr;
      }

      const resend = new Resend(apiKey);

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
                  <td style="padding: 4px 0; font-size: 13px; color: #22d3ee; text-align: right; font-weight: 700;">${params.serviceDescription || 'Lavado Completo'}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #94a3b8;">Fecha solicitada:</td>
                  <td style="padding: 4px 0; font-size: 13px; color: #ffffff; text-align: right; font-weight: 700;">📅 ${params.appointmentDate}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #94a3b8;">Horario de atención:</td>
                  <td style="padding: 4px 0; font-size: 13px; color: #ffffff; text-align: right; font-weight: 700;">⏰ ${timeRange}</td>
                </tr>
                ${
                  params.homeDelivery && params.deliveryAddress
                    ? `
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #94a3b8;">Entrega a domicilio:</td>
                  <td style="padding: 4px 0; font-size: 13px; color: #ffffff; text-align: right;">🚚 ${params.deliveryAddress}</td>
                </tr>`
                    : ''
                }
                ${
                  params.notes
                    ? `
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #94a3b8;">Indicaciones especiales:</td>
                  <td style="padding: 4px 0; font-size: 13px; color: #facc15; text-align: right;">📝 ${params.notes}</td>
                </tr>`
                    : ''
                }
                <tr>
                  <td style="padding: 10px 0 4px; font-size: 14px; color: #ffffff; border-top: 1px solid #1e293b; font-weight: 800;">Monto Total:</td>
                  <td style="padding: 10px 0 4px; font-size: 18px; color: #22d3ee; text-align: right; border-top: 1px solid #1e293b; font-weight: 900;">$${formattedAmount} ARS</td>
                </tr>
              </table>

              <!-- Botón Contactar al Cliente por WhatsApp -->
              ${
                cleanCustomerDigits
                  ? `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 15px;">
                <tr>
                  <td align="center">
                    <a href="https://wa.me/${cleanCustomerDigits}?text=${encodeURIComponent(
                      `Hola ${clientName}, nos comunicamos desde AquaShine San Rafael para coordinar tu turno de ${vehicleText} el día ${params.appointmentDate}.`
                    )}" target="_blank" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; border-radius: 12px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);">
                      💬 Abrir WhatsApp con ${clientName}
                    </a>
                  </td>
                </tr>
              </table>`
                  : ''
              }
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

      const subject = `🚨 ¡Nueva Reserva Recibida! - ${clientName} (${vehicleText} • ${params.appointmentDate})`;

      const { data, error } = await this.sendWithRateLimitRetry(resend, {
        from: fromEmail,
        to: [toEmail],
        replyTo: clientEmail.includes('@') ? clientEmail : undefined,
        subject,
        html: htmlContent,
      });

      if (error) {
        const resendErr: any = new Error(
          (error as any).message || 'Error devuelto por la API de Resend al enviar confirmación.'
        );
        resendErr.name = (error as any).name || 'ResendApiError';
        resendErr.statusCode = (error as any).statusCode || (error as any).status || 500;
        resendErr.code = (error as any).name || 'RESEND_ERROR';
        resendErr.response = JSON.stringify(error);
        resendErr.rawError = error;

        // Si el error es por restricción de Sandbox de Resend (403) y el mensaje indica cuál es el correo dueño de la cuenta Resend,
        // intentamos reenviar automáticamente a ese correo dueño de Resend para que no se pierda la notificación
        const allowedEmailMatch = String((error as any).message || '').match(
          /\(([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\)/
        );
        if (
          resendErr.statusCode === 403 &&
          allowedEmailMatch &&
          allowedEmailMatch[1] &&
          allowedEmailMatch[1].toLowerCase() !== toEmail.toLowerCase()
        ) {
          const fallbackOwnerEmail = allowedEmailMatch[1];
          console.error(
            `[EmailService][AVISO SANDBOX RESEND]: Resend bloqueó el envío a "${toEmail}" porque la cuenta gratuita de Resend pertenece a "${fallbackOwnerEmail}". Intentando entregar en "${fallbackOwnerEmail}"...`
          );
          const fallbackAttempt = await this.sendWithRateLimitRetry(resend, {
            from: fromEmail,
            to: [fallbackOwnerEmail],
            replyTo: clientEmail.includes('@') ? clientEmail : undefined,
            subject: `[Para ${toEmail}] ${subject}`,
            html: htmlContent,
          });
          if (!fallbackAttempt.error && fallbackAttempt.data?.id) {
            console.error(
              `[EmailService][SANDBOX FALLBACK EXITOSO]: El correo fue entregado a "${fallbackOwnerEmail}" (ID: ${fallbackAttempt.data.id}). Para recibirlo directamente en "${toEmail}", debés crear la RESEND_API_KEY iniciando sesión en Resend.com con la cuenta "${toEmail}".`
            );
          }
        }

        throw resendErr;
      }

      console.log('[EmailService][ÉXITO]: Correo de confirmación enviado a:', {
        to: toEmail,
        emailId: data?.id,
        elapsedMs: Date.now() - startTimestamp,
      });

      return {
        sent: true,
        emailId: data?.id,
      };
    } catch (err: any) {
      const classification = classifyEmailError(err);
      const elapsedMs = Date.now() - startTimestamp;

      console.error('================================================================');
      console.error('[EmailService][ERROR CRÍTICO AL ENVIAR CORREO EN VERCEL]');
      console.error(`[EmailService] Categoría: ${classification.category}`);
      console.error(`[EmailService] Diagnóstico Exacto: ${classification.diagnosticMessage}`);
      console.error('[EmailService] Detalles Técnicos para Vercel Logs:', {
        destinatarioConfigurado: toEmail,
        remitenteConfigurado: fromEmail,
        clienteNombre: clientName,
        clienteEmail: clientEmail,
        fechaTurno: params.appointmentDate,
        horarioTurno: timeRange,
        errorName: err?.name || null,
        errorMessage: err?.message || String(err),
        errorCode: err?.code || null,
        httpStatusCode: err?.statusCode || null,
        providerResponse: err?.response || err?.rawError || null,
        elapsedMs,
        variablesDeEntornoEnVercel: {
          NODE_ENV: process.env.NODE_ENV,
          VERCEL_ENV: process.env.VERCEL_ENV || 'local',
          HAS_RESEND_API_KEY: Boolean(apiKey),
          RESEND_API_KEY_PREFIX: apiKey ? `${apiKey.slice(0, 6)}...` : 'NO_DEFINIDA',
          RESEND_FROM_EMAIL: fromEmail,
          ADMIN_EMAIL: toEmail,
        },
        stack: err?.stack,
      });
      console.error('================================================================');

      return {
        sent: false,
        errorCategory: classification.category,
        errorMessage: classification.diagnosticMessage,
        errorDetails: err?.rawError || {
          name: err?.name,
          message: err?.message,
          statusCode: err?.statusCode,
          code: err?.code,
        },
      };
    }
  }

  /**
   * Envía notificación inmediata por email al administrador (y al cliente)
   * cuando un turno es cancelado cumpliendo la regla de 24 horas.
   */
  static async sendCancellationNotification(params: CancellationEmailParams) {
    const startTimestamp = Date.now();
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || 'onboarding@resend.dev';
    const adminEmail = ADMIN_CONFIRMATION_EMAIL;

    if (!apiKey) {
      const missingErr: any = new Error(
        'RESEND_API_KEY no configurada en las variables de entorno de Vercel al intentar enviar aviso de cancelación.'
      );
      missingErr.code = 'CREDENTIALS_MISSING';
      const classification = classifyEmailError(missingErr);
      console.error('================================================================');
      console.error('[EmailService][Cancelación][ERROR CRÍTICO EN VERCEL]');
      console.error(`[EmailService] Categoría: ${classification.category}`);
      console.error(`[EmailService] Diagnóstico: ${classification.diagnosticMessage}`);
      console.error('================================================================');
      return {
        success: false,
        reason: 'missing_api_key',
        errorCategory: classification.category,
        errorMessage: classification.diagnosticMessage,
      };
    }

    const resend = new Resend(apiKey);

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
        const resendErr: any = new Error(
          adminResult.error.message || 'Error en Resend al enviar alerta de cancelación.'
        );
        resendErr.name = adminResult.error.name || 'ResendCancellationError';
        resendErr.statusCode =
          (adminResult.error as any).statusCode || (adminResult.error as any).status || 500;
        resendErr.response = JSON.stringify(adminResult.error);
        throw resendErr;
      }

      console.log(
        '[Resend Éxito Admin Cancelación]: Alerta enviada con éxito. ID:',
        adminResult.data?.id
      );
    } catch (err: any) {
      const classification = classifyEmailError(err);
      console.error('================================================================');
      console.error('[EmailService][Cancelación][ERROR CRÍTICO EN VERCEL]');
      console.error(`[EmailService] Categoría: ${classification.category}`);
      console.error(`[EmailService] Diagnóstico Exacto: ${classification.diagnosticMessage}`);
      console.error('[EmailService] Detalles Técnicos:', {
        bookingId: params.bookingId,
        adminEmail,
        fromEmail,
        errorName: err?.name,
        errorMessage: err?.message,
        httpStatusCode: err?.statusCode,
        providerResponse: err?.response,
        elapsedMs: Date.now() - startTimestamp,
        stack: err?.stack,
      });
      console.error('================================================================');
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
          console.error(
            '[Resend Aviso Cliente Cancelación]: No se pudo entregar copia al cliente (esperable si el dominio no está verificado en Resend):',
            clientResult.error
          );
        } else {
          console.log(
            '[Resend Éxito Cliente Cancelación]: Confirmación enviada al cliente. ID:',
            clientResult.data?.id
          );
        }
      } catch (clientErr: any) {
        console.error(
          '[Resend Aviso Cliente Excepción]: Omitiendo copia al cliente sin afectar al admin:',
          clientErr
        );
      }
    }

    return {
      success: Boolean(adminResult?.data?.id),
      adminSent: Boolean(adminResult?.data?.id),
      clientSent: Boolean(clientResult?.data?.id),
      adminEmailId: adminResult?.data?.id,
    };
  }

  /**
   * Envía notificación automática por correo al cliente cuando un administrador cancela su turno.
   * Informa que la cancelación se debió a un imprevisto operativo e incluye el botón de reprogramación.
   */
  static async sendCustomerCancellationEmail(params: CustomerCancellationEmailParams): Promise<{
    sent: boolean;
    id?: string;
    error?: string;
  }> {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      console.warn('[EmailService][Cancelación Admin -> Cliente]: RESEND_API_KEY no configurada en el entorno.');
      return { sent: false, error: 'RESEND_API_KEY no configurada' };
    }

    try {
      const resend = new Resend(apiKey);
      const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || 'Lavadero San Rafael <onboarding@resend.dev>';
      const clientName = params.clientName?.trim() || 'Estimado/a cliente';
      const vehicle = params.vehicle?.trim() || 'Vehículo';
      const date = params.date?.trim() || 'Fecha programada';
      const time = params.time?.trim() || 'Horario programado';
      const service = params.service?.trim() || 'Lavado Detailing';

      const htmlContent = `
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
                  <td style="padding: 10px 0 4px; font-size: 13px; color: #ffffff; text-align: right; font-weight: 700;">${vehicle}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #94a3b8;">📅 Fecha:</td>
                  <td style="padding: 4px 0; font-size: 13px; color: #ffffff; text-align: right; font-weight: 700;">${date}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #94a3b8;">⏰ Horario:</td>
                  <td style="padding: 4px 0; font-size: 13px; color: #ffffff; text-align: right; font-weight: 700;">${time}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0 6px; font-size: 13px; color: #94a3b8;">✨ Servicio:</td>
                  <td style="padding: 4px 0 6px; font-size: 13px; color: #22d3ee; text-align: right; font-weight: 700;">${service}</td>
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

      const result = await this.sendWithRateLimitRetry(resend, {
        from: fromEmail,
        to: [params.clientEmail],
        subject: 'Aviso importante sobre tu turno - Lavadero San Rafael',
        html: htmlContent,
      });

      if (result.error) {
        console.error('[EmailService][Cancelación Admin -> Cliente Resend Error]:', result.error);
        return { sent: false, error: (result.error as any).message || String(result.error) };
      }

      console.log('[EmailService][Cancelación Admin -> Cliente] Correo enviado exitosamente a:', params.clientEmail, 'ID:', result.data?.id);
      return { sent: true, id: result.data?.id };
    } catch (err: any) {
      console.error('[EmailService][Cancelación Admin -> Cliente Catch Error]:', err);
      return { sent: false, error: err?.message || String(err) };
    }
  }
}
