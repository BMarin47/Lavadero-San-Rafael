import { z } from 'zod';
import { normalizeVehicleType, VehicleCategoryType } from '@/lib/config';

export const VEHICLE_TYPE_VALUES = [
  'CAR',
  'SUV',
  'PICKUP',
  'LARGE_PICKUP',
  'UTILITY',
] as const;

export const VehicleTypeEnumSchema = z.enum(VEHICLE_TYPE_VALUES);

/**
 * Escapa caracteres especiales HTML (&, <, >, ", ') para prevenir inyección HTML / XSS
 * al interpolar datos de usuario en plantillas de correo electrónico (Resend).
 */
export function escapeHtml(unsafe: unknown): string {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sanitiza texto plano eliminando etiquetas HTML (<script>, <img>, etc.),
 * caracteres de control (\r, \n, \0), esquemas peligrosos (javascript:, data:)
 * y truncando a una longitud máxima segura.
 */
export function sanitizePlainText(input: unknown, maxLength: number = 120): string {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/<[^>]*>?/gm, '') // Eliminar cualquier etiqueta HTML
    .replace(/[\x00-\x1F\x7F]/g, ' ') // Eliminar caracteres de control y saltos de línea crudos
    .replace(/(javascript|data|vbscript):/gi, '') // Bloquear protocolos de ejecución
    .replace(/[<>]/g, '') // Asegurar ausencia de signos angulares residuales
    .replace(/\s+/g, ' ') // Colapsar espacios repetidos
    .trim()
    .slice(0, maxLength);
}

/**
 * Sanitiza y normaliza una dirección de correo electrónico previniendo Email Header Injection.
 */
export function sanitizeEmailInput(input: unknown): string {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/[\x00-\x1F\x7F\s<>",;:\\]/g, '')
    .toLowerCase()
    .trim()
    .slice(0, 120);
}

/**
 * Sanitiza el input telefónico del usuario permitiendo únicamente dígitos, espacios y guiones,
 * y quitando prefijos +54 9 o ceros iniciales redundantes.
 */
export function sanitizePhoneInput(input: unknown): string {
  if (input === null || input === undefined) return '';
  let cleaned = String(input)
    .replace(/[^\d\s\-+()]/g, '')
    .trim();
  cleaned = cleaned.replace(/^(\+?54\s*9?|\+?54)\s*/, '');
  cleaned = cleaned.replace(/^0+/, '');
  return cleaned.slice(0, 20).trim();
}

/**
 * Formatea de manera segura un teléfono validado al estándar de WhatsApp Argentina (+54 9 ...).
 */
export function formatWhatsAppArgPhone(rawPhone: unknown): string {
  const cleaned = sanitizePhoneInput(rawPhone);
  const digits = cleaned.replace(/\D/g, '');
  if (!digits) return '';
  return `+54 9 ${digits.slice(0, 13)}`;
}

/**
 * Esquema estricto para Nombre y Apellido:
 * - Sanitiza etiquetas HTML y caracteres de control
 * - Mínimo 2 y máximo 80 caracteres
 * - Solo permite letras (incluyendo acentos/ñ), espacios, apóstrofes, puntos y guiones
 */
export const FullNameSchema = z
  .string()
  .transform((val) => sanitizePlainText(val, 80))
  .refine((val) => val.length >= 2, {
    message: 'Por favor ingresá tu nombre y apellido (mínimo 2 caracteres).',
  })
  .refine((val) => val.length <= 80, {
    message: 'El nombre no puede superar los 80 caracteres.',
  })
  .refine((val) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'.\-]+$/.test(val), {
    message: 'El nombre y apellido solo puede contener letras y espacios válidos.',
  });

/**
 * Esquema estricto para Teléfono / WhatsApp:
 * - Sanitiza caracteres no numéricos/telefónicos
 * - Exige entre 8 y 13 dígitos reales (código de área + número sin 0 ni 15, ej: 2604654255)
 */
export const PhoneSchema = z
  .string()
  .transform((val) => sanitizePhoneInput(val))
  .refine(
    (val) => {
      const digits = val.replace(/\D/g, '');
      return digits.length >= 8 && digits.length <= 13;
    },
    {
      message:
        'Por favor ingresá un número de WhatsApp válido con código de área (ej: 260 465-4255, entre 8 y 13 dígitos).',
    }
  );

/**
 * Esquema estricto para Correo Electrónico:
 * - Normaliza a minúsculas y elimina caracteres de control
 * - Valida formato RFC y longitud máxima de 120 caracteres
 */
export const EmailSchema = z
  .string()
  .transform((val) => sanitizeEmailInput(val))
  .pipe(
    z
      .string()
      .max(120, 'El correo electrónico no puede superar los 120 caracteres.')
      .email('Por favor ingresá un correo electrónico válido.')
  );

export const OptionalEmailSchema = z
  .string()
  .optional()
  .transform((val) => (val ? sanitizeEmailInput(val) : ''))
  .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
    message: 'Por favor ingresá un correo electrónico válido.',
  });

/**
 * Esquema estricto para Indicaciones / Notas opcionales:
 * - Sanitiza etiquetas HTML y scripts
 * - Máximo 300 caracteres
 */
export const NotesSchema = z
  .string()
  .optional()
  .transform((val) => (val ? sanitizePlainText(val, 300) : ''));

/**
 * Esquema Zod flexible para categoría/tipo de vehículo que acepta tanto los códigos
 * internos ('CAR' | 'SUV' | 'PICKUP' | 'LARGE_PICKUP' | 'UTILITY') como las etiquetas
 * de UI ('Auto', 'SUV', 'Camioneta', 'Camioneta Grande', 'Trafic / Utilitario')
 * y los transforma al enum canónico.
 */
export const VehicleCategorySchema = z
  .string()
  .min(1, 'Seleccioná una categoría de vehículo.')
  .transform((val): VehicleCategoryType => normalizeVehicleType(val));

export const BookingFormValidationSchema = z
  .object({
    vehicleType: VehicleTypeEnumSchema,
    selectedDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Por favor seleccioná una fecha válida (YYYY-MM-DD).'),
    selectedSlot: z.object(
      {
        startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Seleccioná un horario de inicio válido.'),
        endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Seleccioná un horario de finalización válido.'),
      },
      { message: 'Por favor seleccioná un horario disponible en el calendario.' }
    ),
    fullName: FullNameSchema,
    phone: PhoneSchema,
    email: OptionalEmailSchema,
    userEmail: OptionalEmailSchema,
    notes: NotesSchema,
    paymentMethod: z.enum(['MERCADO_PAGO', 'CASH']),
  })
  .transform((data) => {
    const resolvedEmail = data.email || data.userEmail || 'cliente@lavadero.com';
    return {
      ...data,
      email: resolvedEmail,
      userEmail: resolvedEmail,
      formattedPhone: formatWhatsAppArgPhone(data.phone),
    };
  });

export type BookingFormValues = z.infer<typeof BookingFormValidationSchema>;
