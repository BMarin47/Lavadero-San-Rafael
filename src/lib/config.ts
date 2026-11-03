/**
 * SINGLE SOURCE OF TRUTH — Configuración Central del Lavadero San Rafael
 * Centraliza identidad de marca, contactos, URLs, rutas, categorías de vehículos,
 * tarifas, duraciones en minutos y cálculos matemáticos de bloques horarios.
 */

export type VehicleCategoryType =
  | 'CAR'
  | 'SUV'
  | 'PICKUP'
  | 'LARGE_PICKUP'
  | 'UTILITY';

export type PlanCode = 'PLATA' | 'ORO' | 'PLATINO';
export type ServiceMode = 'INDIVIDUAL' | 'SUBSCRIPTION';

export const BRAND_CONFIG = {
  name: (() => {
    const raw = process.env.NEXT_PUBLIC_BRAND_NAME?.trim();
    if (!raw || raw.toLowerCase().includes('aquashine')) {
      return 'Lavadero San Rafael';
    }
    return raw;
  })(),
  shortName: 'Lavadero',
  city: 'San Rafael',
  province: 'Mendoza',
  fullLocation: 'San Rafael, Mendoza',
  tagline: 'Detailing & Lavado Vehicular',
  initials: 'LSR',
  statementDescriptor: 'LAVADERO RAFAEL', // Máximo 16 caracteres para Mercado Pago
  siteUrl: (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    'https://lavadero-san-rafael.vercel.app'
  ).replace(/\/$/, ''),
  domain: 'lavadero-san-rafael.vercel.app',
  whatsappNumber:
    (process.env.NEXT_PUBLIC_LAVADERO_WHATSAPP || '5492604654255').replace(
      /\D/g,
      ''
    ) || '5492604654255',
  whatsappDisplay:
    process.env.NEXT_PUBLIC_LAVADERO_WHATSAPP?.trim() || '+54 9 260 465-4255',
  notificationEmail:
    process.env.NOTIFICATION_EMAIL?.trim() || 'bruno.marin.soporte@gmail.com',
  superAdminEmails: ['bruno.marin.soporte@gmail.com'] as const,
  vapidSubject:
    process.env.VAPID_SUBJECT?.trim() || 'mailto:bruno.marin.soporte@gmail.com',
  cashDiscountRate: 0.05,
  businessHoursText:
    'Horarios: Lunes a Viernes de 09:00 a 13:00 y 16:00 a 20:00 hs • Sábados de 09:00 a 13:00 hs • Domingos cerrado',
} as const;

export const ROUTES_CONFIG = {
  publicRoutes: [
    '/',
    '/qr',
    '/login',
    '/register',
    '/reserva-exitosa',
    '/auth/callback',
  ] as const,
  protectedRoutes: ['/admin', '/dashboard'] as const,
  adminRoutes: ['/admin'] as const,
} as const;

export interface VehicleCategoryDefinition {
  code: VehicleCategoryType;
  label: string;
  sublabel: string;
  checkoutTitle: string;
  emailTitle: string;
  price: number;
  durationMinutes: number;
  durationHours: number;
  weekdayStartTimes: readonly string[];
  saturdayStartTimes: readonly string[];
}

/**
 * Definición canónica de categorías de vehículos:
 * - Auto (CAR): 120 min (2 hs) -> $23.500
 * - SUV (SUV): 120 min (2 hs) -> $28.000
 * - Camioneta (PICKUP): 180 min (3 hs) -> $33.500
 * - Camioneta Grande (LARGE_PICKUP): 240 min (4 hs) -> $39.500
 * - Trafic / Utilitario (UTILITY): 240 min (4 hs) -> $46.500
 */
export const VEHICLE_CATEGORIES_CONFIG: Record<
  VehicleCategoryType,
  VehicleCategoryDefinition
