import webpush from 'npm:web-push@3.6.7';

const corsHeaders = { 'Content-Type': 'application/json' };
const projectUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || (() => {
  try { return JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default || ''; }
  catch { return ''; }
})();
const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')!;
const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')!;
const webhookSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')!;

webpush.setVapidDetails('mailto:notifications@dropfly-wholesale.app', vapidPublic, vapidPrivate);

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    if (!webhookSecret || !serviceKey || request.headers.get('x-push-secret') !== webhookSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const event = await request.json();
    const notification = event?.record;
    if (event?.table !== 'wholesale_notifications' || event?.type !== 'INSERT' || !notification?.id) {
      return Response.json({ ignored: true }, { headers: corsHeaders });
    }

    // Dashboard events are delivered only to admin subscriptions; merchant events
    // are delivered only to the account named by recipient_id.
    const query = notification.recipient_role === 'admin'
      ? 'recipient_role=eq.admin'
      : notification.recipient_id
        ? `user_id=eq.${encodeURIComponent(notification.recipient_id)}&recipient_role=eq.merchant`
        : null;
    if (!query) return Response.json({ delivered: 0 }, { headers: corsHeaders });

    const response = await fetch(`${projectUrl}/rest/v1/wholesale_push_subscriptions?select=id,endpoint,p256dh,auth&${query}`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!response.ok) throw new Error(`Subscription lookup failed (${response.status})`);
    const subscriptions = await response.json();
    const payload = JSON.stringify({
      title: String(notification.title || 'إشعار جديد').slice(0, 120),
      body: String(notification.body || notification.message || 'لديك تحديث جديد').slice(0, 500),
      tag: `${notification.kind || 'notice'}-${notification.entity_id || notification.id}`,
      entity_id: notification.entity_id || notification.id,
      url: 'https://hsabbesnes-gif.github.io/dropfly-wholesale/',
    });

    let delivered = 0;
    await Promise.all(subscriptions.map(async (subscription: { id: string; endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload, { TTL: 86400, urgency: 'high' });
        delivered++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await fetch(`${projectUrl}/rest/v1/wholesale_push_subscriptions?id=eq.${encodeURIComponent(subscription.id)}`, {
            method: 'DELETE', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
          });
        } else console.error('Push delivery failed', status || 'unknown');
      }
    }));
    return Response.json({ delivered }, { headers: corsHeaders });
  } catch (error) {
    console.error('Push notification handler failed', error);
    return Response.json({ error: 'Notification delivery failed' }, { status: 500, headers: corsHeaders });
  }
});
