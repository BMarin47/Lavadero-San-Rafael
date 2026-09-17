import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { appointmentId, operatorEmail } = await request.json();

    if (!appointmentId) {
      return NextResponse.json({ error: 'appointmentId es requerido.' }, { status: 400 });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      return NextResponse.json({ error: 'Turno no encontrado.' }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.appointment.update({
        where: { id: appointmentId },
        data: { status: 'CONFIRMED' },
      }),
      prisma.payment.updateMany({
        where: { appointmentId, paymentMethod: 'CASH' },
        data: {
          status: 'PAID_ON_SITE',
          paidAt: new Date(),
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Cobro presencial en efectivo registrado exitosamente en caja.',
    });
  } catch (error: any) {
    console.error('[Cash Payment Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Error registrando cobro en efectivo.' },
      { status: 500 }
    );
  }
}
