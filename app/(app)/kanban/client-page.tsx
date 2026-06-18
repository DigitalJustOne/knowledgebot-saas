'use client';

import { useState, useEffect } from 'react';
import { updateContactStageAction } from '@/lib/conversations/actions';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ChatCircleDots, Robot, User, Clock, Question, Info, X, Funnel } from '@phosphor-icons/react';

const LINE_COLORS = [
  'bg-pink-500', 'bg-violet-500', 'bg-indigo-500', 
  'bg-cyan-500', 'bg-teal-500', 'bg-lime-500', 
  'bg-yellow-500', 'bg-orange-500'
];

interface WhatsAppLine {
  line_key: string;
  display_name: string;
}

const STAGES = [
  { 
    id: 'inbox', 
    label: 'Entrada', 
    color: 'bg-indigo-500', 
    border: 'border-indigo-500/30', 
    bg: 'bg-indigo-950/20', 
    desc: 'Clientes nuevos. La IA les da la bienvenida, responde dudas y realiza cotizaciones autónomamente.' 
  },
  { 
    id: 'unhandled', 
    label: 'Sin Atender', 
    color: 'bg-orange-500', 
    border: 'border-orange-500/30', 
    bg: 'bg-orange-950/20', 
    desc: 'Casos pausados automáticamente por la IA para que intervenga un humano, o asignados manualmente.' 
  },
  { 
    id: 'sales', 
    label: 'Ventas', 
    color: 'bg-blue-500', 
    border: 'border-blue-500/30', 
    bg: 'bg-blue-950/20', 
    desc: 'Clientes en negociación o seguimiento. La IA continúa activa para facilitar el cierre.' 
  },
  { 
    id: 'sold', 
    label: 'Vendido', 
    color: 'bg-emerald-500', 
    border: 'border-emerald-500/30', 
    bg: 'bg-emerald-950/20', 
    desc: 'Ventas cerradas. La IA sigue activa para atender dudas de soporte técnico o post-venta.' 
  },
  { 
    id: 'angry', 
    label: 'Molesto', 
    color: 'bg-rose-500', 
    border: 'border-rose-500/30', 
    bg: 'bg-rose-950/20', 
    desc: 'Clientes insatisfechos. El bot se apaga al 100% de inmediato para control puramente humano.' 
  },
  { 
    id: 'ignore', 
    label: 'Ignorar', 
    color: 'bg-purple-500', 
    border: 'border-purple-500/30', 
    bg: 'bg-purple-950/20', 
    desc: 'Spam, números equivocados o bloqueados. El bot se apaga y no envía ninguna respuesta.' 
  },
];

