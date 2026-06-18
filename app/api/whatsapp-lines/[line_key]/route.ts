import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ line_key: string }> }
) {
  try {
    const { line_key } = await params;
    if (!line_key) return NextResponse.json({ error: 'Missing line_key' }, { status: 400 });

    const supabase = await createClient();
    
    // Fetch line to verify org
    const { data: line, error: lineErr } = await (supabase as any)
      .from('whatsapp_lines')
      .select('organization_id')
      .eq('line_key', line_key)
      .single();

    if (lineErr || !line) {
      return NextResponse.json({ error: 'Line not found or unauthorized' }, { status: 404 });
    }

    // Update status in DB
    const adminSupabase = createAdminClient();
    await (adminSupabase as any)
      .from('whatsapp_lines')
      .update({ status: 'disconnected', qr_code: null })
      .eq('line_key', line_key);

    // Get config for openwa URL
    const { data: waConfig } = await (adminSupabase as any)
      .from('whatsapp_configs')
      .select('openwa_api_url, openwa_api_key')
      .eq('organization_id', line.organization_id)
      .single();

    const baseUrl = waConfig?.openwa_api_url || 'http://localhost:3004';
    const apiKey = waConfig?.openwa_api_key || '';

    // Send logout request to bridge
    try {
      await fetch(`${baseUrl}/api/sessions/${line_key}/logout`, {
        method: 'POST',
        headers: apiKey ? { 'X-API-Key': apiKey } : {}
      });
    } catch (e) {
       console.error('Bridge logout failed', e);
       // Ignore bridge error, we just updated the DB
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
