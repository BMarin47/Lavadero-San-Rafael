import { ScheduleService } from '../src/lib/services/schedule.service';
import {
  BookingService,
  sanitizeWhatsAppPhone,
  generateWhatsAppBookingUrl,
} from '../src/lib/services/booking.service';
import { prisma } from '../src/lib/prisma';

async function verify() {
  console.log('=== INICIANDO PRUEBAS: SANITIZACIÓN WHATSAPP Y FLUJO CASCADA ===');

  // 1. Prueba Crítica de Sanitización de Número de WhatsApp
  const phoneTests = [
    { input: '+54 9 2604 12-3456', expected: '5492604123456' },
    { input: '+54 9 260 4123456', expected: '5492604123456' },
    { input: '  +54-9-(2604)-12-3456  ', expected: '5492604123456' },
    { input: '+5492604123456', expected: '5492604123456' },
  ];

  for (const test of phoneTests) {
    const cleaned = sanitizeWhatsAppPhone(test.input);
    console.log(`Sanitización: "${test.input}" -> "${cleaned}"`);
    if (cleaned !== test.expected) {
      throw new Error(`Fallo de sanitización para ${test.input}: se esperaba ${test.expected} pero dio ${cleaned}`);
    }
  }
  console.log('✅ Prueba de sanitización regex de WhatsApp superada.');

  // 2. Comprobar URL generada con número con espacios/guiones
  const urlGenerada = generateWhatsAppBookingUrl({
    lavaderoPhone: '+54 9 2604 12-3456',
    appointmentDate: '2026-09-18',
    startTime: '16:00',
    endTime: '18:00',
    vehicleType: 'SUV',
    vehicleModel: 'Tracker',
    serviceDescription: 'Lavado Completo (SUV)',
    paymentMethod: 'MERCADO_PAGO',
    amount: 26500,
    userName: 'Gonzalo Silva',
    userPhone: '+54 260 4998811',
  });

  console.log('URL de WhatsApp con número sanitizado:', urlGenerada);
  if (!urlGenerada.startsWith('https://wa.me/5492604123456?text=')) {
    throw new Error('Fallo: La URL de WhatsApp debe contener estrictamente el número sanitizado 5492604123456 sin símbolos ni espacios');
  }
  console.log('✅ URL de WhatsApp generada con número limpio correctamente.');

  // 3. Prueba de Creación de Reserva con Datos en Cascada
  const bookingSUV = await BookingService.createBooking(
    {
      userEmail: 'gonzalo@silva.com',
      userFullName: 'Gonzalo Silva',
      userPhone: '+54 260 4998811',
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
