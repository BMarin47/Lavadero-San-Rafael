import { prisma } from '../prisma';
import { ScheduleService, MAX_CAPACITY_PER_SLOT } from './schedule.service';
import { MercadoPagoService } from './mercadopago.service';

export const BASE_PRICES: Record<string, number> = {
  CAR: 22000,
  SUV: 26500,
  PICKUP: 32000,
};

export const VEHICLE_TYPE_LABELS: Record<string, string> = {
  CAR: 'Auto',
  SUV: 'SUV',
  PICKUP: 'Camioneta',
};

// Número de atención del lavadero (Configurable por variable de entorno o fallback)
export const DEFAULT_LAVADERO_PHONE =
  process.env.NEXT_PUBLIC_LAVADERO_WHATSAPP || '+54 9 2604 12-3456';

/**
 * Sanitiza cualquier formato de número telefónico (ej: '+54 9 2604 12-3456')
 * eliminando estrictamente espacios, guiones, signos +, paréntesis, etc.,
 * retornando exclusivamente la cadena de dígitos numéricos (ej: '5492604123456').
 */
export function sanitizeWhatsAppPhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

export interface CreateBookingDTO {
  userEmail: string;
  userFullName: string;
  userPhone: string;
  vehicleType: 'CAR' | 'SUV' | 'PICKUP';
  vehicleBrand: string;
  vehicleModel: string;
  appointmentDate: string; // YYYY-MM-DD
  startTime: string;       // "09:00"
  endTime: string;         // "11:00"
  serviceMode: 'INDIVIDUAL' | 'SUBSCRIPTION';
  subscriptionPlanCode?: 'PLATA' | 'ORO' | 'PLATINO';
  paymentMethod: 'MERCADO_PAGO' | 'CASH';
  homeDeliveryRequested?: boolean;
  deliveryAddress?: string;
  notes?: string;
}

/**
 * Genera dinámicamente la URL de WhatsApp (wa.me) con el mensaje prearmado
 * y el número de teléfono del lavadero estrictamente sanitizado.
 */
