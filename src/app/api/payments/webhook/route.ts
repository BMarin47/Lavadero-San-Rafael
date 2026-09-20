import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MercadoPagoConfig, Payment } from 'mercadopago';

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || '',
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = body;

    // Notificación de tipo 'payment'
    if (type === 'payment' && data?.id) {
      const paymentId = String(data.id);
      const mpPayment = new Payment(mpClient);
      const paymentInfo = await mpPayment.get({ id: paymentId });

      const appointmentId = paymentInfo.external_reference;
      const status = paymentInfo.status; // 'approved', 'rejected', 'in_process'

      if (status === 'approved' && appointmentId) {
        await prisma.$transaction([
          prisma.appointment.update({
            where: { id: appointmentId },
            data: { status: 'CONFIRMED' },
          }),
          prisma.payment.upsert({
            where: { mpPaymentId: paymentId },
            update: {
              status: 'APPROVED',
              paidAt: new Date(),
            },
            create: {
              appointmentId,
              userId: paymentInfo.metadata?.user_id || 'unknown',
              paymentMethod: 'MERCADO_PAGO',
              status: 'APPROVED',
              amount: paymentInfo.transaction_amount || 0,
              mpPaymentId: paymentId,
              paidAt: new Date(),
            },
          }),
        ]);
        console.log(`[Mercado Pago Webhook] Turno ${appointmentId} confirmado exitosamente.`);
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('[Mercado Pago Webhook Error]:', error);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
