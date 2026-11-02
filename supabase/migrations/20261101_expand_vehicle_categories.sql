-- =========================================================================
-- Migración: Expandir categorías de vehículos para soportar vehículos grandes
-- ("Camioneta Grande" / LARGE_PICKUP y "Trafic / Utilitario" / UTILITY)
-- Proyecto: Lavadero San Rafael (AquaShine)
-- =========================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_type_enum') THEN
    CREATE TYPE public.vehicle_type_enum AS ENUM (
      'CAR',
      'SUV',
      'PICKUP',
      'LARGE_PICKUP',
      'UTILITY'
    );
  ELSE
    BEGIN
      ALTER TYPE public.vehicle_type_enum ADD VALUE IF NOT EXISTS 'LARGE_PICKUP';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE public.vehicle_type_enum ADD VALUE IF NOT EXISTS 'UTILITY';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END
$$;

-- Asegurar que las columnas de categoría/vehículo en bookings y turnos sean TEXT sin restricciones obsoletas
ALTER TABLE IF EXISTS public.bookings DROP CONSTRAINT IF EXISTS bookings_categoria_check;
ALTER TABLE IF EXISTS public.bookings DROP CONSTRAINT IF EXISTS bookings_vehicle_details_check;
ALTER TABLE IF EXISTS public.turnos DROP CONSTRAINT IF EXISTS turnos_categoria_check;
ALTER TABLE IF EXISTS public.turnos DROP CONSTRAINT IF EXISTS turnos_vehiculo_check;
