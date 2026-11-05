-- ============================================================================
-- BLINDAJE DE SEGURIDAD RLS (ROW LEVEL SECURITY) — LAVADERO SAN RAFAEL
-- Objetivo:
-- 1. Activar RLS en todas las tablas principales y auxiliares del esquema public.
-- 2. Permitir que usuarios públicos/anónimos (anon / authenticated) SOLO puedan
--    INSERTAR nuevos turnos/reservas.
-- 3. Bloquear cualquier SELECT masivo desde el frontend público.
-- 4. Restringir SELECT, UPDATE y DELETE exclusivamente al Administrador
--    autenticado (bruno.marin.soporte@gmail.com o rol 'ADMIN' en JWT).
--    Nota: El rol interno `service_role` de Supabase (usado en API Routes de
--    Next.js en el servidor) hace bypass de RLS por diseño para operaciones
--    internas del backend.
-- ============================================================================

-- ============================================================================
-- FUNCIÓN AUXILIAR: Verificar si el usuario autenticado es Administrador
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    auth.role() = 'authenticated'
    AND (
      lower( coalesce(auth.jwt() ->> 'email', '') ) = 'bruno.marin.soporte@gmail.com'
      OR coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'ADMIN'
      OR coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'ADMIN'
    )
  );
$$;

-- ============================================================================
-- PASO 1: ACTIVAR ROW LEVEL SECURITY (RLS) EN TODAS LAS TABLAS PRINCIPALES
-- ============================================================================

ALTER TABLE IF EXISTS public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Tablas adicionales del esquema Prisma (se activan de forma segura si existen)
ALTER TABLE IF EXISTS public."Appointment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."Vehicle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."UserSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."SubscriptionPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."SubscriptionUsage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."HolidayCache" ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PASO 2: LIMPIAR POLÍTICAS ANTERIORES EN TABLAS DE TURNOS Y SUSCRIPCIONES
-- ============================================================================

-- Limpieza en public.bookings
DROP POLICY IF EXISTS "Los usuarios pueden ver sus propios bookings" ON public.bookings;
DROP POLICY IF EXISTS "Los usuarios pueden crear sus propios bookings" ON public.bookings;
DROP POLICY IF EXISTS "Los usuarios pueden actualizar sus propios bookings" ON public.bookings;
DROP POLICY IF EXISTS "Los usuarios pueden eliminar sus propios bookings" ON public.bookings;
DROP POLICY IF EXISTS "Superadmin tiene acceso total a bookings" ON public.bookings;
DROP POLICY IF EXISTS "insert_bookings_public" ON public.bookings;
DROP POLICY IF EXISTS "admin_select_bookings" ON public.bookings;
DROP POLICY IF EXISTS "admin_update_bookings" ON public.bookings;
DROP POLICY IF EXISTS "admin_delete_bookings" ON public.bookings;

-- Limpieza en public.turnos
DROP POLICY IF EXISTS "Los usuarios pueden leer sus propios turnos" ON public.turnos;
DROP POLICY IF EXISTS "Los usuarios pueden insertar sus propios turnos" ON public.turnos;
DROP POLICY IF EXISTS "Los usuarios pueden actualizar sus propios turnos" ON public.turnos;
DROP POLICY IF EXISTS "Los usuarios pueden eliminar sus propios turnos" ON public.turnos;
DROP POLICY IF EXISTS "Superadmin tiene acceso total a turnos" ON public.turnos;
DROP POLICY IF EXISTS "insert_turnos_public" ON public.turnos;
DROP POLICY IF EXISTS "admin_select_turnos" ON public.turnos;
DROP POLICY IF EXISTS "admin_update_turnos" ON public.turnos;
DROP POLICY IF EXISTS "admin_delete_turnos" ON public.turnos;

-- Limpieza en public.push_subscriptions
DROP POLICY IF EXISTS "Acceso abierto para push_subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Permitir guardar suscripciones a usuarios autenticados" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Permitir actualizar suscripciones existentes" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Usuarios autenticados leen sus suscripciones" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Superadmin control total de push_subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "insert_push_subscriptions_public" ON public.push_subscriptions;
DROP POLICY IF EXISTS "admin_select_push_subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "admin_update_push_subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "admin_delete_push_subscriptions" ON public.push_subscriptions;