export function generateWhatsAppBookingUrl(params: {
  lavaderoPhone?: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  vehicleType: string;
  vehicleModel: string;
  serviceDescription: string;
  paymentMethod: string;
  amount: number;
  userName: string;
  userPhone: string;
  homeDelivery?: boolean;
  deliveryAddress?: string;
}): string {
  // 1. Sanitización estricta del número de destino mediante regex
  const rawPhone = params.lavaderoPhone || DEFAULT_LAVADERO_PHONE;
  const cleanPhone = sanitizeWhatsAppPhone(rawPhone);

  const paymentText =
    params.paymentMethod === 'MERCADO_PAGO'
      ? 'Mercado Pago (Online)'
      : 'Efectivo en el lavadero (Presencial)';

  const lines = [
    '¡Hola AquaShine San Rafael! 👋',
    'Acabo de confirmar una reserva a través de la Web App:',
    '',
    `📅 *Fecha:* ${params.appointmentDate}`,
    `⏰ *Horario:* ${params.startTime} a ${params.endTime} hs`,
    `🚗 *Vehículo:* ${VEHICLE_TYPE_LABELS[params.vehicleType] || params.vehicleType} - ${params.vehicleModel}`,
    `🧼 *Servicio:* ${params.serviceDescription}`,
    `💰 *Método de Pago:* ${paymentText} ($${params.amount.toLocaleString('es-AR')})`,
    `👤 *Cliente:* ${params.userName} (${params.userPhone})`,
  ];

  if (params.homeDelivery && params.deliveryAddress) {
    lines.push(`🚚 *Retiro y Entrega a Domicilio:* ${params.deliveryAddress}`);
  }

  lines.push('', '¡Muchas gracias! Aguardo la recepción del vehículo.');

  const encodedMessage = encodeURIComponent(lines.join('\n'));
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

export class BookingService {
  static async createBooking(dto: CreateBookingDTO, appBaseUrl: string) {
    // 1. Validar disponibilidad del horario y que no sea feriado ni domingo
    const availability = await ScheduleService.getAvailability(dto.appointmentDate);
    if (!availability.isOpen) {
      throw new Error(availability.reasonClosed || 'Fecha no disponible para atención.');
    }

    const slotMatch = availability.slots.find(
      (s) => s.startTime === dto.startTime && s.endTime === dto.endTime
    );

    if (!slotMatch) {
      throw new Error('La franja horaria seleccionada no coincide con los turnos autorizados.');
    }

    if (!slotMatch.isAvailable) {
      throw new Error('Lo sentimos, este bloque horario ya completó su cupo máximo de 3 boxes.');
    }

    // 2. Transacción en base de datos
    return await prisma.$transaction(async (tx) => {
      // a. Upsert de Usuario
      const user = await tx.user.upsert({
        where: { email: dto.userEmail },
        update: {
          fullName: dto.userFullName,
          phone: dto.userPhone,
        },
        create: {
          email: dto.userEmail,
          fullName: dto.userFullName,
          phone: dto.userPhone,
          role: 'CUSTOMER',
        },
      });

      // b. Crear vehículo (sin patente)
      const vehicle = await tx.vehicle.create({
        data: {
          userId: user.id,
          vehicleType: dto.vehicleType,
          brand: dto.vehicleBrand,
          model: dto.vehicleModel,
        },
      });

      // c. Doble chequeo de concurrencia dentro de la transacción
      const parts = dto.appointmentDate.split('-').map(Number);
      const startOfDay = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0);
      const endOfDay = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59);

      const currentCount = await tx.appointment.count({
        where: {
          appointmentDate: { gte: startOfDay, lte: endOfDay },
          startTime: dto.startTime,
          status: { in: ['CONFIRMED', 'PENDING_PAYMENT', 'IN_PROGRESS'] },
        },
      });

      if (currentCount >= MAX_CAPACITY_PER_SLOT) {
        throw new Error('El turno acaba de ser tomado por otro cliente. Por favor seleccioná otro horario.');
      }

      let isCoveredBySubscription = false;
      let subscriptionId: string | null = null;
      let finalPrice = BASE_PRICES[dto.vehicleType] || 22000;
      let serviceDescription = `Lavado Completo (${VEHICLE_TYPE_LABELS[dto.vehicleType] || dto.vehicleType})`;

      // d. Manejo de Suscripciones
      if (dto.serviceMode === 'SUBSCRIPTION') {
        const activeSub = await tx.userSubscription.findFirst({
          where: {
            userId: user.id,
            status: 'ACTIVE',
            remainingWashes: { gt: 0 },
          },
          include: { plan: true },
        });

        if (activeSub) {
          await tx.userSubscription.update({
            where: { id: activeSub.id },
            data: { remainingWashes: { decrement: 1 } },
          });

          isCoveredBySubscription = true;
          subscriptionId = activeSub.id;
          finalPrice = 0;
          serviceDescription = `Cupo de Suscripción (${activeSub.plan.name})`;
        } else if (dto.subscriptionPlanCode) {
          const plan = await tx.subscriptionPlan.findUnique({
            where: {
              code_vehicleType: {
                code: dto.subscriptionPlanCode,
                vehicleType: dto.vehicleType,
              },
            },
          });

          if (plan) {
            finalPrice = plan.monthlyPrice;
            const periodStart = new Date();
            const periodEnd = new Date();
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            const newSub = await tx.userSubscription.create({
              data: {
                userId: user.id,
                planId: plan.id,
                vehicleId: vehicle.id,
                status: dto.paymentMethod === 'CASH' ? 'ACTIVE' : 'PENDING',
                remainingWashes: plan.washesPerMonth - 1,
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd,
              },
            });

            isCoveredBySubscription = true;
            subscriptionId = newSub.id;
            serviceDescription = `Nueva Suscripción Mensual (${plan.name})`;
          }
        }
      }

      // e. Crear Registro de Turno
      const appointmentTargetDate = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);

      const appointmentStatus = isCoveredBySubscription && finalPrice === 0
        ? 'CONFIRMED'
        : dto.paymentMethod === 'CASH'
        ? 'CONFIRMED'
        : 'PENDING_PAYMENT';

      const appointment = await tx.appointment.create({
        data: {
          userId: user.id,
          vehicleId: vehicle.id,
          subscriptionId: subscriptionId,
          appointmentDate: appointmentTargetDate,
          startTime: dto.startTime,
          endTime: dto.endTime,
          status: appointmentStatus,
          basePrice: finalPrice,
          coveredBySubscription: isCoveredBySubscription,
          homePickupDelivery: dto.homeDeliveryRequested || false,
          deliveryAddress: dto.deliveryAddress || null,
          notes: dto.notes || null,
        },
      });

      // f. Bitácora de Uso si corresponde
      if (isCoveredBySubscription && subscriptionId) {
        await tx.subscriptionUsage.create({
          data: {
            subscriptionId,
            appointmentId: appointment.id,
          },
        });
      }

      // g. Registrar Pago
      const payment = await tx.payment.create({
        data: {
          appointmentId: appointment.id,
          userSubscriptionId: subscriptionId,
          userId: user.id,
          paymentMethod: dto.paymentMethod,
          status: isCoveredBySubscription && finalPrice === 0
            ? 'APPROVED'
            : dto.paymentMethod === 'CASH'
            ? 'PENDING'
            : 'PENDING',
          amount: finalPrice,
          currency: 'ARS',
        },
      });

      // h. Preferencia Mercado Pago
      let mpCheckoutUrl: string | null = null;
      if (dto.paymentMethod === 'MERCADO_PAGO' && finalPrice > 0) {
        const mpPreference = await MercadoPagoService.createAppointmentPreference({
          appointmentId: appointment.id,
          userEmail: user.email,
          title: `Lavadero San Rafael - ${serviceDescription} (${dto.vehicleModel})`,
          amount: finalPrice,
          backUrlBase: appBaseUrl,
        });

        await tx.payment.update({
          where: { id: payment.id },
          data: { mpPreferenceId: mpPreference.id },
        });

        mpCheckoutUrl = mpPreference.initPoint;
      }

      // i. Generar URL de WhatsApp sanitizada
      const whatsAppUrl = generateWhatsAppBookingUrl({
        appointmentDate: dto.appointmentDate,
        startTime: dto.startTime,
        endTime: dto.endTime,
        vehicleType: dto.vehicleType,
        vehicleModel: dto.vehicleModel,
        serviceDescription,
        paymentMethod: dto.paymentMethod,
        amount: finalPrice,
        userName: dto.userFullName,
        userPhone: dto.userPhone,
        homeDelivery: dto.homeDeliveryRequested,
        deliveryAddress: dto.deliveryAddress,
      });

      return {
        appointment,
        payment,
        user,
        vehicle,
        mpCheckoutUrl,
        whatsAppUrl,
      };
    });
  }
}
