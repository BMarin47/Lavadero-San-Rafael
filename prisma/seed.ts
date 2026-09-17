import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Sembrando catálogo de precios y planes del Lavadero San Rafael ---');

  // Limpiar planes anteriores
  await prisma.subscriptionPlan.deleteMany();

  const plans = [
    // --- AUTOS (Base $22.000) ---
    {
      code: 'PLATA',
      name: 'Plan Plata',
      vehicleType: 'CAR',
      monthlyPrice: 38000,
      washesPerMonth: 2,
      includesQuickWax: true,
      includesPlasticHydration: false,
      includesHomeDelivery: false,
      includesDeepUpholsteryCleaning: false,
      benefitsDescription: '2 lavados completos al mes. Incluye cera rápida protectora.',
    },
    {
      code: 'ORO',
      name: 'Plan Oro',
      vehicleType: 'CAR',
      monthlyPrice: 56000,
      washesPerMonth: 3,
      includesQuickWax: true,
      includesPlasticHydration: true,
      includesHomeDelivery: true,
      includesDeepUpholsteryCleaning: false,
      benefitsDescription: '3 lavados completos al mes. Cera + hidratación de plásticos int/ext + retiro y entrega a domicilio.',
    },
    {
      code: 'PLATINO',
      name: 'Plan Platino',
      vehicleType: 'CAR',
      monthlyPrice: 75000,
      washesPerMonth: 4,
      includesQuickWax: true,
      includesPlasticHydration: true,
      includesHomeDelivery: true,
      includesDeepUpholsteryCleaning: true,
      benefitsDescription: '4 lavados completos al mes. Beneficios Oro + 1 limpieza profunda de tapizados + retiro y entrega a domicilio.',
    },

    // --- SUV (Base $26.500) ---
    {
      code: 'PLATA',
      name: 'Plan Plata',
      vehicleType: 'SUV',
      monthlyPrice: 45500,
      washesPerMonth: 2,
      includesQuickWax: true,
      includesPlasticHydration: false,
      includesHomeDelivery: false,
      includesDeepUpholsteryCleaning: false,
      benefitsDescription: '2 lavados completos al mes para SUV. Incluye cera rápida.',
    },
    {
      code: 'ORO',
      name: 'Plan Oro',
      vehicleType: 'SUV',
      monthlyPrice: 67500,
      washesPerMonth: 3,
      includesQuickWax: true,
      includesPlasticHydration: true,
      includesHomeDelivery: true,
      includesDeepUpholsteryCleaning: false,
      benefitsDescription: '3 lavados completos al mes para SUV. Beneficios Oro + retiro y entrega.',
    },
    {
      code: 'PLATINO',
      name: 'Plan Platino',
      vehicleType: 'SUV',
      monthlyPrice: 90000,
      washesPerMonth: 4,
      includesQuickWax: true,
      includesPlasticHydration: true,
      includesHomeDelivery: true,
      includesDeepUpholsteryCleaning: true,
      benefitsDescription: '4 lavados completos al mes para SUV. Beneficios Oro + tapizados + retiro y entrega.',
    },

    // --- CAMIONETAS / PICKUP (Base $32.000) ---
    {
      code: 'PLATA',
      name: 'Plan Plata',
      vehicleType: 'PICKUP',
      monthlyPrice: 55000,
      washesPerMonth: 2,
      includesQuickWax: true,
      includesPlasticHydration: false,
      includesHomeDelivery: false,
      includesDeepUpholsteryCleaning: false,
      benefitsDescription: '2 lavados completos al mes para Camionetas. Incluye cera rápida.',
    },
    {
      code: 'ORO',
      name: 'Plan Oro',
      vehicleType: 'PICKUP',
      monthlyPrice: 81500,
      washesPerMonth: 3,
      includesQuickWax: true,
      includesPlasticHydration: true,
      includesHomeDelivery: true,
      includesDeepUpholsteryCleaning: false,
      benefitsDescription: '3 lavados completos al mes para Camionetas. Beneficios Oro + retiro y entrega.',
    },
    {
      code: 'PLATINO',
      name: 'Plan Platino',
      vehicleType: 'PICKUP',
      monthlyPrice: 109000,
      washesPerMonth: 4,
      includesQuickWax: true,
      includesPlasticHydration: true,
      includesHomeDelivery: true,
      includesDeepUpholsteryCleaning: true,
      benefitsDescription: '4 lavados completos al mes para Camionetas. Beneficios Oro + tapizados + retiro y entrega.',
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.create({ data: plan });
  }

  // Crear usuario y vehículo de prueba sin patente
  const testUser = await prisma.user.upsert({
    where: { email: 'cliente.demo@sanrafael.com' },
    update: {},
    create: {
      email: 'cliente.demo@sanrafael.com',
      fullName: 'Martín Rodríguez',
      phone: '+54 260 4123456',
      role: 'CUSTOMER',
    },
  });

  await prisma.vehicle.create({
    data: {
      userId: testUser.id,
      vehicleType: 'CAR',
      brand: 'Fiat',
      model: 'Cronos',
      color: 'Blanco',
    },
  });

  console.log('✅ Catálogo de planes y usuario demo cargados con éxito (sin patente).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
