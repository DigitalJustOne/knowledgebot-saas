import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // Call bridge to start session
    const { data: waConfig } = await (supabase as any)
      .from('whatsapp_configs')
      .select('openwa_api_url, openwa_api_key')
      .eq('organization_id', profile.organization_id)
      .single();

    // The bridge runs on port 3004 by default. The whatsapp_configs table may store
    // an old URL from the legacy single-session setup. Always use port 3004 for multi-line.
    const rawUrl = waConfig?.openwa_api_url || 'http://localhost:3004';
    // Normalize: if the stored URL points to the old port 2785, correct it to 3004
    const baseUrl = rawUrl.replace(':2785', ':3004').replace(':3003', ':3004');
    const apiKey = waConfig?.openwa_api_key || '';

    let bridgeError: string | null = null;
    try {
      const bridgeRes = await fetch(`${baseUrl}/api/sessions/${line_key}/start`, {
        method: 'POST',
        headers: apiKey ? { 'X-API-Key': apiKey, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(8000), // 8 second timeout
      });
      if (!bridgeRes.ok) {
        const errText = await bridgeRes.text();
        bridgeError = `Bridge respondió ${bridgeRes.status}: ${errText}`;
        console.error('Bridge start error:', bridgeError);
      }
    } catch (e: any) {
      bridgeError = `No se pudo contactar el bridge en ${baseUrl}. ¿Está corriendo "node server.js" en wa-server-knowledge?`;
      console.error('Bridge start failed:', e.message);
    }

    return NextResponse.json({ ...line, bridgeError });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
