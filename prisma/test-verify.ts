import { ScheduleService } from '../src/lib/services/schedule.service';
import {
  BookingService,
  sanitizeWhatsAppPhone,
  generateWhatsAppBookingUrl,
} from '../src/lib/services/booking.service';
import { prisma } from '../src/lib/prisma';

async function verify() {
  console.log('=== INICIANDO PRUEBAS: SANITIZACIÓN WHATSAPP Y FLUJO CASCADA ===');

  // 1. Prueba Crítica de Sanitización de Número de WhatsApp y combinación de prefijo +54 9
  const phoneTests = [
    { input: '+54 9 2604 12-3456', expected: '5492604123456' },
    { input: '+54 9 260 4123456', expected: '5492604123456' },
    { input: '  +54-9-(2604)-12-3456  ', expected: '5492604123456' },
    { input: '+5492604123456', expected: '5492604123456' },
    { input: '2604 12-3456', expected: '5492604123456' },
    { input: '02604-123456', expected: '5492604123456' },
    { input: '+54 260 4123456', expected: '5492604123456' },
    { input: '+54 9 2604 61-4537', expected: '5492604614537' },
    { input: '2604 61-4537', expected: '5492604614537' },
    { input: '2604614537', expected: '5492604614537' },
  ];

  for (const test of phoneTests) {
    const cleaned = sanitizeWhatsAppPhone(test.input);
    console.log(`Sanitización: "${test.input}" -> "${cleaned}"`);
    if (cleaned !== test.expected) {
      throw new Error(`Fallo de sanitización para ${test.input}: se esperaba ${test.expected} pero dio ${cleaned}`);
    }
  }
  console.log('✅ Prueba de sanitización regex de WhatsApp superada.');

  // 2. Comprobar URL generada tomando dinámicamente el teléfono del usuario
  const urlGenerada = generateWhatsAppBookingUrl({
    appointmentDate: '2026-09-18',
    startTime: '16:00',
    endTime: '18:00',
    vehicleType: 'SUV',
    vehicleModel: 'Tracker',
    serviceDescription: 'Lavado Completo (SUV)',
    paymentMethod: 'MERCADO_PAGO',
    amount: 26500,
    userName: 'Gonzalo Silva',
    userPhone: '+54 9 2604 99-8811',
  });

  console.log('URL de WhatsApp con número dinámico sanitizado:', urlGenerada);
  if (!urlGenerada.startsWith('https://wa.me/5492604998811?text=')) {
    throw new Error('Fallo: La URL de WhatsApp debe tomar dinámicamente el teléfono del usuario (5492604998811)');
  }
  console.log('✅ URL de WhatsApp toma dinámicamente el teléfono del usuario.');

  // 3. Prueba de Creación de Reserva con Datos en Cascada
  const bookingSUV = await BookingService.createBooking(
    {
      userEmail: 'gonzalo@silva.com',
      userFullName: 'Gonzalo Silva',
      userPhone: '+54 9 2604 99-8811',
      vehicleType: 'SUV',
      vehicleBrand: 'Chevrolet',
      vehicleModel: 'Tracker',
      appointmentDate: '2026-09-18',
      startTime: '16:00',
      endTime: '18:00',
      serviceMode: 'INDIVIDUAL',
      paymentMethod: 'MERCADO_PAGO',
    },
    'http://localhost:3000'
  );

  console.log('Reserva SUV Creada:', {
    id: bookingSUV.appointment.id,
    precio: bookingSUV.appointment.basePrice,
    marca: bookingSUV.vehicle.brand,
    modelo: bookingSUV.vehicle.model,
    whatsAppUrl: bookingSUV.whatsAppUrl,
  });

  if (!bookingSUV.whatsAppUrl.startsWith('https://wa.me/5492604998811?text=')) {
    throw new Error('Fallo: El whatsAppUrl devuelto por BookingService debe dirigirse al teléfono dinámico del cliente (5492604998811)');
  }

  if (bookingSUV.appointment.basePrice !== 26500) {
    throw new Error('Fallo: Tarifa de SUV debe ser $26.500');
  }

  console.log('=== TODAS LAS VALIDACIONES DE SANITIZACIÓN Y CASOS DE PRUEBA PASARON CON ÉXITO ===');
}

verify()
  .catch((err) => {
    console.error('Error durante la verificación:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
