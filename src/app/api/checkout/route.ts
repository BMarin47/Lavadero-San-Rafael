import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { BASE_PRICES } from '@/lib/services/booking.service';

const PLANS_PRICES: Record<string, Record<string, number>> = {
  PLATA: { CAR: 38000, SUV: 45500, PICKUP: 55000 },
  ORO: { CAR: 56000, SUV: 67500, PICKUP: 81500 },
  PLATINO: { CAR: 75000, SUV: 90000, PICKUP: 109000 },
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      categoria,
      planCode,
      turnoId,
      vehiculo,
      nombre_cliente,
      userEmail,
    } = body;

    if (!categoria) {
      return NextResponse.json(
        { error: 'Faltan parámetros obligatorios: categoria es requerida.' },
        { status: 400 }
      );
    }

    // Cálculo y blindaje de precio en el SERVIDOR (Protección contra manipulación)
    const catUpper = String(categoria).toUpperCase();
    let verifiedPrice: number;

    if (planCode && PLANS_PRICES[String(planCode).toUpperCase()]) {
      const planPrices = PLANS_PRICES[String(planCode).toUpperCase()];
      verifiedPrice = planPrices[catUpper] || planPrices['CAR'] || 38000;
    } else if (BASE_PRICES[catUpper]) {
      verifiedPrice = BASE_PRICES[catUpper];
    } else {
      verifiedPrice = BASE_PRICES.CAR || 22000;
    }

    const token =
      process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() ||
      process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();

    if (!token) {
      console.error('[API Checkout]: MERCADOPAGO_ACCESS_TOKEN no está configurada.');
      return NextResponse.json(
        {
          error:
            'MERCADOPAGO_ACCESS_TOKEN no está configurada en las variables de entorno de Vercel.',
        },
        { status: 500 }
      );
    }

    const client = new MercadoPagoConfig({
      accessToken: token,
      options: { timeout: 10000 },
    });

    const preference = new Preference(client);

    // Determinar la URL base para las redirecciones
    const host =
      request.headers.get('x-forwarded-host') ||
      request.headers.get('host') ||
      'lavadero-san-rafael.vercel.app';
    const protocol =
      request.headers.get('x-forwarded-proto') ||
      (host.includes('localhost') ? 'http' : 'https');
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

    const categoryMap: Record<string, string> = {
      CAR: 'Auto (Hatchback / Sedán)',
      SUV: 'SUV / Monovolumen',
      PICKUP: 'Camioneta / Utilitario',
    };
    const categoryTitle = categoryMap[categoria] || categoria || 'Vehículo';
    const itemTitle = vehiculo
      ? `Reserva Lavadero - ${vehiculo} (${categoryTitle})`
      : `Reserva Lavadero - ${categoryTitle}`;

    const preferenceBody: any = {
      items: [
        {
          id: turnoId ? String(turnoId) : `turno-${Date.now()}`,
          title: itemTitle.substring(0, 120),
          unit_price: verifiedPrice,
          quantity: 1,
          currency_id: 'ARS',
        },
      ],
      back_urls: {
        success: `${baseUrl}/reserva-exitosa`,
        failure: `${baseUrl}/?status=failure`,
        pending: `${baseUrl}/reserva-exitosa?status=pending`,
      },
      auto_return: 'approved',
      external_reference: turnoId ? String(turnoId) : undefined,
      metadata: {
        turno_id: turnoId,
        categoria,
        precio: verifiedPrice,
        vehiculo,
        nombre_cliente,
        email: userEmail,
      },
    };

    if (userEmail && userEmail.includes('@')) {
      preferenceBody.payer = {
        email: userEmail.trim(),
        name: nombre_cliente ? String(nombre_cliente).trim() : undefined,
      };
    }

    const response = await preference.create({ body: preferenceBody });

    const isTestToken = token.startsWith('TEST-');
    const initPoint = isTestToken
      ? response.sandbox_init_point || response.init_point
      : response.init_point || response.sandbox_init_point;

    if (!initPoint) {
      throw new Error('Mercado Pago no devolvió una URL init_point válida.');
    }

    console.log('[API Checkout]: Preferencia creada exitosamente con ID:', response.id);

    return NextResponse.json({
      success: true,
      id: response.id,
      init_point: initPoint,
      sandbox_init_point: response.sandbox_init_point,
    });
  } catch (error: any) {
    console.error('[API Checkout Error]:', error);
    return NextResponse.json(
      {
        error: error.message || 'Error al generar la preferencia de Mercado Pago.',
        details: error,
      },
      { status: 500 }
    );
  }
}
