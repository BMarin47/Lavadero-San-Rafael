-- =========================================================================
-- Migración: Soporte de Recordatorios Push 24hs y Tabla push_subscriptions
-- Proyecto: Lavadero San Rafael (AquaShine)
-- =========================================================================

-- 1. Agregar columnas de control de recordatorio a la tabla bookings
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS reminder_24h_sent BOOLEAN DEFAULT false;

ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS reminder_24h_sent_at TIMESTAMPTZ;

-- 2. Agregar columnas de control de recordatorio a la tabla turnos (compatibilidad)
ALTER TABLE public.turnos 
ADD COLUMN IF NOT EXISTS reminder_24h_sent BOOLEAN DEFAULT false;

ALTER TABLE public.turnos 
ADD COLUMN IF NOT EXISTS reminder_24h_sent_at TIMESTAMPTZ;

-- 3. Crear tabla push_subscriptions si no existe
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT UNIQUE NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Habilitar Row Level Security (RLS) en push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de Seguridad RLS para push_subscriptions
DROP POLICY IF EXISTS "Permitir guardar suscripciones a usuarios autenticados" ON public.push_subscriptions;
CREATE POLICY "Permitir guardar suscripciones a usuarios autenticados"
ON public.push_subscriptions
FOR INSERT
TO authenticated, anon
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizar suscripciones existentes" ON public.push_subscriptions;
CREATE POLICY "Permitir actualizar suscripciones existentes"
ON public.push_subscriptions
FOR UPDATE
TO authenticated, anon
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Usuarios autenticados leen sus suscripciones" ON public.push_subscriptions;
CREATE POLICY "Usuarios autenticados leen sus suscripciones"
ON public.push_subscriptions
FOR SELECT
TO authenticated, anon
USING (true);

-- Política Superadmin para gestión total
DROP POLICY IF EXISTS "Superadmin control total de push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "Superadmin control total de push_subscriptions"
ON public.push_subscriptions
FOR ALL
TO authenticated
USING (
  (auth.jwt() ->> 'email') = 'bruno.marin.soporte@gmail.com'
)
WITH CHECK (
  (auth.jwt() ->> 'email') = 'bruno.marin.soporte@gmail.com'
);

-- 6. Índices para acelerar búsquedas
CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON public.push_subscriptions(endpoint);
CREATE INDEX IF NOT EXISTS idx_bookings_reminder_lookup ON public.bookings(date, reminder_24h_sent, status);

-- =========================================================================
-- Opcional: Configuración en Supabase pg_cron (si se usa pg_cron nativo)
-- =========================================================================
-- SELECT cron.schedule(
--   'recordatorio-push-24h-lavadero',
--   '0 * * * *',
--   $$
--   SELECT net.http_get(
--     url := 'https://lavadero-san-rafael.vercel.app/api/cron/reminders',
--     headers := jsonb_build_object('x-vercel-cron', '1')
--   );
--   $$
-- );
