import { MercadoPagoConfig, Preference, PreApproval } from 'mercadopago';

function getMpClient(): MercadoPagoConfig | null {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();
  if (!token || token === 'PROD-ACCESS-TOKEN-O-TEST' || token === 'TEST-ACCESS-TOKEN-KEY') {
    return null;
  }
  return new MercadoPagoConfig({
    accessToken: token,
    options: { timeout: 8000 },
  });
}

export class MercadoPagoService {
  /**
   * Crea una preferencia de pago en Checkout Pro para un turno individual
   */
  static async createAppointmentPreference(params: {
    appointmentId: string;
    userEmail: string;
    title: string;
    amount: number;
    backUrlBase: string;
  }): Promise<{ id: string; initPoint: string }> {
    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();
    const client = getMpClient();

    if (!client) {
      console.warn(
        '[MercadoPagoService] MERCADO_PAGO_ACCESS_TOKEN no configurado o de prueba. Generando initPoint de Checkout Oficial MP de prueba.'
      );
      return {
        id: `pref_${params.appointmentId}_${Date.now()}`,
        initPoint: `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=demo_${params.appointmentId}`,
      };
    }

    try {
      const preference = new Preference(client);
      const isHttps = params.backUrlBase.startsWith('https://');

      const bodyData: any = {
        items: [
          {
            id: params.appointmentId,
            title: params.title.substring(0, 120),
            quantity: 1,
            unit_price: Math.max(1, Math.round(Number(params.amount))),
            currency_id: 'ARS',
          },
        ],
        payer: {
          email: params.userEmail,
        },
        back_urls: {
          success: `${params.backUrlBase}/?status=approved&id=${params.appointmentId}`,
          failure: `${params.backUrlBase}/?status=failure&id=${params.appointmentId}`,
          pending: `${params.backUrlBase}/?status=pending&id=${params.appointmentId}`,
        },
        auto_return: 'approved',
        external_reference: params.appointmentId,
        statement_descriptor: 'AQUASHINE RAFAEL', // Max 16 caracteres
      };

      // Mercado Pago rechaza notification_url si es http://localhost
      if (isHttps) {
        bodyData.notification_url = `${params.backUrlBase}/api/payments/webhook`;
      }

      const response = await preference.create({ body: bodyData });

      const isTestToken = Boolean(token && token.startsWith('TEST-'));
      const checkoutUrl = isTestToken
        ? (response.sandbox_init_point || response.init_point)
        : (response.init_point || response.sandbox_init_point);

      if (!checkoutUrl) {
        throw new Error('Mercado Pago no retornó un punto de inicio (init_point) válido.');
      }

      return {
        id: response.id || `pref_${params.appointmentId}`,
        initPoint: checkoutUrl,
      };
    } catch (error: any) {
      console.error('[MercadoPagoService] Error en llamada a Mercado Pago API:', error);
      return {
        id: `pref_fallback_${params.appointmentId}_${Date.now()}`,
        initPoint: `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=fallback_${params.appointmentId}`,
      };
    }
  }

  /**
   * Crea la suscripción mensual recurrente vía débito automático (PreApproval)
   */
  static async createSubscriptionPreapproval(params: {
    planName: string;
    monthlyPrice: number;
    userEmail: string;
    backUrl: string;
  }): Promise<{ preapprovalId: string; initPoint: string }> {
    const client = getMpClient();
    if (!client) {
      console.warn('[MercadoPagoService] Token no configurado para PreApproval. Fallback demo.');
      return {
        preapprovalId: `sub_demo_${Date.now()}`,
        initPoint: `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=demo_${Date.now()}`,
      };
    }

    try {
      const preapproval = new PreApproval(client);

      const result = await preapproval.create({
        body: {
          reason: `Suscripción Mensual - ${params.planName} (Lavadero San Rafael)`,
          auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: Math.round(Number(params.monthlyPrice)),
            currency_id: 'ARS',
          },
          payer_email: params.userEmail,
          back_url: params.backUrl,
          status: 'pending',
        },
      });

      return {
        preapprovalId: result.id || `sub_${Date.now()}`,
        initPoint: result.init_point || `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=${result.id}`,
      };
    } catch (error) {
      console.warn('[MercadoPagoService] Error generando PreApproval, fallback de desarrollo:', error);
      return {
        preapprovalId: `sub_fallback_${Date.now()}`,
        initPoint: `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=fallback_${Date.now()}`,
      };
    }
  }
}

