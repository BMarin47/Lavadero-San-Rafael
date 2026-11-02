import { z } from 'zod';
import { normalizeVehicleType, VehicleCategoryType } from '@/lib/services/schedule.service';

export const VEHICLE_TYPE_VALUES = [
  'CAR',
  'SUV',
  'PICKUP',
  'LARGE_PICKUP',
  'UTILITY',
] as const;

export const VehicleTypeEnumSchema = z.enum(VEHICLE_TYPE_VALUES);

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

export const BookingFormValidationSchema = z.object({
  vehicleType: VehicleTypeEnumSchema,
  selectedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Por favor seleccioná una fecha válida (YYYY-MM-DD).'),
  selectedSlot: z.object(
    {
      startTime: z.string().min(4, 'Seleccioná un horario de inicio.'),
      endTime: z.string().min(4, 'Seleccioná un horario de finalización.'),
    },
    { message: 'Por favor seleccioná un horario disponible en el calendario.' }
  ),
  fullName: z.string().trim().min(2, 'Por favor ingresá tu nombre y apellido.'),
  phone: z
    .string()
    .trim()
    .refine((val) => val.replace(/\D/g, '').length >= 6, {
      message: 'Por favor ingresá un número de WhatsApp celular válido.',
    }),
  userEmail: z.string().email('Ingresá un correo electrónico válido.').optional().or(z.literal('')),
  notes: z.string().optional(),
  paymentMethod: z.enum(['MERCADO_PAGO', 'CASH']),
});

export type BookingFormValues = z.infer<typeof BookingFormValidationSchema>;
