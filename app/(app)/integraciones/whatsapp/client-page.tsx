'use client';

import { useState, useEffect } from 'react';
import { Phone, QrCode, Plus, Trash, Plug, SpinnerGap } from '@phosphor-icons/react';

interface WhatsAppLine {
  id: string;
  line_key: string;
  display_name: string;
  phone_number: string | null;
  status: 'disconnected' | 'awaiting_qr' | 'connected';
  qr_code: string | null;
}

export default function ClientPage({ initialLines }: { initialLines: WhatsAppLine[] }) {
  const [lines, setLines] = useState<WhatsAppLine[]>(initialLines);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLines = async () => {
    try {
      const res = await fetch('/api/whatsapp-lines');
      if (res.ok) {
        const data = await res.json();
        setLines(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const hasAwaiting = lines.some(l => l.status === 'awaiting_qr');
    
    if (hasAwaiting) {
      interval = setInterval(fetchLines, 3000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [lines]);

  const handleConnect = async (lineKey: string) => {
    setIsLoading(true);
    try {
      await fetch('/api/whatsapp-lines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line_key: lineKey, display_name: lines.find(l => l.line_key === lineKey)?.display_name })
      });
      await fetchLines();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async (lineKey: string) => {
    setIsLoading(true);
    try {
      await fetch(`/api/whatsapp-lines/${lineKey}`, {
        method: 'DELETE'
      });
      await fetchLines();
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddLine = async () => {
    const nextNum = lines.length + 1;
    if (nextNum > 8) return alert('Máximo 8 líneas permitidas');
    const name = prompt('Nombre de la nueva línea:', `Línea ${nextNum}`);
    if (!name) return;
    
    setIsLoading(true);
    try {
      const lineKey = `linea_${nextNum}`;
      await fetch('/api/whatsapp-lines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line_key: lineKey, display_name: name })
      });
      await fetchLines();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Líneas de WhatsApp</h1>
          <p className="text-sm text-slate-400 mt-1">Administra hasta 8 sesiones independientes en tu panel.</p>
        </div>
        <button
          onClick={handleAddLine}
          disabled={lines.length >= 8 || isLoading}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} weight="bold" />
          Nueva Línea
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {lines.map(line => (
          <div key={line.id} className="glass p-5 rounded-2xl flex flex-col relative overflow-hidden group">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">{line.display_name}</h3>
                <p className="text-xs text-slate-400 mt-1">{line.phone_number || 'Sin número detectado'}</p>
              </div>
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-800/50">
                <Phone size={16} className={line.status === 'connected' ? 'text-green-400' : 'text-slate-500'} />
              </div>
            </div>

            <div className="flex-1 min-h-[160px] flex items-center justify-center border border-white/5 bg-slate-950/30 rounded-xl mb-4 p-2 relative">
              {line.status === 'awaiting_qr' && line.qr_code ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={line.qr_code} alt="QR Code" className="w-full h-auto rounded-lg" />
              ) : line.status === 'awaiting_qr' ? (
                 <div className="flex flex-col items-center gap-2 text-slate-400">
                   <SpinnerGap size={24} className="animate-spin text-primary-400" />
                   <span className="text-xs">Generando QR...</span>
                 </div>
              ) : line.status === 'connected' ? (
                <div className="flex flex-col items-center gap-2 text-green-400/80">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-1">
                    <Plug size={24} weight="fill" />
                  </div>
                  <span className="text-xs font-medium">Línea en Servicio</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-500">
                  <QrCode size={32} weight="light" />
                  <span className="text-xs">Desconectada</span>
                </div>
              )}
            </div>

            <div className="mt-auto">
              {line.status === 'connected' ? (
                <button
                  onClick={() => handleDisconnect(line.line_key)}
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  Desconectar
                </button>
              ) : line.status === 'disconnected' ? (
                <button
                  onClick={() => handleConnect(line.line_key)}
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold bg-primary-500/20 text-primary-300 hover:bg-primary-500/30 transition-colors"
                >
                  Solicitar QR
                </button>
              ) : (
                <button
                  disabled
                  className="w-full py-2.5 rounded-xl text-xs font-semibold bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 cursor-wait flex items-center justify-center gap-2"
                >
                  <SpinnerGap size={14} className="animate-spin" />
                  Esperando Escaneo
                </button>
              )}
            </div>
          </div>
        ))}

        {lines.length === 0 && (
          <div className="col-span-full glass p-8 rounded-2xl text-center border border-dashed border-white/10">
            <Phone size={32} className="mx-auto text-slate-500 mb-3" weight="light" />
            <h3 className="text-sm font-medium text-white mb-1">No hay líneas configuradas</h3>
            <p className="text-xs text-slate-400 mb-4 max-w-sm mx-auto">
              Comienza agregando tu primera línea de WhatsApp para sincronizar chats y atender clientes.
            </p>
            <button onClick={handleAddLine} disabled={isLoading} className="btn-primary inline-flex">
              Agregar Línea
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