-- ============================================================================
-- PASO 3: POLÍTICAS ESTRICTAS PARA `public.bookings` (TABLA PRINCIPAL DE RESERVAS)
-- ============================================================================

-- 3.1 INSERT: Clientes anónimos o públicos SOLO pueden insertar un nuevo turno
CREATE POLICY "insert_bookings_public"
ON public.bookings
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 3.2 SELECT: SOLO el administrador autenticado puede leer los registros
CREATE POLICY "admin_select_bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING (public.is_admin());

-- 3.3 UPDATE: SOLO el administrador autenticado puede modificar registros
CREATE POLICY "admin_update_bookings"
ON public.bookings
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 3.4 DELETE: SOLO el administrador autenticado puede eliminar registros
CREATE POLICY "admin_delete_bookings"
ON public.bookings
FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================================================
-- PASO 4: POLÍTICAS ESTRICTAS PARA `public.turnos` (TABLA DE TURNOS)
-- ============================================================================

-- 4.1 INSERT: Clientes anónimos o públicos SOLO pueden insertar un nuevo turno
CREATE POLICY "insert_turnos_public"
ON public.turnos
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 4.2 SELECT: SOLO el administrador autenticado puede leer los registros
CREATE POLICY "admin_select_turnos"
ON public.turnos
FOR SELECT
TO authenticated
USING (public.is_admin());

-- 4.3 UPDATE: SOLO el administrador autenticado puede modificar registros
CREATE POLICY "admin_update_turnos"
ON public.turnos
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 4.4 DELETE: SOLO el administrador autenticado puede eliminar registros
CREATE POLICY "admin_delete_turnos"
ON public.turnos
FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================================================
-- PASO 5: POLÍTICAS ESTRICTAS PARA `public.push_subscriptions`
-- ============================================================================

-- 5.1 INSERT: Clientes solo pueden registrar su suscripción push
CREATE POLICY "insert_push_subscriptions_public"
ON public.push_subscriptions
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 5.2 SELECT / UPDATE / DELETE: Exclusivo para el administrador autenticado
CREATE POLICY "admin_select_push_subscriptions"
ON public.push_subscriptions
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "admin_update_push_subscriptions"
ON public.push_subscriptions
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "admin_delete_push_subscriptions"
ON public.push_subscriptions
FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================================================
-- PASO 6: POLÍTICAS ESTRICTAS PARA TABLAS PRISMA (SI EXISTEN EN EL ESQUEMA)
-- ============================================================================
DO $$
BEGIN
  -- Tabla "Appointment" (Turnos Prisma)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'Appointment') THEN
    EXECUTE 'DROP POLICY IF EXISTS "insert_appointment_public" ON public."Appointment"';
    EXECUTE 'DROP POLICY IF EXISTS "admin_all_appointment" ON public."Appointment"';

    EXECUTE 'CREATE POLICY "insert_appointment_public" ON public."Appointment" FOR INSERT TO anon, authenticated WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "admin_all_appointment" ON public."Appointment" FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;

  -- Tabla "User" (Clientes Prisma - Bloqueo total de lectura pública, solo Admin)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'User') THEN
    EXECUTE 'DROP POLICY IF EXISTS "admin_all_user" ON public."User"';
    EXECUTE 'CREATE POLICY "admin_all_user" ON public."User" FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;

  -- Tabla "Vehicle" (Vehículos Prisma - Solo Admin)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'Vehicle') THEN
    EXECUTE 'DROP POLICY IF EXISTS "admin_all_vehicle" ON public."Vehicle"';
    EXECUTE 'CREATE POLICY "admin_all_vehicle" ON public."Vehicle" FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;

  -- Tabla "Payment" (Pagos Prisma - Solo Admin)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'Payment') THEN
    EXECUTE 'DROP POLICY IF EXISTS "admin_all_payment" ON public."Payment"';
    EXECUTE 'CREATE POLICY "admin_all_payment" ON public."Payment" FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;

  -- Tabla "UserSubscription" (Suscripciones Prisma - Solo Admin)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'UserSubscription') THEN
    EXECUTE 'DROP POLICY IF EXISTS "admin_all_usersubscription" ON public."UserSubscription"';
    EXECUTE 'CREATE POLICY "admin_all_usersubscription" ON public."UserSubscription" FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
END
$$;
