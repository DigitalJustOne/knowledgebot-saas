'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, ChatCircleDots, X, ArrowRight, Clock } from '@phosphor-icons/react';
import Link from 'next/link';

interface HandoffAlert {
  conversationId: string;
  contactName: string | null;
  contactPhone: string;
  lastMessageAt: string;
  lastMessage: string;
  lastMessageDirection: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<HandoffAlert[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [animate, setAnimate] = useState(false);
  const prevCount = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/agent/handoff-alerts', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const newCount = data.count ?? 0;

      // Animate bell if new alerts arrived
      if (newCount > prevCount.current && prevCount.current !== 0) {
        setAnimate(true);
        setTimeout(() => setAnimate(false), 1000);
      }
      prevCount.current = newCount;
      setAlerts(data.alerts ?? []);
      setCount(newCount);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    // Poll every 30 seconds
    const interval = setInterval(fetchAlerts, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        id="notification-bell-btn"
        onClick={() => { setOpen(!open); if (!open) fetchAlerts(); }}
        className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 hover:bg-white/10 ${open ? 'bg-white/10' : ''}`}
        title="Alertas de asistencia"
        aria-label={`Notificaciones: ${count} pendientes`}
      >
        <Bell
          size={22}
          weight={count > 0 ? 'fill' : 'regular'}
          className={`transition-all duration-300 ${
            count > 0 ? 'text-amber-400' : 'text-slate-400'
          } ${animate ? 'animate-bounce' : ''}`}
        />
        {/* Badge */}
        {count > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white px-1"
            style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 0 8px rgba(239,68,68,0.6)' }}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 top-12 z-[200] w-80 rounded-2xl overflow-hidden shadow-2xl border"
          style={{
            background: 'rgba(15, 23, 42, 0.98)',
            backdropFilter: 'blur(24px)',
            borderColor: 'rgba(99, 102, 241, 0.2)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.1)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2">
              <Bell size={16} weight="fill" className="text-amber-400" />
              <span className="text-sm font-semibold text-white">Asistencia Requerida</span>
              {count > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: 'rgba(239,68,68,0.3)', color: '#fca5a5' }}>
                  {count} pendiente{count !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Content */}
          <div className="max-h-80 overflow-y-auto">
            {loading && alerts.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)' }}>
                  <Bell size={20} className="text-emerald-400" />
                </div>
                <p className="text-xs text-center" style={{ color: 'rgba(148,163,184,0.5)' }}>
                  Todo en orden. Sin alertas pendientes.
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {alerts.map((alert) => (
                  <Link
                    key={alert.conversationId}
                    href={`/conversaciones/${alert.conversationId}`}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group"
                  >
                    {/* Avatar */}
                    <div
                      className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}
                    >
                      {(alert.contactName || alert.contactPhone).charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-sm font-medium text-white truncate">
                          {alert.contactName || alert.contactPhone}
                        </p>
                        <span className="flex-shrink-0 flex items-center gap-0.5 text-[10px]" style={{ color: 'rgba(148,163,184,0.4)' }}>
                          <Clock size={10} />
                          {timeAgo(alert.lastMessageAt)}
                        </span>
                      </div>
                      {alert.contactName && (
                        <p className="text-[10px] mb-0.5" style={{ color: 'rgba(148,163,184,0.4)' }}>
                          {alert.contactPhone}
                        </p>
                      )}
                      {alert.lastMessage && (
                        <p className="text-xs truncate" style={{ color: 'rgba(148,163,184,0.6)' }}>
                          {alert.lastMessageDirection === 'inbound' ? '👤 ' : '🤖 '}
                          {alert.lastMessage}
                        </p>
                      )}
                    </div>

                    <ArrowRight size={14} className="flex-shrink-0 text-slate-600 group-hover:text-primary-400 transition-colors mt-1" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {alerts.length > 0 && (
            <div className="px-4 py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <Link
                href="/conversaciones"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-2 w-full text-xs font-medium text-primary-400 hover:text-primary-300 transition-colors"
              >
                <ChatCircleDots size={14} />
                Ver todas las conversaciones
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
