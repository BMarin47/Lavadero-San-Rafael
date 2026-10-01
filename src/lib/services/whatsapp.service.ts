import { sanitizeWhatsAppPhone } from './booking.service';

export interface WhatsAppReminderParams {
  phone: string;
  clientName: string;
  time: string;
  vehicle: string;
  date?: string;
  bookingId?: string;
}

export interface WhatsAppSendResult {
  success: boolean;
  simulated?: boolean;
  provider: 'meta' | 'ultramsg' | 'twilio' | 'custom' | 'simulation';
  phone: string;
  messageId?: string;
  message?: string;
  waUrl?: string;
  error?: string;
  rawResponse?: any;
}

// Emojis en secuencias de escape Unicode UTF-16 (surrogate pairs / ASCII puro, inmunes a codificación de archivo)
export const EMOJI_WAVE = '\uD83D\uDC4B';      // Mano saludando
export const EMOJI_CAR = '\uD83D\uDE97';       // Automovil
export const EMOJI_SPARKLES = '\u2728';        // Brillos
export const EMOJI_PIN = '\uD83D\uDCCD';       // Pin de ubicacion
export const EMOJI_SPEECH = '\uD83D\uDCAC';    // Globo de dialogo
export const EMOJI_CALENDAR = '\uD83D\uDCC5';  // Calendario
export const EMOJI_CLOCK = '\u23F0';           // Reloj
export const EMOJI_MONEY = '\uD83D\uDCB0';     // Bolsa de dinero
export const EMOJI_SOAP = '\uD83E\uDDFC';      // Jabon
export const EMOJI_USER = '\uD83D\uDC64';      // Cliente
export const EMOJI_TRUCK = '\uD83D\uDE9A';     // Camion
export const EMOJI_MEMO = '\uD83D\uDCDD';      // Notas

/**
 * Genera el texto del recordatorio de 24 horas amigable y claro,
 * según el formato establecido para Lavadero San Rafael.
 * Garantiza secuencias de escape Unicode puras para evitar emojis corruptos.
 */
export function build24hReminderMessage(params: {
  clientName: string;
  time: string;
  vehicle: string;
  date?: string;
}): string {
  const name = (params.clientName || 'Cliente').trim();
  const time = (params.time || 'tu horario programado').trim();
  const vehicle = (params.vehicle || 'vehículo').trim();

  const lines = [
    `¡Hola ${name}! ${EMOJI_WAVE} Te recordamos que mañana a las ${time} hs tenés un turno en Lavadero San Rafael para tu ${vehicle}. ¡Te esperamos! ${EMOJI_CAR}${EMOJI_SPARKLES}`,
    '',
    `${EMOJI_PIN} San Rafael, Mendoza`,
    `${EMOJI_SPEECH} Si necesitás reprogramar o tenés alguna duda, podés responder directamente a este mensaje.`,
  ];

  return lines.join('\n');
}

export class WhatsAppService {
  /**
   * Detecta el proveedor configurado en variables de entorno.
   */
  public static getProvider(): 'meta' | 'ultramsg' | 'twilio' | 'custom' | 'simulation' {
    const explicit = (process.env.WHATSAPP_PROVIDER || '').trim().toLowerCase();
    if (explicit === 'meta' || explicit === 'facebook' || explicit === 'cloud') return 'meta';
    if (explicit === 'ultramsg') return 'ultramsg';
    if (explicit === 'twilio') return 'twilio';
    if (explicit === 'custom') return 'custom';

    // Detección automática por presencia de variables de entorno
    if (process.env.WHATSAPP_PHONE_ID && (process.env.WHATSAPP_API_KEY || process.env.WHATSAPP_TOKEN)) {
      return 'meta';
    }
    if (process.env.WHATSAPP_INSTANCE_ID && (process.env.WHATSAPP_API_KEY || process.env.ULTRAMSG_TOKEN)) {
      return 'ultramsg';
    }
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      return 'twilio';
    }
    if (process.env.WHATSAPP_API_URL) {
      return 'custom';
    }