export function KanbanBoard({ initialConversations, orgId }: { initialConversations: any[], orgId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [conversations, setConversations] = useState(initialConversations);
  const [lines, setLines] = useState<WhatsAppLine[]>([]);
  const [selectedLine, setSelectedLine] = useState<string>('Todas');
  const [showGuide, setShowGuide] = useState(false);
  const [scrollDirection, setScrollDirection] = useState<'left' | 'right' | null>(null);

  const filteredConversations = selectedLine === 'Todas' 
    ? conversations 
    : conversations.filter(c => c.line_key === selectedLine);

  // Group conversations by stage
  const columns = STAGES.map(stage => {
    return {
      ...stage,
      items: filteredConversations.filter(c => {
        const cStage = c.contacts?.metadata?.stage || 'inbox';
        return cStage === stage.id;
      })
    };
  });

  // Real-time updates
  useEffect(() => {
    const channel = supabase.channel('kanban_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => {
        router.refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        router.refresh();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, router]);

  useEffect(() => {
    const fetchLines = async () => {
      const { data } = await (supabase as any).from('whatsapp_lines').select('line_key, display_name').order('created_at');
      if (data) setLines(data);
    };
    fetchLines();
    const saved = localStorage.getItem('kb_selected_line');
    if (saved) setSelectedLine(saved);
  }, [supabase]);

  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Sync state if props change
  useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);

  // Handle auto-scroll interval based on scrollDirection state
  useEffect(() => {
    if (!scrollDirection) return;
    const interval = setInterval(() => {
      const container = document.getElementById('kanban-board-container');
      if (container) {
        container.scrollLeft += scrollDirection === 'right' ? 15 : -15;
      }
    }, 25);
    return () => clearInterval(interval);
  }, [scrollDirection]);

  // Card Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, contactId: string, convId: string) => {
    e.stopPropagation();
    e.dataTransfer.setData('contactId', contactId);
    e.dataTransfer.setData('convId', convId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // allow drop
  };

  const handleDrop = async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    setScrollDirection(null);
    const contactId = e.dataTransfer.getData('contactId');
    
    if (!contactId) return;

    // Optimistic update
    setConversations(prev => prev.map(c => {
      if (c.contact_id === contactId) {
        const botShouldBeActive = ['inbox', 'sales', 'sold'].includes(targetStage);
        return {
          ...c,
          bot_active: botShouldBeActive,
          contacts: {
            ...c.contacts,
            metadata: {
              ...(c.contacts.metadata || {}),
              stage: targetStage
            }
          }
        };
      }
      return c;
    }));

    // Server update
    await updateContactStageAction(contactId, targetStage);
    router.refresh();
  };

  // Auto-scroll when dragging a card near the edges of the visible board
  const handleBoardDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX;
    const edgeThreshold = 100; // px edge detection
    
    if (mouseX > rect.right - edgeThreshold) {
      setScrollDirection('right');
    } else if (mouseX < rect.left + edgeThreshold) {
      setScrollDirection('left');
    } else {
      setScrollDirection(null);
    }
  };

  const handleDragEnd = () => {
    setScrollDirection(null);
  };

  // Board Panning (Drag to Scroll) Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[draggable="true"]')) return;
    setIsDragging(true);
    setStartX(e.pageX - e.currentTarget.offsetLeft);
    setScrollLeft(e.currentTarget.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - e.currentTarget.offsetLeft;
    const walk = (x - startX) * 2;
    e.currentTarget.scrollLeft = scrollLeft - walk;
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .kanban-scroll::-webkit-scrollbar {
          height: 10px;
        }
        .kanban-scroll::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.5);
          border-radius: 8px;
        }
        .kanban-scroll::-webkit-scrollbar-thumb {
          background: rgba(99, 102, 241, 0.5);
          border-radius: 8px;
        }
        .kanban-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(99, 102, 241, 0.8);
        }
      `}} />

      {/* Kanban Info / Guide Toggle Button */}
      <div className="flex flex-col gap-4 mb-4">
        {/* Line Tabs - horizontal tab bar */}
        {lines.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
            <button
              onClick={() => {
                setSelectedLine('Todas');
                localStorage.setItem('kb_selected_line', 'Todas');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedLine === 'Todas'
                  ? 'bg-primary-500/20 text-primary-300 border border-primary-500/40 shadow-lg shadow-primary-500/10'
                  : 'bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10 hover:text-white'
              }`}
            >
              Todas las líneas
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10">{conversations.length}</span>
            </button>
            {lines.map((line, idx) => {
              const lineCount = conversations.filter(c => c.line_key === line.line_key).length;
              const dotColor = LINE_COLORS[idx % LINE_COLORS.length].replace('bg-', '');
              return (
                <button
                  key={line.line_key}
                  onClick={() => {
                    setSelectedLine(line.line_key);
                    localStorage.setItem('kb_selected_line', line.line_key);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedLine === line.line_key
                      ? 'bg-white/15 text-white border border-white/20 shadow-lg'
                      : 'bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${LINE_COLORS[idx % LINE_COLORS.length]}`} />
                  {line.display_name}
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10">{lineCount}</span>
                </button>
              );
            })}
          </div>
        )}

        <button
          onClick={() => setShowGuide(!showGuide)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white transition-all shadow-md w-max"
        >
          <Info size={14} weight="fill" className="text-primary-400" />
          {showGuide ? 'Ocultar Guía de Flujos' : 'Ver Guía de Flujos (IA vs Humano)'}
        </button>
      </div>

      {/* Guide Banner */}
      {showGuide && (
        <div className="glass p-5 rounded-2xl border border-white/10 mb-6 bg-slate-900/60 shadow-xl relative animate-fade-in">
          <button 
            onClick={() => setShowGuide(false)}
            className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-all"
          >
            <X size={16} />
          </button>
          
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Robot size={18} className="text-primary-400" /> Guía de Funcionamiento: IA vs. Humano
          </h3>
          <p className="text-xs text-slate-300 mb-4 max-w-4xl">
            Este CRM Kanban regula de manera automática si los mensajes entrantes de WhatsApp de cada cliente son atendidos por la Inteligencia Artificial o transferidos inmediatamente a ti (control humano).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {STAGES.map((s) => {
              const isBotActive = ['inbox', 'sales', 'sold'].includes(s.id);
              return (
                <div key={s.id} className="p-3 rounded-xl bg-slate-950/40 border border-white/5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                      <span className="text-xs font-bold text-white">{s.label}</span>
                      
                      {isBotActive ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 ml-auto flex items-center gap-0.5">
                          🤖 IA Activa
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 ml-auto flex items-center gap-0.5">
                          👤 Solo Humano
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scrollable Kanban Container */}
      <div 
        id="kanban-board-container"
        className={`flex gap-4 overflow-x-auto pb-6 h-full min-h-[600px] items-start kanban-scroll w-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onDragOver={handleBoardDragOver}
        onDragLeave={() => setScrollDirection(null)}
        onDragEnd={handleDragEnd}
        onDrop={() => setScrollDirection(null)}
      >
        {columns.map(col => (
          <div 
            key={col.id} 
            className={`flex-shrink-0 w-72 rounded-2xl border ${col.border} ${col.bg} p-4 flex flex-col`}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${col.color}`} />
                  <h3 className="font-bold text-white text-sm">{col.label}</h3>
                </div>
                {['inbox', 'sales', 'sold'].includes(col.id) ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1 w-max">
                    <Robot size={12} weight="fill" /> IA Activa
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1 w-max">
                    <User size={12} weight="fill" /> Solo Humano
                  </span>
                )}
              </div>
              <span className="text-xs bg-slate-800/50 text-slate-400 px-2 py-1 rounded-full font-medium mt-1">
                {col.items.length}
              </span>
            </div>

            <div className="flex flex-col gap-3 min-h-[100px]">
              {col.items.map(conv => (
                <div
                  key={conv.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, conv.contact_id, conv.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => router.push(`/conversaciones/${conv.id}`)}
                  className="bg-slate-900 border border-slate-700/50 p-3.5 rounded-xl cursor-grab hover:border-primary-500/50 hover:bg-slate-850 transition-all shadow-md active:cursor-grabbing group relative flex flex-col gap-2.5"
                >
                  <div className="flex justify-between items-start">
                    <h4 className="font-semibold text-white text-sm truncate pr-2">
                      {conv.contacts?.full_name || conv.contacts?.wa_phone}
                    </h4>
                    {conv.line_key && lines.length > 0 && (
                      <div 
                        className={`w-2 h-2 shrink-0 mt-1.5 rounded-full shadow-sm ${LINE_COLORS[lines.findIndex(l => l.line_key === conv.line_key) % LINE_COLORS.length]}`} 
                        title={`Línea: ${lines.find(l => l.line_key === conv.line_key)?.display_name}`}
                      />
                    )}
                  </div>
                  
                  {/* Phone and Date info */}
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="truncate max-w-[120px] font-mono opacity-70">
                      {conv.contacts?.wa_phone}
                    </span>
                    <div className="flex items-center gap-1 opacity-70">
                      <Clock size={12} />
                      <span>
                        {new Date(conv.last_message_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>

                  {/* Visual IA vs Humano card badge */}
                  <div className="pt-1 border-t border-white/5 flex items-center justify-between">
                    {conv.bot_active ? (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                        <Robot size={10} weight="fill" /> Respondido por IA
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1">
                        <User size={10} weight="fill" /> Control Humano
                      </span>
                    )}
                  </div>

                  <div className="absolute inset-0 border-2 border-transparent group-active:border-primary-500/30 rounded-xl pointer-events-none transition-all" />
                </div>
              ))}
              
              {col.items.length === 0 && (
                <div className="text-center py-6 text-xs text-slate-500 border border-dashed border-slate-700/50 rounded-xl">
                  Arrastra aquí
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
