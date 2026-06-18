import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from('whatsapp_lines')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
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

    const baseUrl = waConfig?.openwa_api_url || 'http://localhost:3004';
    const apiKey = waConfig?.openwa_api_key || '';

    try {
      await fetch(`${baseUrl}/api/sessions/${line_key}/start`, {
        method: 'POST',
        headers: apiKey ? { 'X-API-Key': apiKey } : {}
      });
    } catch (e) {
      console.error('Bridge start failed', e);
    }

    return NextResponse.json(line);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