> = {
  CAR: {
    code: 'CAR',
    label: 'Auto',
    sublabel: 'Hatchback / Sedán',
    checkoutTitle: 'Auto (Hatchback / Sedán)',
    emailTitle: 'Auto (Hatchback / Sedán - 2 hs)',
    price: 23500,
    durationMinutes: 120,
    durationHours: 2,
    weekdayStartTimes: ['09:00', '11:00', '16:00', '18:00'],
    saturdayStartTimes: ['09:00', '11:00'],
  },
  SUV: {
    code: 'SUV',
    label: 'SUV',
    sublabel: 'Cross / Monovolumen',
    checkoutTitle: 'SUV / Monovolumen',
    emailTitle: 'SUV / Monovolumen (2 hs)',
    price: 28000,
    durationMinutes: 120,
    durationHours: 2,
    weekdayStartTimes: ['09:00', '11:00', '16:00', '18:00'],
    saturdayStartTimes: ['09:00', '11:00'],
  },
  PICKUP: {
    code: 'PICKUP',
    label: 'Camioneta',
    sublabel: 'Pick-up Estándar',
    checkoutTitle: 'Camioneta (Amarok / Hilux / Ranger)',
    emailTitle: 'Camioneta / Pick-Up Estándar (3 hs)',
    price: 33500,
    durationMinutes: 180,
    durationHours: 3,
    weekdayStartTimes: ['09:00', '16:00'],
    saturdayStartTimes: ['09:00'],
  },
  LARGE_PICKUP: {
    code: 'LARGE_PICKUP',
    label: 'Camioneta Grande',
    sublabel: 'RAM / F-150 / Full-Size',
    checkoutTitle: 'Camioneta Grande (RAM / F-150 / Full-Size)',
    emailTitle: 'Camioneta Grande (RAM / F-150 / Full-Size - 4 hs)',
    price: 39500,
    durationMinutes: 240,
    durationHours: 4,
    weekdayStartTimes: ['09:00', '16:00'],
    saturdayStartTimes: ['09:00'],
  },
  UTILITY: {
    code: 'UTILITY',
    label: 'Trafic / Utilitario',
    sublabel: 'Furgón / Combi / Van',
    checkoutTitle: 'Trafic / Utilitario (Furgón / Combi / Van)',
    emailTitle: 'Trafic / Utilitario (Furgón / Combi / Van - 4 hs)',
    price: 46500,
    durationMinutes: 240,
    durationHours: 4,
    weekdayStartTimes: ['09:00', '16:00'],
    saturdayStartTimes: ['09:00'],
  },
};

export const VEHICLE_CONFIG: Record<
  VehicleCategoryType,
  {
    label: string;
    sublabel: string;
    price: number;
    durationHours: number;
    durationMinutes: number;
  }
> = {
  CAR: {
    label: VEHICLE_CATEGORIES_CONFIG.CAR.label,
    sublabel: VEHICLE_CATEGORIES_CONFIG.CAR.sublabel,
    price: VEHICLE_CATEGORIES_CONFIG.CAR.price,
    durationHours: VEHICLE_CATEGORIES_CONFIG.CAR.durationHours,
    durationMinutes: VEHICLE_CATEGORIES_CONFIG.CAR.durationMinutes,
  },
  SUV: {
    label: VEHICLE_CATEGORIES_CONFIG.SUV.label,
    sublabel: VEHICLE_CATEGORIES_CONFIG.SUV.sublabel,
    price: VEHICLE_CATEGORIES_CONFIG.SUV.price,
    durationHours: VEHICLE_CATEGORIES_CONFIG.SUV.durationHours,
    durationMinutes: VEHICLE_CATEGORIES_CONFIG.SUV.durationMinutes,
  },
  PICKUP: {
    label: VEHICLE_CATEGORIES_CONFIG.PICKUP.label,
    sublabel: VEHICLE_CATEGORIES_CONFIG.PICKUP.sublabel,
    price: VEHICLE_CATEGORIES_CONFIG.PICKUP.price,
    durationHours: VEHICLE_CATEGORIES_CONFIG.PICKUP.durationHours,
    durationMinutes: VEHICLE_CATEGORIES_CONFIG.PICKUP.durationMinutes,
  },
  LARGE_PICKUP: {
    label: VEHICLE_CATEGORIES_CONFIG.LARGE_PICKUP.label,
    sublabel: VEHICLE_CATEGORIES_CONFIG.LARGE_PICKUP.sublabel,
    price: VEHICLE_CATEGORIES_CONFIG.LARGE_PICKUP.price,
    durationHours: VEHICLE_CATEGORIES_CONFIG.LARGE_PICKUP.durationHours,
    durationMinutes: VEHICLE_CATEGORIES_CONFIG.LARGE_PICKUP.durationMinutes,
  },
  UTILITY: {
    label: VEHICLE_CATEGORIES_CONFIG.UTILITY.label,
    sublabel: VEHICLE_CATEGORIES_CONFIG.UTILITY.sublabel,
    price: VEHICLE_CATEGORIES_CONFIG.UTILITY.price,
    durationHours: VEHICLE_CATEGORIES_CONFIG.UTILITY.durationHours,
    durationMinutes: VEHICLE_CATEGORIES_CONFIG.UTILITY.durationMinutes,
  },
};

