import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

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

    // Consulta protegida por RLS en Supabase (auth.uid() = user_id)
    const { data: turnos, error: dbError } = await supabase
      .from('turnos')
      .select('*')
      .order('fecha_creacion', { ascending: false });

    if (dbError) {
      console.error('[API Turnos GET Error]:', dbError);
      return NextResponse.json(
        { error: dbError.message || 'Error al consultar los turnos.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, turnos });
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

    // Inserción en la tabla 'turnos' con el ID de la sesión del usuario (RLS garantizado)
    const { data, error: dbError } = await supabase
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

    if (dbError) {
      console.error('[API Turnos POST Error]:', dbError);
      return NextResponse.json(
        { error: dbError.message || 'Error al guardar el turno en la base de datos.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Turno registrado correctamente en la base de datos.',
      turno: data,
    });
  } catch (err: any) {
    console.error('[API Turnos POST Server Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}
