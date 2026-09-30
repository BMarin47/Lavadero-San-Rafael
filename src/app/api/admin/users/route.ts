import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { isSuperAdmin, SUPERADMIN_EMAILS } from '@/lib/auth/admin';
import { Pool } from 'pg';

/**
 * Obtiene el cliente Supabase Admin si la Service Role Key está configurada.
 */
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (url && serviceKey) {
    return createSupabaseClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return null;
}

/**
 * GET /api/admin/users
 * Lista todos los usuarios registrados en la aplicación.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !isSuperAdmin(user.email)) {
      return NextResponse.json(
        { error: 'Acceso denegado. Se requieren permisos de Superadministrador.' },
        { status: 403 }
      );
    }

    const usersMap = new Map<string, {
      id: string;
      email: string;
      fullName: string;
      phone: string;
      role: 'ADMIN' | 'CUSTOMER';
      createdAt: string;
      turnosCount: number;
    }>();

    // 1. Intentar con Supabase Admin si la clave de servicio existe
    const supabaseAdmin = getSupabaseAdmin();
    if (supabaseAdmin) {
      try {
        const { data: authUsers, error } = await supabaseAdmin.auth.admin.listUsers();
        if (!error && authUsers?.users) {
          for (const u of authUsers.users) {
            const email = u.email || 'Sin email';
            usersMap.set(u.id, {
              id: u.id,
              email,
              fullName: u.user_metadata?.full_name || u.user_metadata?.name || email.split('@')[0],
              phone: u.user_metadata?.phone || u.phone || 'No registrada',
              role: isSuperAdmin(email) ? 'ADMIN' : 'CUSTOMER',
              createdAt: u.created_at,
              turnosCount: 0,
            });
          }
        }
      } catch (adminErr) {
        console.warn('[Admin listUsers Supabase Admin]:', adminErr);
      }
    }

    // 2. Consultar auth.users y public.bookings mediante PostgreSQL directo
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://'))) {
      try {
        const pool = new Pool({
          connectionString: dbUrl,
          ssl: { rejectUnauthorized: false },
        });
        const client = await pool.connect();
        try {
          // Consultar usuarios de auth.users si existe
          try {
            const authRes = await client.query(
              `SELECT id, email, raw_user_meta_data, created_at, phone FROM auth.users ORDER BY created_at DESC`
            );
            for (const r of authRes.rows) {
              const meta = r.raw_user_meta_data || {};
              const email = r.email || '';
              if (email) {
                usersMap.set(r.id, {
                  id: r.id,
                  email,
                  fullName: meta.full_name || meta.name || email.split('@')[0],
                  phone: meta.phone || r.phone || 'No registrada',
                  role: isSuperAdmin(email) ? 'ADMIN' : 'CUSTOMER',
                  createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
                  turnosCount: 0,
                });
              }
            }
          } catch (_) {}

          // Consultar usuarios de Prisma User si existe
          try {
            const prismaRes = await client.query(
              `SELECT id, email, "fullName", phone, role, "createdAt" FROM public."User" ORDER BY "createdAt" DESC`
            );
            for (const r of prismaRes.rows) {
              const email = r.email || '';
              if (email && !usersMap.has(r.id)) {
                usersMap.set(r.id, {
                  id: r.id,
                  email,
                  fullName: r.fullName || email.split('@')[0],
                  phone: r.phone || 'No registrada',
                  role: isSuperAdmin(email) || r.role === 'ADMIN' ? 'ADMIN' : 'CUSTOMER',
                  createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
                  turnosCount: 0,
                });
              }
            }
          } catch (_) {}

          // Conteo de turnos por user_id
          try {
            const countRes = await client.query(
              `SELECT user_id, COUNT(*) as total FROM public.bookings GROUP BY user_id`
            );
            for (const c of countRes.rows) {
              const existing = usersMap.get(c.user_id);
              if (existing) {
                existing.turnosCount = Number(c.total);
              }
            }
          } catch (_) {}
        } finally {
          client.release();
          await pool.end();
        }
      } catch (pgErr) {
        console.warn('[Admin Users GET PG]:', pgErr);
      }
    }

    // 3. Fallback: Extraer clientes con turnos registrados en Supabase bookings
    try {
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('user_id, client_name, client_email, client_phone, created_at');

      if (Array.isArray(bookingsData)) {
        for (const b of bookingsData) {
          if (b.user_id && !usersMap.has(b.user_id)) {
            const email = b.client_email || 'cliente@lavadero.com';
            usersMap.set(b.user_id, {
              id: b.user_id,
              email,
              fullName: b.client_name || email.split('@')[0],
              phone: b.client_phone || 'No registrada',
              role: isSuperAdmin(email) ? 'ADMIN' : 'CUSTOMER',
              createdAt: b.created_at || new Date().toISOString(),
              turnosCount: 1,
            });
          } else if (b.user_id && usersMap.has(b.user_id)) {
            const entry = usersMap.get(b.user_id)!;
            entry.turnosCount = (entry.turnosCount || 0) + 1;
            if (b.client_name && entry.fullName === entry.email.split('@')[0]) {
              entry.fullName = b.client_name;
            }
            if (b.client_phone && entry.phone === 'No registrada') {
              entry.phone = b.client_phone;
            }
          }
        }
      }
    } catch (_) {}

    // Asegurar que el Superadministrador esté siempre en la lista
    if (!Array.from(usersMap.values()).some((u) => isSuperAdmin(u.email))) {
      usersMap.set(user.id, {
        id: user.id,
        email: user.email || 'bruno.marin.soporte@gmail.com',
        fullName: user.user_metadata?.full_name || 'Bruno Marín (Superadmin)',
        phone: user.user_metadata?.phone || '+54 9 260 465-4255',
        role: 'ADMIN',
        createdAt: user.created_at || new Date().toISOString(),
        turnosCount: 0,
      });
    }

    const usersList = Array.from(usersMap.values()).sort((a, b) => {
      if (a.role === 'ADMIN') return -1;
      if (b.role === 'ADMIN') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({
      success: true,
      users: usersList,
      total: usersList.length,
    });
  } catch (error: any) {
    console.error('[Admin Users GET Server Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener el listado de usuarios.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/users
 * Crea un nuevo usuario manualmente desde el panel de administración.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !isSuperAdmin(user.email)) {
      return NextResponse.json(
        { error: 'Acceso denegado. Se requieren permisos de Superadministrador.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { email, password, fullName, phone, role } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Por favor proporcioná un correo electrónico válido.' },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres.' },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const assignedRole = role === 'ADMIN' ? 'ADMIN' : 'CUSTOMER';
    let createdUser: any = null;

    // 1. Intentar creación vía Supabase Admin SDK
    const supabaseAdmin = getSupabaseAdmin();
    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: normalizedEmail,
          password: String(password),
          email_confirm: true,
          user_metadata: {
            full_name: fullName || normalizedEmail.split('@')[0],
            phone: phone || '',
            role: assignedRole,
          },
        });

        if (!error && data?.user) {
          createdUser = data.user;
        } else if (error) {
          console.warn('[Supabase Admin createUser error]:', error.message);
        }
      } catch (err) {
        console.warn('[Supabase Admin createUser exception]:', err);
      }
    }

    // 2. Si no se pudo por Admin SDK, intentar con Supabase Auth signUp estándar
    if (!createdUser) {
      try {
        const anonClient = createSupabaseClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data: signUpData, error: signUpErr } = await anonClient.auth.signUp({
          email: normalizedEmail,
          password: String(password),
          options: {
            data: {
              full_name: fullName || normalizedEmail.split('@')[0],
              phone: phone || '',
              role: assignedRole,
            },
          },
        });

        if (!signUpErr && signUpData?.user) {
          createdUser = signUpData.user;
        } else if (signUpErr) {
          throw new Error(signUpErr.message);
        }
      } catch (stdErr: any) {
        throw new Error(stdErr.message || 'No se pudo crear el usuario en Supabase.');
      }
    }

    // 3. Replicar en PostgreSQL / Prisma si DATABASE_URL existe
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://'))) {
      try {
        const pool = new Pool({
          connectionString: dbUrl,
          ssl: { rejectUnauthorized: false },
        });
        const client = await pool.connect();
        try {
          const userId = createdUser?.id || crypto.randomUUID();
          await client.query(
            `INSERT INTO public."User" (id, email, "fullName", phone, role, "updatedAt")
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (email) DO UPDATE
             SET "fullName" = EXCLUDED."fullName", phone = EXCLUDED.phone, role = EXCLUDED.role, "updatedAt" = NOW()`,
            [
              userId,
              normalizedEmail,
              fullName || normalizedEmail.split('@')[0],
              phone || '',
              assignedRole,
            ]
          );
        } finally {
          client.release();
          await pool.end();
        }
      } catch (_) {}
    }

    return NextResponse.json({
      success: true,
      message: `Usuario "${normalizedEmail}" creado exitosamente.`,
      user: {
        id: createdUser?.id,
        email: normalizedEmail,
        fullName: fullName || normalizedEmail.split('@')[0],
        phone: phone || '',
        role: assignedRole,
      },
    });
  } catch (error: any) {
    console.error('[Admin Users POST Server Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al crear el nuevo usuario.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users
 * Elimina un usuario de la aplicación.
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !isSuperAdmin(user.email)) {
      return NextResponse.json(
        { error: 'Acceso denegado. Se requieren permisos de Superadministrador.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const targetId = searchParams.get('id');
    const targetEmail = searchParams.get('email');

    if (!targetId && !targetEmail) {
      return NextResponse.json(
        { error: 'Se requiere el ID o email del usuario a eliminar.' },
        { status: 400 }
      );
    }

    // FRENO DE SEGURIDAD ESTRICTO: Nunca permitir eliminar la cuenta del Superadministrador
    if (
      (targetEmail && isSuperAdmin(targetEmail)) ||
      (targetId && targetId === user.id)
    ) {
      return NextResponse.json(
        { error: 'No está permitido eliminar la cuenta principal del Superadministrador.' },
        { status: 400 }
      );
    }

    // 1. Eliminar con Supabase Admin SDK si existe
    const supabaseAdmin = getSupabaseAdmin();
    if (supabaseAdmin && targetId) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(targetId);
      } catch (delErr) {
        console.warn('[Supabase Admin deleteUser Warning]:', delErr);
      }
    }

    // 2. Eliminar en cascada en PostgreSQL
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://'))) {
      try {
        const pool = new Pool({
          connectionString: dbUrl,
          ssl: { rejectUnauthorized: false },
        });
        const client = await pool.connect();
        try {
          if (targetId) {
            await client.query('DELETE FROM public.bookings WHERE user_id::text = $1', [targetId]);
            await client.query('DELETE FROM public.turnos WHERE user_id::text = $1', [targetId]);
            await client.query('DELETE FROM public.push_subscriptions WHERE user_id::text = $1', [targetId]);
            await client.query('DELETE FROM public."User" WHERE id = $1', [targetId]);
            try {
              await client.query('DELETE FROM auth.users WHERE id::text = $1', [targetId]);
            } catch (_) {}
          } else if (targetEmail) {
            await client.query('DELETE FROM public."User" WHERE email = $1', [targetEmail]);
            try {
              await client.query('DELETE FROM auth.users WHERE email = $1', [targetEmail]);
            } catch (_) {}
          }
        } finally {
          client.release();
          await pool.end();
        }
      } catch (pgErr) {
        console.warn('[Admin DELETE user PG]:', pgErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Usuario eliminado exitosamente del sistema.',
      deletedId: targetId,
    });
  } catch (error: any) {
    console.error('[Admin Users DELETE Server Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al eliminar el usuario.' },
      { status: 500 }
    );
  }
}