export const BASE_PRICES: Record<VehicleCategoryType, number> = {
  CAR: VEHICLE_CATEGORIES_CONFIG.CAR.price,
  SUV: VEHICLE_CATEGORIES_CONFIG.SUV.price,
  PICKUP: VEHICLE_CATEGORIES_CONFIG.PICKUP.price,
  LARGE_PICKUP: VEHICLE_CATEGORIES_CONFIG.LARGE_PICKUP.price,
  UTILITY: VEHICLE_CATEGORIES_CONFIG.UTILITY.price,
};

export const VEHICLE_TYPE_LABELS: Record<VehicleCategoryType, string> = {
  CAR: VEHICLE_CATEGORIES_CONFIG.CAR.label,
  SUV: VEHICLE_CATEGORIES_CONFIG.SUV.label,
  PICKUP: VEHICLE_CATEGORIES_CONFIG.PICKUP.label,
  LARGE_PICKUP: VEHICLE_CATEGORIES_CONFIG.LARGE_PICKUP.label,
  UTILITY: VEHICLE_CATEGORIES_CONFIG.UTILITY.label,
};

export const VEHICLE_CHECKOUT_TITLES: Record<VehicleCategoryType, string> = {
  CAR: VEHICLE_CATEGORIES_CONFIG.CAR.checkoutTitle,
  SUV: VEHICLE_CATEGORIES_CONFIG.SUV.checkoutTitle,
  PICKUP: VEHICLE_CATEGORIES_CONFIG.PICKUP.checkoutTitle,
  LARGE_PICKUP: VEHICLE_CATEGORIES_CONFIG.LARGE_PICKUP.checkoutTitle,
  UTILITY: VEHICLE_CATEGORIES_CONFIG.UTILITY.checkoutTitle,
};

export const VEHICLE_EMAIL_TITLES: Record<VehicleCategoryType, string> = {
  CAR: VEHICLE_CATEGORIES_CONFIG.CAR.emailTitle,
  SUV: VEHICLE_CATEGORIES_CONFIG.SUV.emailTitle,
  PICKUP: VEHICLE_CATEGORIES_CONFIG.PICKUP.emailTitle,
  LARGE_PICKUP: VEHICLE_CATEGORIES_CONFIG.LARGE_PICKUP.emailTitle,
  UTILITY: VEHICLE_CATEGORIES_CONFIG.UTILITY.emailTitle,
};

export interface PlanDetail {
  code: PlanCode;
  name: string;
  washes: number;
  prices: Record<VehicleCategoryType, { price: number; orig: number }>;
  features: string[];
  badge?: string;
  isPopular?: boolean;
}

