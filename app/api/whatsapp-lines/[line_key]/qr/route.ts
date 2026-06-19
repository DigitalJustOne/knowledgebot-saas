import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/whatsapp-lines/[line_key]/qr
 * Proxy endpoint: pulls the current QR from the bridge and saves it to the DB.
 * Used as a fallback when the push callback from the bridge to Next.js fails.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ line_key: string }> }
) {
  try {
    const { line_key } = await params;

    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();
    if (!profile) return NextResponse.json({ error: 'No org' }, { status: 401 });

    // Get bridge URL
    const { data: waConfig } = await (supabase as any)
      .from('whatsapp_configs')
      .select('openwa_api_url, openwa_api_key')
      .eq('organization_id', profile.organization_id)
      .single();

    const rawUrl = waConfig?.openwa_api_url || 'http://localhost:3004';
    const baseUrl = rawUrl.replace(':2785', ':3004').replace(':3003', ':3004');
    const apiKey = waConfig?.openwa_api_key || '';

    // Pull QR from bridge
    const bridgeRes = await fetch(`${baseUrl}/api/sessions/${line_key}/qr`, {
      headers: apiKey ? { 'X-API-Key': apiKey } : {},
      signal: AbortSignal.timeout(5000),
    });

    if (!bridgeRes.ok) {
      return NextResponse.json({ error: `Bridge error: ${bridgeRes.status}` }, { status: 502 });
    }

    const bridgeData = await bridgeRes.json();

    // If QR was returned, save it to DB so the panel can show it
    if (bridgeData.qr) {
      const adminSupabase = createAdminClient();
      await (adminSupabase as any)
        .from('whatsapp_lines')
        .update({ status: 'awaiting_qr', qr_code: bridgeData.qr })
        .eq('line_key', line_key);
    }

    return NextResponse.json(bridgeData);
  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.code === 'ECONNREFUSED') {
      return NextResponse.json({
        error: 'No se pudo contactar el bridge. ¿Está corriendo "node server.js" en wa-server-knowledge?'
      }, { status: 502 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
