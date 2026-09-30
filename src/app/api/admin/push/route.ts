import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@/utils/supabase/server';
import { isSuperAdmin } from '@/lib/auth/admin';
import { Pool } from 'pg';

const vapidPublicKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim();
const vapidPrivateKey = (process.env.VAPID_PRIVATE_KEY || '').trim();
const vapidSubject = (
  process.env.VAPID_SUBJECT || 'mailto:bruno.marin.soporte@gmail.com'
).trim();

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  } catch (err) {
    console.error('[Admin Push VAPID Setup Warning]:', err);
  }
}

/**
 * GET /api/admin/push
 * Obtiene el conteo y estado de dispositivos suscritos a Web Push.
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

    let subscriptionsCount = 0;
    let subscriptionsList: any[] = [];

    // 1. Consultar en Supabase
    try {
      const { data, error, count } = await supabase
        .from('push_subscriptions')
        .select('*', { count: 'exact' });

      if (!error && data) {
        subscriptionsCount = count ?? data.length;
        subscriptionsList = data;
      }
    } catch (sbErr) {
      console.warn('[Admin Push GET Supabase Warning]:', sbErr);
    }

    // 2. Fallback PostgreSQL
    const dbUrl = process.env.DATABASE_URL;
    if (subscriptionsCount === 0 && dbUrl && (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://'))) {
      try {
        const pool = new Pool({
          connectionString: dbUrl,
          ssl: { rejectUnauthorized: false },
        });
        const client = await pool.connect();
        try {
          const res = await client.query('SELECT * FROM public.push_subscriptions');
          subscriptionsCount = res.rowCount ?? res.rows.length;
          subscriptionsList = res.rows;
        } finally {
          client.release();
          await pool.end();
        }
      } catch (pgErr) {
        console.warn('[Admin Push GET PG Warning]:', pgErr);
      }
    }

    return NextResponse.json({
      success: true,
      count: subscriptionsCount,
      vapidConfigured: !!(vapidPublicKey && vapidPrivateKey),
      subscriptions: subscriptionsList.map((s) => ({
        id: s.id,
        user_id: s.user_id,
        user_agent: s.user_agent,
        fecha_actualizacion: s.fecha_actualizacion || s.created_at,
      })),
    });
  } catch (error: any) {
    console.error('[Admin Push GET Server Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al consultar suscripciones push.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/push
 * Envía notificación push personalizada a los dispositivos registrados.
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

    if (!vapidPublicKey || !vapidPrivateKey) {
      return NextResponse.json(
        {
          error:
            'Las claves VAPID no están configuradas en las variables de entorno de Vercel.',
        },
        { status: 500 }
      );
    }

    try {
      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    } catch (_) {}

    const body = await request.json().catch(() => ({}));
    const { title, message, url, icon } = body;

    if (!title || !message) {
      return NextResponse.json(
        { error: 'El título y el mensaje son obligatorios para la notificación.' },
        { status: 400 }
      );
    }

    // 1. Obtener todas las suscripciones registradas
    let subscriptions: any[] = [];
    try {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('*');

      if (!error && Array.isArray(data)) {
        subscriptions = data;
      }
    } catch (sbErr) {
      console.warn('[Admin Push POST Supabase Warning]:', sbErr);
    }

    // 2. Fallback PostgreSQL si Supabase no trajo suscripciones
    const dbUrl = process.env.DATABASE_URL;
    if (subscriptions.length === 0 && dbUrl && (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://'))) {
      try {
        const pool = new Pool({
          connectionString: dbUrl,
          ssl: { rejectUnauthorized: false },
        });
        const client = await pool.connect();
        try {
          const res = await client.query('SELECT * FROM public.push_subscriptions');
          subscriptions = res.rows;
        } finally {
          client.release();
          await pool.end();
        }
      } catch (pgErr) {
        console.warn('[Admin Push POST PG Warning]:', pgErr);
      }
    }

    if (subscriptions.length === 0) {
      return NextResponse.json({
        success: false,
        sentCount: 0,
        failedCount: 0,
        message:
          'No se encontraron dispositivos registrados en la tabla push_subscriptions para enviar la notificación.',
      });
    }

    // 3. Preparar payload WebPush
    const payload = JSON.stringify({
      title: title.trim(),
      body: message.trim(),
      url: (url || '/dashboard').trim(),
      icon: icon || '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      timestamp: Date.now(),
    });

    let sentCount = 0;
    let failedCount = 0;
    const expiredEndpoints: string[] = [];

    // 4. Enviar a cada dispositivo registrado
    for (const sub of subscriptions) {
      if (!sub.endpoint || !sub.p256dh || !sub.auth) {
        failedCount++;
        continue;
      }

      const webPushSub = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(webPushSub, payload);
        sentCount++;
      } catch (pushErr: any) {
        failedCount++;
        console.warn(`[Push Error endpoint]: ${sub.endpoint.slice(0, 30)}... status: ${pushErr.statusCode}`);
        // Si el navegador revocó el permiso (404 o 410 Gone), marcar para limpieza
        if (pushErr.statusCode === 404 || pushErr.statusCode === 410) {
          expiredEndpoints.push(sub.endpoint);
        }
      }
    }

    // 5. Limpieza automática de suscripciones expiradas en background
    if (expiredEndpoints.length > 0) {
      try {
        await supabase
          .from('push_subscriptions')
          .delete()
          .in('endpoint', expiredEndpoints);
      } catch (_) {}
    }

    return NextResponse.json({
      success: true,
      message: `Campaña Push enviada: ${sentCount} exitosa${sentCount === 1 ? '' : 's'}, ${failedCount} fallida${failedCount === 1 ? '' : 's'}.`,
      sentCount,
      failedCount,
      totalTargets: subscriptions.length,
      cleanedExpired: expiredEndpoints.length,
    });
  } catch (error: any) {
    console.error('[Admin Push POST Server Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al procesar el envío de notificaciones push.' },
      { status: 500 }
    );
  }
}