export const PLANS_CATALOG: PlanDetail[] = [
  {
    code: 'PLATA',
    name: 'Plan Plata',
    washes: 2,
    prices: {
      CAR: { price: 39500, orig: VEHICLE_CATEGORIES_CONFIG.CAR.price * 2 },
      SUV: { price: 47000, orig: VEHICLE_CATEGORIES_CONFIG.SUV.price * 2 },
      PICKUP: { price: 56500, orig: VEHICLE_CATEGORIES_CONFIG.PICKUP.price * 2 },
      LARGE_PICKUP: {
        price: 67000,
        orig: VEHICLE_CATEGORIES_CONFIG.LARGE_PICKUP.price * 2,
      },
      UTILITY: { price: 79000, orig: VEHICLE_CATEGORIES_CONFIG.UTILITY.price * 2 },
    },
    features: [
      '2 lavados completos al mes',
      'Cera rápida protectora hidrofóbica',
      'Aspirado completo y desinfección',
    ],
  },
  {
    code: 'ORO',
    name: 'Plan Oro',
    washes: 3,
    prices: {
      CAR: { price: 57500, orig: VEHICLE_CATEGORIES_CONFIG.CAR.price * 3 },
      SUV: { price: 69000, orig: VEHICLE_CATEGORIES_CONFIG.SUV.price * 3 },
      PICKUP: { price: 83000, orig: VEHICLE_CATEGORIES_CONFIG.PICKUP.price * 3 },
      LARGE_PICKUP: {
        price: 98500,
        orig: VEHICLE_CATEGORIES_CONFIG.LARGE_PICKUP.price * 3,
      },
      UTILITY: {
        price: 116500,
        orig: VEHICLE_CATEGORIES_CONFIG.UTILITY.price * 3,
      },
    },
    features: [
      '3 lavados completos al mes',
      'Cera de alta durabilidad + sellado',
      'Hidratación de plásticos int/ext',
      'Retiro y entrega a domicilio bonificado',
    ],
    badge: 'Más Elegido',
    isPopular: true,
  },
  {
    code: 'PLATINO',
    name: 'Plan Platino VIP',
    washes: 4,
    prices: {
      CAR: { price: 76500, orig: VEHICLE_CATEGORIES_CONFIG.CAR.price * 4 },
      SUV: { price: 91500, orig: VEHICLE_CATEGORIES_CONFIG.SUV.price * 4 },
      PICKUP: {
        price: 110500,
        orig: VEHICLE_CATEGORIES_CONFIG.PICKUP.price * 4,
      },
      LARGE_PICKUP: {
        price: 130500,
        orig: VEHICLE_CATEGORIES_CONFIG.LARGE_PICKUP.price * 4,
      },
      UTILITY: {
        price: 154500,
        orig: VEHICLE_CATEGORIES_CONFIG.UTILITY.price * 4,
      },
    },
    features: [
      '4 lavados completos al mes',
      'Todos los beneficios del Plan Oro',
      '1 limpieza profunda de tapizados por ciclo',
      'Atención prioritaria y delivery incluido',
    ],
    badge: 'Detallado VIP',
  },
];

export const PLANS_PRICES: Record<PlanCode, Record<VehicleCategoryType, number>> = {
  PLATA: {
    CAR: PLANS_CATALOG[0].prices.CAR.price,
    SUV: PLANS_CATALOG[0].prices.SUV.price,
    PICKUP: PLANS_CATALOG[0].prices.PICKUP.price,
    LARGE_PICKUP: PLANS_CATALOG[0].prices.LARGE_PICKUP.price,
    UTILITY: PLANS_CATALOG[0].prices.UTILITY.price,
  },
  ORO: {
    CAR: PLANS_CATALOG[1].prices.CAR.price,
    SUV: PLANS_CATALOG[1].prices.SUV.price,
    PICKUP: PLANS_CATALOG[1].prices.PICKUP.price,
    LARGE_PICKUP: PLANS_CATALOG[1].prices.LARGE_PICKUP.price,
    UTILITY: PLANS_CATALOG[1].prices.UTILITY.price,
  },
  PLATINO: {
    CAR: PLANS_CATALOG[2].prices.CAR.price,
    SUV: PLANS_CATALOG[2].prices.SUV.price,
    PICKUP: PLANS_CATALOG[2].prices.PICKUP.price,
    LARGE_PICKUP: PLANS_CATALOG[2].prices.LARGE_PICKUP.price,
    UTILITY: PLANS_CATALOG[2].prices.UTILITY.price,
  },
};

/**
 * Convierte una hora en formato "HH:mm" a minutos totales desde las 00:00.
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

/**
 * Convierte minutos totales desde las 00:00 a formato "HH:mm".
 */
export function minutesToTime(totalMinutes: number): string {
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Calcula matemáticamente el horario de finalización:
 * hora_inicio (en minutos) + duracion_servicio_en_minutos -> "HH:mm"
 * Ejemplo: "18:00" (1080 min) + 120 min = 1200 min -> "20:00".
 */
export function calculateEndTimeFromMinutes(
  startTime: string,
  durationMinutes: number
): string {
  const startMins = timeToMinutes(startTime);
  return minutesToTime(startMins + durationMinutes);
}

/**
 * Calcula el precio final aplicando descuento por pago en efectivo/transferencia si corresponde.
 */
export function calculateBookingPrice(
  vehicleType: VehicleCategoryType,
  paymentMethod: 'MERCADO_PAGO' | 'CASH' = 'MERCADO_PAGO'
): number {
  const basePrice =
    VEHICLE_CATEGORIES_CONFIG[vehicleType]?.price ??
    VEHICLE_CATEGORIES_CONFIG.CAR.price;
  if (paymentMethod === 'CASH') {
    return Math.round(basePrice * (1 - BRAND_CONFIG.cashDiscountRate));
  }
  return basePrice;
}
