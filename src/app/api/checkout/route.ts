import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      categoria,
      precio,
      turnoId,
      vehiculo,
      nombre_cliente,
      userEmail,
    } = body;

    if (!categoria || precio === undefined) {
      return NextResponse.json(
        { error: 'Faltan parámetros obligatorios: categoria y precio son requeridos.' },
        { status: 400 }
      );
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
          unit_price: Math.max(1, Math.round(Number(precio))),
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
        precio,
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
