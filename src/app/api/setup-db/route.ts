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
      }

      return NextResponse.json({
        success: true,
        hasAuthSchema,
        message: 'Tabla turnos configurada correctamente en la base de datos.',
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
