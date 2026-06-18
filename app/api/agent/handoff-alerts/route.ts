import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth/actions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/handoff-alerts
 * Returns conversations where bot_active=false (require human attention).
 */
export async function GET() {
  try {
    const profile = await getCurrentUser();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const orgId = profile.organization_id;
    const supabase = createAdminClient();

    const { data: alerts, error } = await (supabase as any)
      .from('conversations')
      .select(`
        id,
        last_message_at,
        created_at,
        contacts (
          id,
          full_name,
          wa_phone
        ),
        messages (
          content,
          direction,
          created_at
        )
      `)
      .eq('organization_id', orgId)
      .eq('bot_active', false)
      .order('last_message_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get the last message for each conversation
    const formattedAlerts = (alerts || []).map((conv: any) => {
      const msgs = (conv.messages || []).sort(
        (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const lastMsg = msgs[0];
      return {
        conversationId: conv.id,
        contactName: conv.contacts?.full_name || null,
        contactPhone: conv.contacts?.wa_phone || '',
        lastMessageAt: conv.last_message_at,
        lastMessage: lastMsg?.content || '',
        lastMessageDirection: lastMsg?.direction || 'inbound',
      };
    });

    return NextResponse.json({ alerts: formattedAlerts, count: formattedAlerts.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
