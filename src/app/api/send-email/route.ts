import { NextResponse } from 'next/server';
import { EmailService, classifyEmailError } from '@/lib/services/email.service';
import {
  sanitizePlainText,
  sanitizeEmailInput,
  formatWhatsAppArgPhone,
} from '@/lib/validations/booking.schema';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. Manejo especializado para avisos de Cancelación de Turnos
    if (
      body.type === 'cancellation' ||
      body.action === 'cancellation' ||
      body.isCancellation === true ||
      body.status === 'cancelado'
    ) {
      if (!body.bookingId && !body.clientEmail && !body.userEmail) {
        console.error(
          '[API /api/send-email][Validation Error]: Parámetros insuficientes para notificación de cancelación:',
          body
        );
        return NextResponse.json(
          { error: 'Parámetros insuficientes para la notificación de cancelación.' },
          { status: 400 }
        );
      }

      const cancellationResult = await EmailService.sendCancellationNotification({
        bookingId: sanitizePlainText(body.bookingId || body.id || '', 64),
        clientName:
          sanitizePlainText(
            body.clientName || body.userFullName || body.nombre_cliente || 'Cliente',
            80
          ) || 'Cliente',
        clientEmail: sanitizeEmailInput(body.clientEmail || body.userEmail || body.email),
        clientPhone: formatWhatsAppArgPhone(body.clientPhone || body.userPhone || body.phone || ''),
        vehicle:
          sanitizePlainText(
            body.vehicle ||
              body.vehiculo ||
              `${body.vehicleBrand || ''} ${body.vehicleModel || ''}`.trim() ||
              'Vehículo',
            80
          ) || 'Vehículo',
        category: sanitizePlainText(body.category || body.categoria || body.vehicleType, 60),
        service:
          sanitizePlainText(
            body.service || body.serviceDescription || body.servicio || 'Lavado Completo',
            120
          ) || 'Lavado Completo',
        date: sanitizePlainText(body.date || body.appointmentDate || 'Fecha programada', 30),
        time: sanitizePlainText(
          body.time ||
            (body.startTime ? `${body.startTime} a ${body.endTime} hs` : 'Horario programado'),
          40
        ),
        price: body.price || body.precio || body.amount,
        notes: sanitizePlainText(body.notes || body.indicaciones || '', 300),
      });

      if (!cancellationResult.success) {
        console.error(
          '[API /api/send-email][Cancellation Email Failed]: Falló el envío del correo de cancelación en Vercel:',
          cancellationResult
        );
      }

      return NextResponse.json({
        message: 'Notificación de cancelación procesada.',
        ...cancellationResult,
      });
    }

    // 2. Envío de Correo de Confirmación de Nueva Reserva
    const {
      userEmail,
      userFullName,
      userPhone,
      vehicleType,
      vehicleBrand,
      vehicleModel,
      vehicleSummary,
      appointmentDate,
      startTime,
      endTime,
      serviceDescription,
      amount,
      homeDelivery,
      deliveryAddress,
      notes,
    } = body;

    const effectiveUserEmail =
      sanitizeEmailInput(userEmail || body.client_email || body.email) || 'cliente@lavadero.com';
    const effectiveAppointmentDate = sanitizePlainText(
      appointmentDate || body.date || new Date().toISOString().split('T')[0],
      20
    );
    const effectiveStartTime = sanitizePlainText(startTime || body.time || '09:00', 20);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(effectiveUserEmail)) {
      console.error(
        `[API /api/send-email][Validation Error]: Formato de correo inválido recibido: "${effectiveUserEmail}"`
      );
      return NextResponse.json(
        { error: 'El formato del correo electrónico es inválido.' },
        { status: 400 }
      );
    }

    const result = await EmailService.sendBookingConfirmation({
      appointmentId: sanitizePlainText(body.appointmentId || body.turnoId || body.id || '', 64),
      userFullName:
        sanitizePlainText(
          userFullName || body.client_name || body.nombre_cliente || 'Cliente',
          80
        ) || 'Cliente',
      userEmail: effectiveUserEmail,
      userPhone:
        formatWhatsAppArgPhone(userPhone || body.client_phone || body.phone || '') ||
        'No proporcionado',
      vehicleType: sanitizePlainText(vehicleType || body.categoria || 'CAR', 40),
      vehicleBrand: sanitizePlainText(vehicleBrand || '', 60),
      vehicleModel: sanitizePlainText(vehicleModel || '', 60),
      vehicleSummary:
        sanitizePlainText(
          vehicleSummary ||
            body.vehiculo ||
            body.vehicle_details ||
            `${vehicleBrand || ''} ${vehicleModel || ''}`.trim() ||
            'Vehículo',
          80
        ) || 'Vehículo',
      appointmentDate: effectiveAppointmentDate,
      startTime: effectiveStartTime,
      endTime: sanitizePlainText(endTime || '', 20),
      serviceDescription:
        sanitizePlainText(serviceDescription || body.service_type || 'Lavado Completo', 120) ||
        'Lavado Completo',
      paymentMethod: sanitizePlainText(body.paymentMethod || body.metodo_pago || '', 40),
      amount: amount ?? body.precio ?? body.price ?? 0,
      homeDelivery: Boolean(homeDelivery),
      deliveryAddress: sanitizePlainText(deliveryAddress || '', 150),
      notes: sanitizePlainText(notes || body.indicaciones || '', 300),
    });

    if (!result.sent) {
      console.error(
        '[API /api/send-email][ERROR CRÍTICO DE ENVÍO EN VERCEL]: No se pudo enviar el correo a bruno.marin.soporte@gmail.com:',
        {
          errorCategory: result.errorCategory,
          errorMessage: result.errorMessage,
          errorDetails: result.errorDetails,
        }
      );

      return NextResponse.json(
        {
          success: false,
          error: result.errorMessage || 'Error enviando el correo de alerta interna con Resend.',
          errorCategory: result.errorCategory,
          details: result.errorDetails,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      emailId: result.emailId,
    });
  } catch (err: any) {
    const classification = classifyEmailError(err);
    console.error('================================================================');
    console.error('[API /api/send-email][EXCEPCIÓN NO CONTROLADA EN VERCEL]');
    console.error(`[API /api/send-email] Categoría: ${classification.category}`);
    console.error(`[API /api/send-email] Diagnóstico: ${classification.diagnosticMessage}`);
    console.error('[API /api/send-email] Detalles del Error:', {
      name: err?.name,
      message: err?.message,
      code: err?.code,
      statusCode: err?.statusCode,
      stack: err?.stack,
    });
    console.error('================================================================');

    return NextResponse.json(
      {
        error: err.message || 'Error interno del servidor al procesar el correo.',
        errorCategory: classification.category,
        diagnosticMessage: classification.diagnosticMessage,
      },
      { status: 500 }
    );
  }
}
