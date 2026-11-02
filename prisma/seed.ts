import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Sembrando catálogo de precios y planes del Lavadero San Rafael ---');

  // Limpiar planes anteriores
  await prisma.subscriptionPlan.deleteMany();

  const plans = [
    // --- AUTOS (Base $23.500) ---
    {
      code: 'PLATA',
      name: 'Plan Plata',
      vehicleType: 'CAR',
      monthlyPrice: 39500,
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
      monthlyPrice: 57500,
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
      monthlyPrice: 76500,
      washesPerMonth: 4,
      includesQuickWax: true,
      includesPlasticHydration: true,
      includesHomeDelivery: true,
      includesDeepUpholsteryCleaning: true,
      benefitsDescription: '4 lavados completos al mes. Beneficios Oro + 1 limpieza profunda de tapizados + retiro y entrega a domicilio.',
    },

    // --- SUV (Base $28.000) ---
    {
      code: 'PLATA',
      name: 'Plan Plata',
      vehicleType: 'SUV',
      monthlyPrice: 47000,
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
      monthlyPrice: 69000,
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
      monthlyPrice: 91500,
      washesPerMonth: 4,
      includesQuickWax: true,
      includesPlasticHydration: true,
      includesHomeDelivery: true,
      includesDeepUpholsteryCleaning: true,
      benefitsDescription: '4 lavados completos al mes para SUV. Beneficios Oro + tapizados + retiro y entrega.',
    },

    // --- CAMIONETAS / PICKUP (Base $33.500) ---
    {
      code: 'PLATA',
      name: 'Plan Plata',
      vehicleType: 'PICKUP',
      monthlyPrice: 56500,
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
      monthlyPrice: 83000,
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
      monthlyPrice: 110500,
      washesPerMonth: 4,
      includesQuickWax: true,
      includesPlasticHydration: true,
      includesHomeDelivery: true,
      includesDeepUpholsteryCleaning: true,
      benefitsDescription: '4 lavados completos al mes para Camionetas. Beneficios Oro + tapizados + retiro y entrega.',
    },

    // --- CAMIONETA GRANDE / LARGE_PICKUP (Base $39.500) ---
    {
      code: 'PLATA',
      name: 'Plan Plata',
      vehicleType: 'LARGE_PICKUP',
      monthlyPrice: 67000,
      washesPerMonth: 2,
      includesQuickWax: true,
      includesPlasticHydration: false,
      includesHomeDelivery: false,
      includesDeepUpholsteryCleaning: false,
      benefitsDescription: '2 lavados completos al mes para Camioneta Grande. Incluye cera rápida.',
    },
    {
      code: 'ORO',
      name: 'Plan Oro',
      vehicleType: 'LARGE_PICKUP',
      monthlyPrice: 98500,
      washesPerMonth: 3,
      includesQuickWax: true,
      includesPlasticHydration: true,
      includesHomeDelivery: true,
      includesDeepUpholsteryCleaning: false,
      benefitsDescription: '3 lavados completos al mes para Camioneta Grande. Beneficios Oro + retiro y entrega.',
    },
    {
      code: 'PLATINO',
      name: 'Plan Platino',
      vehicleType: 'LARGE_PICKUP',
      monthlyPrice: 130500,
      washesPerMonth: 4,
      includesQuickWax: true,
      includesPlasticHydration: true,
      includesHomeDelivery: true,
      includesDeepUpholsteryCleaning: true,
      benefitsDescription: '4 lavados completos al mes para Camioneta Grande. Beneficios Oro + tapizados + retiro y entrega.',
    },

    // --- TRAFIC / UTILITARIO / UTILITY (Base $46.500) ---
    {
      code: 'PLATA',
      name: 'Plan Plata',
      vehicleType: 'UTILITY',
      monthlyPrice: 79000,
      washesPerMonth: 2,
      includesQuickWax: true,
      includesPlasticHydration: false,
      includesHomeDelivery: false,
      includesDeepUpholsteryCleaning: false,
      benefitsDescription: '2 lavados completos al mes para Trafic / Utilitario. Incluye cera rápida.',
    },
    {
      code: 'ORO',
      name: 'Plan Oro',
      vehicleType: 'UTILITY',
      monthlyPrice: 116500,
      washesPerMonth: 3,
      includesQuickWax: true,
      includesPlasticHydration: true,
      includesHomeDelivery: true,
      includesDeepUpholsteryCleaning: false,
      benefitsDescription: '3 lavados completos al mes para Trafic / Utilitario. Beneficios Oro + retiro y entrega.',
    },
    {
      code: 'PLATINO',
      name: 'Plan Platino',
      vehicleType: 'UTILITY',
      monthlyPrice: 154500,
      washesPerMonth: 4,
      includesQuickWax: true,
      includesPlasticHydration: true,
      includesHomeDelivery: true,
      includesDeepUpholsteryCleaning: true,
      benefitsDescription: '4 lavados completos al mes para Trafic / Utilitario. Beneficios Oro + tapizados + retiro y entrega.',
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
