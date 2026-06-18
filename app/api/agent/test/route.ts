import { NextRequest, NextResponse } from 'next/server';
import { runAgentForMessage } from '@/lib/agent';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  const { message, conversationId, orgId } = await request.json() as {
    message: string;
    conversationId: string;
    orgId: string;
  };

  if (!message || !conversationId || !orgId) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Load custom agent configuration
  const { data: agentConfig } = await (supabase as any)
    .from('agent_configs')
    .select('*')
    .eq('organization_id', orgId)
    .single();

  if (!agentConfig) {
    return NextResponse.json({ error: 'Configuración no encontrada' }, { status: 404 });
  }

  // Inject inbound sandbox chat history
  const { data: newInbound } = await (supabase as any)
    .from('messages')
    .insert({
      conversation_id: conversationId,
      organization_id: orgId,
      direction: 'inbound',
      sender: 'contact',
      content: message,
    })
    .select()
    .single();

  // Run AI loop agent
  const responseText = await runAgentForMessage({
    orgId,
    contactPhone: '+10000000000', // Mock sandbox number
    contactName: 'Cliente Demo',
    conversationId,
    messageText: message,
    agentConfig,
  });

  if (responseText) {
    // Save bot response in database history
    await (supabase as any)
      .from('messages')
      .insert({
        conversation_id: conversationId,
        organization_id: orgId,
        direction: 'outbound',
        sender: 'bot',
        content: responseText,
      });
  }

  return NextResponse.json({ reply: responseText });
}
