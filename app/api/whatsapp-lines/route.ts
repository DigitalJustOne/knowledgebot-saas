import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getBridgeUrl, bridgeHeaders } from '@/lib/whatsapp/bridge';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Authenticate user and get their org
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();
    if (!profile) return NextResponse.json({ error: 'No org' }, { status: 401 });

    const { data, error } = await (supabase as any)
      .from('whatsapp_lines')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { line_key, display_name } = body;

    if (!line_key) {
       return NextResponse.json({ error: 'Missing line_key' }, { status: 400 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await (supabase as any).from('profiles').select('organization_id').eq('id', user.id).single();
    if (!profile) return NextResponse.json({ error: 'No org' }, { status: 401 });

    // Upsert the line
    const { data: line, error } = await (supabase as any)
      .from('whatsapp_lines')
      .upsert({
        organization_id: profile.organization_id,
        line_key,
        display_name: display_name || line_key,
        status: 'awaiting_qr'
      }, { onConflict: 'line_key' })
      .select()
      .single();
      
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Call bridge to start session. URL + key come from env (WHATSAPP_BRIDGE_URL / BRIDGE_API_KEY)
    // so this works in Railway where each service has its own container.
    const baseUrl = getBridgeUrl();

    let bridgeError: string | null = null;
    try {
      const bridgeRes = await fetch(`${baseUrl}/api/sessions/${line_key}/start`, {
        method: 'POST',
        headers: bridgeHeaders(),
        signal: AbortSignal.timeout(8000), // 8 second timeout
      });
      if (!bridgeRes.ok) {
        const errText = await bridgeRes.text();
        bridgeError = `Bridge respondió ${bridgeRes.status}: ${errText}`;
        console.error('Bridge start error:', bridgeError);
      }
    } catch (e: any) {
      bridgeError = `No se pudo contactar el bridge en ${baseUrl}. Revisa WHATSAPP_BRIDGE_URL y que el servicio esté activo.`;
      console.error('Bridge start failed:', e.message);
    }

    return NextResponse.json({ ...line, bridgeError });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