    return 'simulation';
  }

  /**
   * Envía el recordatorio de 24 horas a un cliente.
   */
  public static async sendReminderMessage(params: WhatsAppReminderParams): Promise<WhatsAppSendResult> {
    const cleanPhone = sanitizeWhatsAppPhone(params.phone);
    if (!cleanPhone) {
      return {
        success: false,
        provider: this.getProvider(),
        phone: params.phone,
        error: `El teléfono proporcionado "${params.phone}" no es válido.`,
      };
    }

    const messageText = build24hReminderMessage({
      clientName: params.clientName,
      time: params.time,
      vehicle: params.vehicle,
      date: params.date,
    });

    return this.sendMessage(cleanPhone, messageText, {
      bookingId: params.bookingId,
      clientName: params.clientName,
    });
  }

  /**
   * Envía un mensaje de texto por WhatsApp usando el proveedor configurado,
   * o ejecuta en modo simulación seguro si aún no se han configurado credenciales.
   */
  public static async sendMessage(
    recipientPhone: string,
    messageText: string,
    metadata?: { bookingId?: string; clientName?: string }
  ): Promise<WhatsAppSendResult> {
    const cleanPhone = sanitizeWhatsAppPhone(recipientPhone);
    const provider = this.getProvider();
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;

    // Normalizar texto en Unicode NFC para preservar integridad de caracteres multibyte
    const normalizedBodyText = (messageText || '').normalize('NFC');

    // ==============================================================
    // 1. MODO SIMULACIÓN (Fallback seguro sin fallar si no hay claves)
    // ==============================================================
    if (provider === 'simulation') {
      console.log('----------------------------------------------------');
      console.log('[WhatsApp 24h - MODO SIMULACIÓN / DRY-RUN]');
      console.log(`Destinatario: +${cleanPhone} (${metadata?.clientName || 'Cliente'})`);
      console.log(`Mensaje:\n${normalizedBodyText}`);
      console.log(`Enlace directo wa.me: ${waUrl}`);
      console.log('Aviso: Para envíos reales, configurá WHATSAPP_API_KEY y WHATSAPP_PHONE_ID o WHATSAPP_INSTANCE_ID en Vercel.');
      console.log('----------------------------------------------------');

      return {
        success: true,
        simulated: true,
        provider: 'simulation',
        phone: cleanPhone,
        messageId: `sim_${Date.now()}_${cleanPhone}`,
        message: normalizedBodyText,
        waUrl,
      };
    }

    // ==============================================================
    // 2. PROVEEDOR: META WHATSAPP CLOUD API (Oficial de Meta)
    // ==============================================================
    if (provider === 'meta') {
      const phoneId = process.env.WHATSAPP_PHONE_ID;
      const apiKey = process.env.WHATSAPP_API_KEY || process.env.WHATSAPP_TOKEN;

      if (!phoneId || !apiKey) {
        return {
          success: false,
          provider: 'meta',
          phone: cleanPhone,
          error: 'Faltan WHATSAPP_PHONE_ID o WHATSAPP_API_KEY en variables de entorno.',
        };
      }

      const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;

      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: {
          preview_url: false,
          body: normalizedBodyText,
        },
      };

      // Serialización y codificación binaria estricta con escape Unicode seguro (\uXXXX)
      // Garantiza que cualquier emoji o carácter multibyte viaje como ASCII puro en el JSON,
      // evitando cualquier desajuste de charset en el servidor o red.
      const jsonPayload = JSON.stringify(payload).replace(
        /[\u007F-\uFFFF]/g,
        (c) => '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4)
      );
      const utf8BodyBuffer = Buffer.from(jsonPayload, 'utf-8');

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json; charset=utf-8',
            'Accept': 'application/json',
            'Content-Length': String(utf8BodyBuffer.byteLength),
          },
          body: utf8BodyBuffer,
        });

        const resJson = await response.json().catch(() => ({}));

        if (!response.ok) {
          const errMsg = resJson?.error?.message || `HTTP ${response.status}: Error al despachar con Meta Cloud API`;
          console.error('[WhatsApp Meta Cloud API Error]:', resJson);
          return {
            success: false,
            provider: 'meta',
            phone: cleanPhone,
            error: errMsg,
            rawResponse: resJson,
          };
        }

        const messageId = resJson?.messages?.[0]?.id || `meta_${Date.now()}`;
        console.log(`[WhatsApp Meta Cloud API Exitoso]: ID ${messageId} enviado a +${cleanPhone}`);

        return {
          success: true,
          provider: 'meta',
          phone: cleanPhone,
          messageId,
          message: normalizedBodyText,
          rawResponse: resJson,
        };
      } catch (err: any) {
        console.error('[WhatsApp Meta Cloud API Excepción]:', err);
        return {
          success: false,
          provider: 'meta',
          phone: cleanPhone,
          error: err.message || 'Excepción al conectar con Meta Cloud API',
        };
      }
    }

    // ==============================================================
    // 3. PROVEEDOR: ULTRAMSG (Conexión QR fácil para PYMES)
    // ==============================================================
    if (provider === 'ultramsg') {
      const instanceId = process.env.WHATSAPP_INSTANCE_ID || process.env.ULTRAMSG_INSTANCE_ID;
      const token = process.env.WHATSAPP_API_KEY || process.env.ULTRAMSG_TOKEN;

      if (!instanceId || !token) {
        return {
          success: false,
          provider: 'ultramsg',
          phone: cleanPhone,
          error: 'Faltan WHATSAPP_INSTANCE_ID o WHATSAPP_API_KEY (UltraMsg) en variables de entorno.',
        };
      }

      const url = `https://api.ultramsg.com/${instanceId}/messages/chat`;

      const payload = {
        token,
        to: cleanPhone,
        body: normalizedBodyText,
      };

      const jsonPayload = JSON.stringify(payload).replace(
        /[\u007F-\uFFFF]/g,
        (c) => '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4)
      );
      const utf8BodyBuffer = Buffer.from(jsonPayload, 'utf-8');

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Accept': 'application/json',
            'Content-Length': String(utf8BodyBuffer.byteLength),
          },
          body: utf8BodyBuffer,
        });

        const resJson = await response.json().catch(() => ({}));

        if (!response.ok || resJson.error) {
          const errMsg = resJson.error || `HTTP ${response.status}: Error al enviar por UltraMsg`;
          console.error('[WhatsApp UltraMsg Error]:', resJson);
          return {
            success: false,
            provider: 'ultramsg',
            phone: cleanPhone,
            error: errMsg,
            rawResponse: resJson,
          };
        }

        const messageId = String(resJson.id || `ultra_${Date.now()}`);
        console.log(`[WhatsApp UltraMsg Exitoso]: ID ${messageId} enviado a +${cleanPhone}`);

        return {
          success: true,
          provider: 'ultramsg',
          phone: cleanPhone,
          messageId,
          message: normalizedBodyText,
          rawResponse: resJson,
        };
      } catch (err: any) {
        console.error('[WhatsApp UltraMsg Excepción]:', err);
        return {
          success: false,
          provider: 'ultramsg',
          phone: cleanPhone,
          error: err.message || 'Excepción al conectar con UltraMsg',
        };
      }
    }

    // ==============================================================
    // 4. PROVEEDOR: TWILIO
    // ==============================================================
    if (provider === 'twilio') {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromPhone = process.env.TWILIO_WHATSAPP_FROM || '+14155238886';

      if (!sid || !authToken) {
        return {
          success: false,
          provider: 'twilio',
          phone: cleanPhone,
          error: 'Faltan TWILIO_ACCOUNT_SID o TWILIO_AUTH_TOKEN en variables de entorno.',
        };
      }

      const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
      const authHeader = 'Basic ' + Buffer.from(`${sid}:${authToken}`).toString('base64');

      const params = new URLSearchParams();
      params.append('From', fromPhone.startsWith('whatsapp:') ? fromPhone : `whatsapp:${fromPhone}`);
      params.append('To', `whatsapp:+${cleanPhone}`);
      params.append('Body', normalizedBodyText);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
          },
          body: params.toString(),
        });

        const resJson = await response.json().catch(() => ({}));

        if (!response.ok) {
          const errMsg = resJson.message || `HTTP ${response.status}: Error al enviar por Twilio`;
          return {
            success: false,
            provider: 'twilio',
            phone: cleanPhone,
            error: errMsg,
            rawResponse: resJson,
          };
        }

        return {
          success: true,
          provider: 'twilio',
          phone: cleanPhone,
          messageId: resJson.sid,
          message: normalizedBodyText,
          rawResponse: resJson,
        };
      } catch (err: any) {
        return {
          success: false,
          provider: 'twilio',
          phone: cleanPhone,
          error: err.message || 'Excepción al conectar con Twilio',
        };
      }
    }

    // ==============================================================
    // 5. PROVEEDOR: GATEWAY PERSONALIZADO / EVOLUTION API / WEBHOOK
    // ==============================================================
    if (provider === 'custom') {
      const apiUrl = process.env.WHATSAPP_API_URL!;
      const apiKey = process.env.WHATSAPP_API_KEY;

      const payload = {
        number: cleanPhone,
        phone: cleanPhone,
        message: normalizedBodyText,
        text: normalizedBodyText,
        metadata,
      };

      const jsonPayload = JSON.stringify(payload).replace(
        /[\u007F-\uFFFF]/g,
        (c) => '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4)
      );
      const utf8BodyBuffer = Buffer.from(jsonPayload, 'utf-8');

      const headers: Record<string, string> = {
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/json',
        'Content-Length': String(utf8BodyBuffer.byteLength),
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['apikey'] = apiKey;
      }

      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: utf8BodyBuffer,
        });

        const resJson = await response.json().catch(() => ({}));

        if (!response.ok) {
          return {
            success: false,
            provider: 'custom',
            phone: cleanPhone,
            error: resJson.message || `HTTP ${response.status}: Fallo en gateway personalizado`,
            rawResponse: resJson,
          };
        }

        return {
          success: true,
          provider: 'custom',
          phone: cleanPhone,
          messageId: resJson.id || `custom_${Date.now()}`,
          message: normalizedBodyText,
          rawResponse: resJson,
        };
      } catch (err: any) {
        return {
          success: false,
          provider: 'custom',
          phone: cleanPhone,
          error: err.message || 'Excepción en gateway personalizado',
        };
      }
    }

    return {
      success: false,
      provider: 'simulation',
      phone: cleanPhone,
      error: 'Proveedor de WhatsApp desconocido.',
    };
  }
}
