import { NextRequest, NextResponse } from 'next/server';
import { BookingService, CreateBookingDTO } from '@/lib/services/booking.service';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateBookingDTO;

    // Validaciones requeridas (sin patente)
    if (!body.userEmail || !body.vehicleModel || !body.appointmentDate || !body.startTime || !body.endTime) {
      return NextResponse.json(
        { error: 'Datos incompletos para realizar la reserva. Por favor completá el modelo de vehículo y horario.' },
        { status: 400 }
      );
    }

    const appBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      `${request.nextUrl.protocol}//${request.nextUrl.host}`;

    const result = await BookingService.createBooking(body, appBaseUrl);

    return NextResponse.json(
      {
        success: true,
        message:
          body.paymentMethod === 'CASH'
            ? '¡Turno confirmado con éxito! Abonarás en efectivo en el taller al entregar tu vehículo.'
            : result.mpCheckoutUrl
            ? 'Turno reservado temporalmente. Procede al pago con Mercado Pago para asegurar tu lugar.'
            : '¡Turno confirmado exitosamente!',
        data: result,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[API Bookings Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Error procesando la reserva.' },
      { status: 400 }
    );
  }
}
