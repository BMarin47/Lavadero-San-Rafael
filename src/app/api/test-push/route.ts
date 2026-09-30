import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@/utils/supabase/server';
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
    console.error('[WebPush VAPID Setup Warning]:', err);
  }
}

async function processSendPush(request: Request, body?: any) {
  if (!vapidPublicKey || !vapidPrivateKey) {
    return NextResponse.json(
      {
        error:
          'Faltan configurar las variables NEXT_PUBLIC_VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY en Vercel/.env.',
      },
      { status: 500 }
    );
  }

  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  } catch (err) {
    console.error('[WebPush VAPID Init Error]:', err);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const clientSub = body?.subscription;

  // 1. Si el cliente envió su suscripción activa, sincronizarla/guardarla en Supabase
  if (clientSub?.endpoint && clientSub?.keys?.p256dh && clientSub?.keys?.auth) {
    try {
      await supabase.from('push_subscriptions').upsert(
        {
          endpoint: clientSub.endpoint,
          p256dh: clientSub.keys.p256dh,
          auth: clientSub.keys.auth,
          user_id: user?.id || null,
          user_agent: request.headers.get('user-agent') || 'Unknown',
          fecha_actualizacion: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      );
    } catch (upsertErr) {
      console.warn('[Supabase push_subscriptions upsert warning]:', upsertErr);
    }

    if (body?.silent) {
      return NextResponse.json({
        success: true,
        saved: true,
        message: 'Suscripción Web Push sincronizada correctamente en segundo plano.',
      });
    }
  }

  // 2. Buscar en Supabase la suscripción (PushSubscription) del usuario
  let pushSubRecord: { endpoint: string; p256dh: string; auth: string } | null = null;

  if (user?.id) {
    const { data: userSub, error: userSubErr } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('fecha_actualizacion', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!userSubErr && userSub) {
      pushSubRecord = userSub;
    }
  }

  // 3. Si no encontró por user_id, buscar por endpoint
  if (!pushSubRecord && clientSub?.endpoint) {
    const { data: endpointSub } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('endpoint', clientSub.endpoint)
      .maybeSingle();

    if (endpointSub) {
      pushSubRecord = endpointSub;
    }
  }

  // 4. Fallback con PostgreSQL directo si DATABASE_URL existe (supera RLS restrictivo)
  if (!pushSubRecord && process.env.DATABASE_URL) {
    try {
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      });
      const client = await pool.connect();
      try {
        if (user?.id) {
          const res = await client.query(
            'SELECT * FROM public.push_subscriptions WHERE user_id = $1 ORDER BY fecha_actualizacion DESC LIMIT 1',
            [user.id]
          );
          if (res.rows.length > 0) pushSubRecord = res.rows[0];
        }
        if (!pushSubRecord && clientSub?.endpoint) {
          const res = await client.query(
            'SELECT * FROM public.push_subscriptions WHERE endpoint = $1 LIMIT 1',
            [clientSub.endpoint]
          );
          if (res.rows.length > 0) pushSubRecord = res.rows[0];
        }
        if (!pushSubRecord) {
          const res = await client.query(
            'SELECT * FROM public.push_subscriptions ORDER BY fecha_creacion DESC LIMIT 1'
          );
          if (res.rows.length > 0) pushSubRecord = res.rows[0];
        }
      } finally {
        client.release();
      }
    } catch (pgErr) {
      console.warn('[PostgreSQL fallback query error]:', pgErr);
    }
  }

  // 5. Fallback con la suscripción provista en el body de la petición
  if (!pushSubRecord && clientSub?.endpoint && clientSub?.keys?.p256dh && clientSub?.keys?.auth) {
    pushSubRecord = {
      endpoint: clientSub.endpoint,
      p256dh: clientSub.keys.p256dh,
      auth: clientSub.keys.auth,
    };
  }

  if (!pushSubRecord || !pushSubRecord.endpoint || !pushSubRecord.p256dh || !pushSubRecord.auth) {
    return NextResponse.json(
      {
        error:
          'No se encontró ninguna suscripción Push registrada en Supabase. Asegurate de habilitar el permiso de notificaciones en el navegador.',
      },
      { status: 404 }
    );
  }

  // 6. Enviar payload de prueba con webpush.sendNotification
  const payload = JSON.stringify({
    title: '¡Prueba Exitosa!',
    body: 'Las notificaciones del Lavadero funcionan a la perfección.',
    icon: '/icon.png',
    badge: '/icon.png',
    url: '/dashboard',
  });

  const webPushSubscription = {
    endpoint: pushSubRecord.endpoint,
    keys: {
      p256dh: pushSubRecord.p256dh,
      auth: pushSubRecord.auth,
    },
  };

  const pushResult = await webpush.sendNotification(webPushSubscription, payload);

  return NextResponse.json({
    success: true,
    message: 'Notificación enviada correctamente al dispositivo.',
    statusCode: pushResult.statusCode,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    return await processSendPush(request, body);
  } catch (error: any) {
    console.error('[API /api/test-push Error]:', error);

    if (error.statusCode === 404 || error.statusCode === 410) {
      return NextResponse.json(
        {
          error:
            'La suscripción Push ha expirado o fue dada de baja por el navegador.',
          statusCode: error.statusCode,
        },
        { status: 410 }
      );
    }

    return NextResponse.json(
      {
        error: error.message || 'Error interno al procesar el envío de push.',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    return await processSendPush(request);
  } catch (error: any) {
    console.error('[API /api/test-push GET Error]:', error);
    return NextResponse.json(
      {
        error: error.message || 'Error interno al procesar el envío de push.',
      },
      { status: 500 }
    );
  }
}
