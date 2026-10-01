import { NextRequest, NextResponse } from 'next/server';
import { ReminderService, getArgentinaNowInfo } from '@/lib/services/reminder.service';
import { createClient } from '@/utils/supabase/server';
import { isSuperAdmin } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Hasta 60 segundos de ejecución en Vercel Serverless

/**
 * Valida si la petición proviene de Vercel Cron, de un Superadministrador autenticado,
 * o si posee el token de seguridad CRON_SECRET.
 */
async function isAuthorizedCronRequest(request: NextRequest): Promise<{ authorized: boolean; reason?: string }> {
  // 1. Cabecera oficial de Vercel Cron
  const vercelCronHeader = request.headers.get('x-vercel-cron');
  if (vercelCronHeader === '1') {
    return { authorized: true, reason: 'vercel-cron-header' };
  }

  // 2. Token CRON_SECRET en cabecera Authorization (Bearer <TOKEN>)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { authorized: true, reason: 'cron-secret-header' };
  }

  // 3. Token CRON_SECRET en URL query param (?key=... o ?secret=...)
  const { searchParams } = new URL(request.url);
  const paramKey = searchParams.get('key') || searchParams.get('secret');
  if (cronSecret && paramKey === cronSecret) {
    return { authorized: true, reason: 'cron-secret-query' };
  }

  // 4. Superadministrador autenticado en sesión
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user && isSuperAdmin(user.email)) {
      return { authorized: true, reason: `superadmin:${user.email}` };
    }
  } catch (_) {}

  // 5. En caso de no tener CRON_SECRET configurado aún en Vercel, permitimos el cron para que no se bloquee
  if (!cronSecret && vercelCronHeader) {
    return { authorized: true, reason: 'vercel-unprotected-cron' };
  }

  return { authorized: false, reason: 'unauthorized' };
}

/**
 * GET /api/cron/reminders
 * Invocado automáticamente por Vercel Cron de forma periódica (cada 1 hora).
 */
export async function GET(request: NextRequest) {
  try {
    const authCheck = await isAuthorizedCronRequest(request);
    if (!authCheck.authorized) {
      console.warn('[Cron Reminders GET]: Intento de acceso no autorizado.');
      return NextResponse.json(
        {
          error: 'Acceso no autorizado al cron de recordatorios.',
          tip: 'Configurá CRON_SECRET o ejecutá como Superadministrador.',
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const minHours = searchParams.get('minHours') ? Number(searchParams.get('minHours')) : undefined;
    const maxHours = searchParams.get('maxHours') ? Number(searchParams.get('maxHours')) : undefined;
    const forceTurnoId = searchParams.get('forceTurnoId') || undefined;

    console.log(`[Cron Reminders GET]: Ejecutando recordatorios WhatsApp 24hs (Autorizado por: ${authCheck.reason})...`);
    const result = await ReminderService.process24hReminders({
      minHours,
      maxHours,
      forceTurnoId,
    });

    return NextResponse.json({
      message: 'Proceso de recordatorios automáticos por WhatsApp 24hs ejecutado correctamente.',
      authorizedVia: authCheck.reason,
      ...result,
    });
  } catch (error: any) {
    console.error('[API /api/cron/reminders GET Error]:', error);
    const now = getArgentinaNowInfo();
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error interno al procesar los recordatorios 24hs.',
        timeUtc: now.utcIso,
        timeArg: now.argentinaLocalStr,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/reminders
 * Permite disparo manual desde el panel de Superadministrador para pruebas inmediatas.
 */
export async function POST(request: NextRequest) {
  try {
    const authCheck = await isAuthorizedCronRequest(request);
    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: 'Acceso no autorizado al cron de recordatorios.' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const minHours = body.minHours !== undefined ? Number(body.minHours) : undefined;
    const maxHours = body.maxHours !== undefined ? Number(body.maxHours) : undefined;
    const forceTurnoId = body.forceTurnoId ? String(body.forceTurnoId).trim() : undefined;

    console.log(`[Cron Reminders POST]: Disparo manual WhatsApp (Autorizado por: ${authCheck.reason})...`);
    const result = await ReminderService.process24hReminders({
      minHours,
      maxHours,
      forceTurnoId,
    });

    return NextResponse.json({
      message: 'Proceso de recordatorios por WhatsApp 24hs ejecutado manualmente con éxito.',
      authorizedVia: authCheck.reason,
      ...result,
    });
  } catch (error: any) {
    console.error('[API /api/cron/reminders POST Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error interno al procesar los recordatorios.',
      },
      { status: 500 }
    );
  }
}
