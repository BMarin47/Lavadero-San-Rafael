-- =========================================================================
-- Migración: Crear tabla Bookings (Turnos / Reservas) con Row Level Security (RLS)
-- Proyecto: Lavadero San Rafael (AquaShine)
-- =========================================================================

-- 1. Crear tabla bookings si no existe
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    vehicle_details TEXT NOT NULL,
    service_type TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendiente',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    -- Datos complementarios del cliente y reserva
    client_name TEXT,
    client_email TEXT,
    client_phone TEXT,
    price NUMERIC NOT NULL DEFAULT 0,
    notes TEXT,
    -- Campos compatibles con esquema en español
    nombre_cliente TEXT,
    vehiculo TEXT,
    categoria TEXT,
    precio NUMERIC,
    indicaciones TEXT,
    estado TEXT DEFAULT 'pendiente',
    fecha_creacion TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 2. Habilitar Row Level Security (RLS)
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Seguridad (RLS)
-- Lectura: Los usuarios autenticados pueden ver sus propios turnos
DROP POLICY IF EXISTS "Los usuarios pueden ver sus propios bookings" ON public.bookings;
CREATE POLICY "Los usuarios pueden ver sus propios bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Inserción: Los usuarios autenticados pueden crear sus propios turnos
DROP POLICY IF EXISTS "Los usuarios pueden crear sus propios bookings" ON public.bookings;
CREATE POLICY "Los usuarios pueden crear sus propios bookings"
ON public.bookings
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Actualización: Los usuarios autenticados pueden modificar sus propios turnos
DROP POLICY IF EXISTS "Los usuarios pueden actualizar sus propios bookings" ON public.bookings;
CREATE POLICY "Los usuarios pueden actualizar sus propios bookings"
ON public.bookings
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Eliminación: Los usuarios autenticados pueden cancelar o eliminar sus propios turnos
DROP POLICY IF EXISTS "Los usuarios pueden eliminar sus propios bookings" ON public.bookings;
CREATE POLICY "Los usuarios pueden eliminar sus propios bookings"
ON public.bookings
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 4. Índices para acelerar consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON public.bookings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON public.bookings(date);

-- =========================================================================
-- Asegurar también la tabla turnos para compatibilidad con código existente
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.turnos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre_cliente TEXT NOT NULL,
    vehiculo TEXT NOT NULL,
    categoria TEXT NOT NULL,
    precio NUMERIC NOT NULL,
    indicaciones TEXT,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.turnos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Los usuarios pueden leer sus propios turnos" ON public.turnos;
CREATE POLICY "Los usuarios pueden leer sus propios turnos"
ON public.turnos FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Los usuarios pueden insertar sus propios turnos" ON public.turnos;
CREATE POLICY "Los usuarios pueden insertar sus propios turnos"
ON public.turnos FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Los usuarios pueden actualizar sus propios turnos" ON public.turnos;
CREATE POLICY "Los usuarios pueden actualizar sus propios turnos"
ON public.turnos FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Los usuarios pueden eliminar sus propios turnos" ON public.turnos;
CREATE POLICY "Los usuarios pueden eliminar sus propios turnos"
ON public.turnos FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_turnos_user_id ON public.turnos(user_id);
CREATE INDEX IF NOT EXISTS idx_turnos_fecha_creacion ON public.turnos(fecha_creacion DESC);
