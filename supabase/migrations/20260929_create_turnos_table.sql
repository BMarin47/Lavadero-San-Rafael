-- ========================================================
-- Migración: Crear tabla Turnos con Row Level Security (RLS)
-- Proyecto: Lavadero San Rafael
-- ========================================================

-- 1. Crear tabla turnos si no existe
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

-- 2. Habilitar Row Level Security (RLS)
ALTER TABLE public.turnos ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Seguridad (RLS)
-- Lectura: los clientes solo pueden consultar sus propios turnos
DROP POLICY IF EXISTS "Los usuarios pueden leer sus propios turnos" ON public.turnos;
CREATE POLICY "Los usuarios pueden leer sus propios turnos"
ON public.turnos
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Inserción: los clientes solo pueden insertar turnos vinculados a su propia cuenta
DROP POLICY IF EXISTS "Los usuarios pueden insertar sus propios turnos" ON public.turnos;
CREATE POLICY "Los usuarios pueden insertar sus propios turnos"
ON public.turnos
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Actualización: los clientes solo pueden actualizar sus propios turnos
DROP POLICY IF EXISTS "Los usuarios pueden actualizar sus propios turnos" ON public.turnos;
CREATE POLICY "Los usuarios pueden actualizar sus propios turnos"
ON public.turnos
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Eliminación: los clientes solo pueden cancelar/eliminar sus propios turnos
DROP POLICY IF EXISTS "Los usuarios pueden eliminar sus propios turnos" ON public.turnos;
CREATE POLICY "Los usuarios pueden eliminar sus propios turnos"
ON public.turnos
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_turnos_user_id ON public.turnos(user_id);
CREATE INDEX IF NOT EXISTS idx_turnos_fecha_creacion ON public.turnos(fecha_creacion DESC);
