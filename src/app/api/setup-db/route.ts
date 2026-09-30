import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl || (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://'))) {
    return NextResponse.json({
      status: 'skipped',
      message: 'DATABASE_URL no está configurada o no tiene protocolo PostgreSQL.',
    });
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const client = await pool.connect();
    try {
      // Verificar si existe el esquema 'auth' (propio de Supabase)
      const schemaCheck = await client.query(
        "SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth'"
      );
      const hasAuthSchema = (schemaCheck.rowCount ?? 0) > 0;

      if (hasAuthSchema) {
        await client.query(`
          -- 1. Tabla bookings (Turnos / Reservas)
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
              client_name TEXT,
              client_email TEXT,
              client_phone TEXT,
              price NUMERIC NOT NULL DEFAULT 0,
              notes TEXT,
              nombre_cliente TEXT,
              vehiculo TEXT,
              categoria TEXT,
              precio NUMERIC,
              indicaciones TEXT,
              estado TEXT DEFAULT 'pendiente',
              fecha_creacion TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
          );

          ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'Los usuarios pueden ver sus propios bookings'
            ) THEN
              CREATE POLICY "Los usuarios pueden ver sus propios bookings" ON public.bookings
              FOR SELECT TO authenticated USING (auth.uid() = user_id);
            END IF;

            IF NOT EXISTS (
              SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'Los usuarios pueden crear sus propios bookings'
            ) THEN
              CREATE POLICY "Los usuarios pueden crear sus propios bookings" ON public.bookings
              FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
            END IF;

            IF NOT EXISTS (
              SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'Los usuarios pueden actualizar sus propios bookings'
            ) THEN
              CREATE POLICY "Los usuarios pueden actualizar sus propios bookings" ON public.bookings
              FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
            END IF;

            IF NOT EXISTS (
              SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'Los usuarios pueden eliminar sus propios bookings'
            ) THEN
              CREATE POLICY "Los usuarios pueden eliminar sus propios bookings" ON public.bookings
              FOR DELETE TO authenticated USING (auth.uid() = user_id);
            END IF;
          END
          $$;

          CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
          CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON public.bookings(created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_bookings_date ON public.bookings(date);

          -- 2. Tabla turnos (compatibilidad continua)
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

          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_policies WHERE tablename = 'turnos' AND policyname = 'Los usuarios pueden leer sus propios turnos'
            ) THEN
              CREATE POLICY "Los usuarios pueden leer sus propios turnos" ON public.turnos
              FOR SELECT TO authenticated USING (auth.uid() = user_id);
            END IF;

            IF NOT EXISTS (
              SELECT 1 FROM pg_policies WHERE tablename = 'turnos' AND policyname = 'Los usuarios pueden insertar sus propios turnos'
            ) THEN
              CREATE POLICY "Los usuarios pueden insertar sus propios turnos" ON public.turnos
              FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
            END IF;

            IF NOT EXISTS (
              SELECT 1 FROM pg_policies WHERE tablename = 'turnos' AND policyname = 'Los usuarios pueden actualizar sus propios turnos'
            ) THEN
              CREATE POLICY "Los usuarios pueden actualizar sus propios turnos" ON public.turnos
              FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
            END IF;
          END
          $$;
        `);
      } else {
        // En bases PostgreSQL estándar sin Supabase Auth
        await client.query(`
          -- 1. Tabla bookings
          CREATE TABLE IF NOT EXISTS public.bookings (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id TEXT NOT NULL,
              vehicle_details TEXT NOT NULL,
              service_type TEXT NOT NULL,
              date TEXT NOT NULL,
              time TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'pendiente',
              created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
              client_name TEXT,
              client_email TEXT,
              client_phone TEXT,
              price NUMERIC NOT NULL DEFAULT 0,
              notes TEXT,
              nombre_cliente TEXT,
              vehiculo TEXT,
              categoria TEXT,
              precio NUMERIC,
              indicaciones TEXT,
              estado TEXT DEFAULT 'pendiente',
              fecha_creacion TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
          );

          CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
          CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON public.bookings(created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_bookings_date ON public.bookings(date);

          -- 2. Tabla turnos
          CREATE TABLE IF NOT EXISTS public.turnos (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id TEXT NOT NULL,
              nombre_cliente TEXT NOT NULL,
              vehiculo TEXT NOT NULL,
              categoria TEXT NOT NULL,
              precio NUMERIC NOT NULL,
              indicaciones TEXT,
              estado TEXT NOT NULL DEFAULT 'pendiente',
              fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
          );
        `);

        // Limpiar registros duplicados existentes si los hubiera
        try {
          await client.query(`
            DELETE FROM public.bookings a
            USING public.bookings b
            WHERE a.id > b.id
              AND a.user_id = b.user_id
              AND a.date = b.date
              AND a.time = b.time
              AND a.vehicle_details = b.vehicle_details;
          `);
        } catch (_) {}
      }

      return NextResponse.json({
        success: true,
        hasAuthSchema,
        message: 'Tablas bookings y turnos configuradas correctamente con RLS e índices.',
      });
    } finally {
      client.release();
      await pool.end();
    }
  } catch (err: any) {
    console.error('[DB Setup Migration Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Error al ejecutar la migración en PostgreSQL.' },
      { status: 500 }
    );
  }
}
