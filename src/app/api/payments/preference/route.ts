import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoService } from '@/lib/services/mercadopago.service';

export async function POST(request: NextRequest) {
  try {
    const { appointmentId, userEmail, title, amount } = await request.json();

    if (!appointmentId || !userEmail || !amount) {
      return NextResponse.json(
        { error: 'Parámetros incompletos. Se requiere appointmentId, userEmail y amount.' },
        { status: 400 }
      );
    }

    const appBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      `${request.nextUrl.protocol}//${request.nextUrl.host}`;

    const preference = await MercadoPagoService.createAppointmentPreference({
      appointmentId,
      userEmail,
      title: title || 'Lavadero San Rafael - Turno de Lavado',
      amount: Number(amount),
      backUrlBase: appBaseUrl,
    });

    return NextResponse.json({
      success: true,
      preferenceId: preference.id,
      initPoint: preference.initPoint,
    });
  } catch (error: any) {
    console.error('[API Preference Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al generar preferencia de Mercado Pago.' },
      { status: 500 }
    );
  }
}
