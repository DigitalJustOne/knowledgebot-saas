'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChatCircleDots } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface ConversationItem {
  id: string;
  bot_active: boolean;
  last_message_at: string;
  contacts: {
    full_name: string | null;
    wa_phone: string;
  } | null;
}

export function ConversationList({ list }: { list: ConversationItem[] }) {
  const pathname = usePathname();
  const [conversations, setConversations] = useState(list);
  const supabase = createClient();

  // Sync when parent prop changes (navigation between chats)
  useEffect(() => {
    setConversations(list);
  }, [list]);

  // Real-time: auto-update sidebar when new messages arrive
  useEffect(() => {
    const channel = supabase
      .channel('sidebar_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const convId = payload.new.conversation_id;
          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.id === convId);
            if (idx === -1) return prev;
            const updated = { ...prev[idx], last_message_at: payload.new.created_at };
            const rest = prev.filter((c) => c.id !== convId);
            return [updated, ...rest]; // bubble to top
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations' },
        (payload) => {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === payload.new.id
                ? { ...c, bot_active: payload.new.bot_active, last_message_at: payload.new.last_message_at }
                : c
            )
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'contacts' },
        (payload) => {
          setConversations((prev) =>
            prev.map((c) =>
              c.contacts && (c.contacts as any).id === payload.new.id
                ? { ...c, contacts: { ...c.contacts, ...payload.new } }
                : c
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-white/5">
        <h2 className="text-sm font-semibold text-white">Chat Recientes</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {conversations.length > 0 ? (
          conversations.map((conv) => {
            const isActive = pathname.includes(conv.id);
            const contact = conv.contacts;
            const name = contact?.full_name || contact?.wa_phone || 'Desconocido';

            return (
              <Link
                key={conv.id}
                href={`/conversaciones/${conv.id}`}
                className={`
                  flex items-center justify-between p-3 rounded-xl transition-all text-decoration-none
                  ${isActive ? 'bg-primary-600/20 border border-primary-500/30' : 'hover:bg-white/5'}
                `}
                suppressHydrationWarning
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center shrink-0 font-bold text-slate-400" suppressHydrationWarning>
                    {Array.from(name)[0]?.toUpperCase()}
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-medium text-slate-200 truncate" suppressHydrationWarning>
                      {name}
                    </span>
                    <span className="text-[10px] text-slate-500" suppressHydrationWarning>
                      {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  {/* Status Badge */}
                  {conv.bot_active ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-0.5">
                      🤖 IA
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-0.5">
                      👤 Humano
                    </span>
                  )}
                  
                  {/* Kanban Stage Dot */}
                  {(() => {
                    const stage = (contact as any)?.metadata?.stage;
                    if (!stage || stage === 'inbox') return null;
                    
                    const colors: Record<string, string> = {
                      unhandled: 'bg-orange-500',
                      sales: 'bg-blue-500',
                      sold: 'bg-emerald-500',
                      angry: 'bg-rose-500',
                      ignore: 'bg-purple-500'
                    };
                    const color = colors[stage] || 'bg-slate-500';
                    return <div className={`w-2 h-2 rounded-full ${color}`} title={`Etapa: ${stage}`} />;
                  })()}
                </div>
              </Link>
            );
          })
        ) : (
          <div className="text-center py-8 text-slate-500 flex flex-col items-center">
            <ChatCircleDots size={32} className="opacity-20 mb-2" />
            <span className="text-xs">No hay conversaciones activas</span>
          </div>
        )}
      </div>
    </div>
  );
}
