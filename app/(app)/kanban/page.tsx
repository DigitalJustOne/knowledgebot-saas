import { createAdminClient as createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { KanbanBoard } from './client-page';

export default async function KanbanPage() {
  const supabase = await createClient();
  const { getCurrentUser } = await import('@/lib/auth/actions');
  const profile = await getCurrentUser();

  if (!profile) redirect('/login');
  const orgId = profile.organization_id;

  // We fetch conversations joined with contacts.
  // We'll use the contact's metadata.stage to determine the Kanban column.
  const { data: list } = await (supabase as any)
    .from('conversations')
    .select('*, contacts(id, full_name, wa_phone, metadata)')
    .eq('organization_id', orgId)
    .order('last_message_at', { ascending: false });

  return (
    <div className="animate-fade-in h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Pipeline CRM</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(148, 163, 184, 0.7)' }}>
            Arrastra y suelta a tus clientes entre las diferentes etapas comerciales.
          </p>
        </div>
      </div>
      
      <KanbanBoard initialConversations={list || []} orgId={orgId} />
    </div>
  );
}
