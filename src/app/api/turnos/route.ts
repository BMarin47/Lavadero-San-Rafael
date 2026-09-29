import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { Pool } from 'pg';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autorizado. Debés iniciar sesión para ver tus turnos.' },
        { status: 401 }
      );
    }

    // 1. Intentar consultar desde Supabase Cloud
    const { data: turnosSupabase, error: dbError } = await supabase
      .from('turnos')
      .select('*')
      .order('fecha_creacion', { ascending: false });

    if (!dbError && turnosSupabase) {
      return NextResponse.json({ success: true, source: 'supabase', turnos: turnosSupabase });
    }

    // 2. Si la tabla no está en el schema cache de Supabase, consultar PostgreSQL
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://'))) {
      const pool = new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false },
      });
      const client = await pool.connect();
      try {
        const res = await client.query(
          'SELECT * FROM public.turnos WHERE user_id = $1 ORDER BY fecha_creacion DESC',
          [user.id]
        );
        return NextResponse.json({ success: true, source: 'postgresql', turnos: res.rows });
      } finally {
        client.release();
        await pool.end();
      }
    }

    return NextResponse.json({ success: true, turnos: [] });
  } catch (err: any) {
    console.error('[API Turnos GET Server Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autorizado. Iniciá sesión para registrar tu reserva.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      nombre_cliente,
      vehiculo,
      categoria,
      precio,
      indicaciones,
    } = body;

    if (!nombre_cliente || !vehiculo || !categoria || precio === undefined) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios para registrar el turno.' },
        { status: 400 }
      );
    }

    // 1. Intentar inserción en Supabase Cloud con RLS
    const { data: supabaseData, error: dbError } = await supabase
      .from('turnos')
      .insert({
        user_id: user.id,
        nombre_cliente: String(nombre_cliente).trim(),
        vehiculo: String(vehiculo).trim(),
        categoria: String(categoria).trim(),
        precio: Number(precio),
        indicaciones: indicaciones ? String(indicaciones).trim() : null,
        estado: 'pendiente',
      })
      .select()
      .single();

    if (!dbError && supabaseData) {
      return NextResponse.json({
        success: true,
        source: 'supabase',
        message: 'Turno registrado correctamente en Supabase.',
        turno: supabaseData,
      });
    }

    console.warn(
      '[API Turnos]: Supabase no tiene la tabla en schema cache. Guardando en base de datos PostgreSQL...',
      dbError?.message
    );

    // 2. Si la tabla aún no fue creada en Supabase Cloud, guardamos en la base de datos PostgreSQL remota (DATABASE_URL)
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://'))) {
      const pool = new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false },
      });
      const client = await pool.connect();
      try {
        // Asegurar que la tabla exista en la base PostgreSQL
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

        const insertRes = await client.query(
          `INSERT INTO public.turnos (user_id, nombre_cliente, vehiculo, categoria, precio, indicaciones, estado)
           VALUES ($1, $2, $3, $4, $5, $6, 'pendiente')
           RETURNING *`,
          [
            user.id,
            String(nombre_cliente).trim(),
            String(vehiculo).trim(),
            String(categoria).trim(),
            Number(precio),
            indicaciones ? String(indicaciones).trim() : null,
          ]
        );

        return NextResponse.json({
          success: true,
          source: 'postgresql',
          message: 'Turno registrado correctamente en la base de datos PostgreSQL.',
          turno: insertRes.rows[0],
        });
      } finally {
        client.release();
        await pool.end();
      }
    }

    return NextResponse.json(
      { error: dbError?.message || 'Error al guardar el turno en la base de datos.' },
      { status: 500 }
    );
  } catch (err: any) {
    console.error('[API Turnos POST Server Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}
