import { MercadoPagoConfig, Preference, PreApproval } from 'mercadopago';

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || 'TEST-ACCESS-TOKEN-KEY',
  options: { timeout: 5000 },
});

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
    try {
      const preference = new Preference(mpClient);

      const response = await preference.create({
        body: {
          items: [
            {
              id: params.appointmentId,
              title: params.title,
              quantity: 1,
              unit_price: params.amount,
              currency_id: 'ARS',
            },
          ],
          payer: { email: params.userEmail },
          back_urls: {
            success: `${params.backUrlBase}/?status=approved&id=${params.appointmentId}`,
            failure: `${params.backUrlBase}/?status=failure&id=${params.appointmentId}`,
            pending: `${params.backUrlBase}/?status=pending&id=${params.appointmentId}`,
          },
          auto_return: 'approved',
          external_reference: params.appointmentId,
          notification_url: `${params.backUrlBase}/api/payments/webhook`,
          statement_descriptor: 'LAVADERO S RAFAEL',
        },
      });

      return {
        id: response.id || 'mock_pref_id',
        initPoint: response.init_point || response.sandbox_init_point || 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=mock',
      };
    } catch (error) {
      console.warn('[MercadoPagoService] Error conectando con API MP, generando fallback de desarrollo:', error);
      return {
        id: `mock_pref_${Date.now()}`,
        initPoint: `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=mock_${params.appointmentId}`,
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
    try {
      const preapproval = new PreApproval(mpClient);

      const result = await preapproval.create({
        body: {
          reason: `Suscripción Mensual - ${params.planName} (Lavadero San Rafael)`,
          auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: params.monthlyPrice,
            currency_id: 'ARS',
          },
          payer_email: params.userEmail,
          back_url: params.backUrl,
          status: 'pending',
        },
      });

      return {
        preapprovalId: result.id || 'mock_preapproval_id',
        initPoint: result.init_point || 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=mock',
      };
    } catch (error) {
      console.warn('[MercadoPagoService] Error generando PreApproval, fallback de desarrollo:', error);
      return {
        preapprovalId: `mock_sub_${Date.now()}`,
        initPoint: `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=mock_${Date.now()}`,
      };
    }
  }
}
