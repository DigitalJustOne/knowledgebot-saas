import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createMetaAdapter, createOpenWAAdapter } from '@/lib/whatsapp/adapter';
import { processInboundMessage } from '@/lib/whatsapp/webhook-processor';
import { runAgentForMessage } from '@/lib/agent';
import { decrypt } from '@/lib/crypto';
import { createHmac } from 'crypto';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET: Meta webhook verification
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token) {
    // Look up the org that has this verify_token
    const supabase = createAdminClient();
    const { data: waConfig } = await (supabase as any)
      .from('whatsapp_configs')
      .select('verify_token')
      .eq('verify_token', token)
      .single();

    if (waConfig) {
      logger.info('Webhook verified', { token });
      return new NextResponse(challenge, { status: 200 });
    }
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

/**
 * POST: Receive messages from Meta Cloud API or OpenWA
 */
export async function POST(request: NextRequest) {
  const body = await request.json() as Record<string, unknown>;
  const supabase = createAdminClient();

  // Detect provider
  const isOpenWA = !!(body.event && body.data);
  const isMeta = !!(body.object && body.entry);

  if (!isOpenWA && !isMeta) {
    return NextResponse.json({ status: 'ignored' }, { status: 200 });
  }

  // Respond 200 immediately, process async
  const response = NextResponse.json({ status: 'ok' }, { status: 200 });

  after(async () => {
    try {
      if (isMeta) {
        await processMetaWebhook(body, request, supabase);
      } else if (isOpenWA) {
        await processOpenWAWebhook(body, supabase);
      }
    } catch (err) {
      logger.error('Webhook after() error', { error: String(err) });
    }
  });

  return response;
}

async function processMetaWebhook(
  body: Record<string, unknown>,
  request: NextRequest,
  supabase: ReturnType<typeof createAdminClient>
) {
  // Extract WABA ID from webhook payload
  const entry = (body.entry as Array<Record<string, unknown>>)?.[0];
  const wabaId = entry?.id as string;
  if (!wabaId) return;

  // Find org by WABA ID
  const { data: waConfig } = await (supabase as any)
    .from('whatsapp_configs')
    .select('*')
    .eq('waba_id', wabaId)
    .eq('provider', 'meta')
    .single();

  if (!waConfig) {
    logger.warn('No config for WABA', { wabaId });
    return;
  }

  // Verify HMAC signature
  const signature = request.headers.get('x-hub-signature-256');
  if (signature && waConfig.app_secret_encrypted) {
    const appSecret = decrypt(waConfig.app_secret_encrypted);
    const rawBody = JSON.stringify(body);
    const expectedSig = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex');
    if (signature !== expectedSig) {
      logger.warn('Invalid HMAC signature', { wabaId });
      return;
    }
  }

  const adapter = createMetaAdapter(waConfig);
  const message = adapter.parseInboundMessage(body);
  if (!message) return;

  const lineKey = wabaId;

  await processInboundMessage(
    waConfig.organization_id,
    message,
    waConfig,
    lineKey,
    runAgentForMessage
  );
}

async function processOpenWAWebhook(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createAdminClient>
) {
  // OpenWA webhooks include session ID — find matching org
  const data = body.data as Record<string, unknown>;
  const sessionId = data?.sessionId as string || 'default';
  const lineKey = (body.line_key as string) || (data?.line_key as string) || sessionId;

  const { data: waConfig } = await (supabase as any)
    .from('whatsapp_configs')
    .select('*')
    .eq('openwa_session_id', sessionId)
    .eq('provider', 'openwa')
    .single();

  if (!waConfig) {
    // Try first openwa config
    const { data: fallbackConfig } = await (supabase as any)
      .from('whatsapp_configs')
      .select('*')
      .eq('provider', 'openwa')
      .limit(1)
      .single();

    if (!fallbackConfig) {
      logger.warn('No OpenWA config found', { sessionId });
      return;
    }

    const adapter = createOpenWAAdapter(fallbackConfig);
    const message = adapter.parseInboundMessage(body);
    if (!message) return;

    await processInboundMessage(
      fallbackConfig.organization_id,
      message,
      fallbackConfig,
      lineKey,
      runAgentForMessage
    );
    return;
  }

  const adapter = createOpenWAAdapter(waConfig);
  const message = adapter.parseInboundMessage(body);
  if (!message) return;

  await processInboundMessage(
    waConfig.organization_id,
    message,
    waConfig,
    lineKey,
    runAgentForMessage
  );
}
