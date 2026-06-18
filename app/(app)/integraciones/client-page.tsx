'use client';

import { useState, useTransition, useEffect } from 'react';
import { 
  saveWhatsAppConfigAction, 
  connectGoogleCalendarAction, 
  disconnectGoogleCalendarAction,
  saveGoogleCalendarIdAction,
  disconnectWhatsAppAction,
  checkWhatsAppStatusAction
} from '@/lib/integrations/actions';
import { 
  WhatsappLogo, 
  GoogleLogo, 
  Plugs, 
  Check, 
  SpinnerGap, 
  Eye, 
  EyeSlash, 
  Trash,
  WifiHigh,
  WifiSlash
} from '@phosphor-icons/react';

interface IntegrationsPageProps {
  initialWaConfig: any;
  initialCalendarConfig: any;
  calendarsList: { id: string; name: string }[];
}

export default function IntegrationsClientPage({ 
  initialWaConfig, 
  initialCalendarConfig,
  calendarsList 
}: IntegrationsPageProps) {
  const [provider, setProvider] = useState<'openwa' | 'meta'>(initialWaConfig?.provider || 'openwa');
  const [showSecret, setShowSecret] = useState(false);
  const [waError, setWaError] = useState<string | null>(null);
  const [waSuccess, setWaSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Connection status of local WhatsApp bot
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const [calId, setCalId] = useState(initialCalendarConfig?.calendar_id || '');
  const [calError, setCalError] = useState<string | null>(null);
  const [calSuccess, setCalSuccess] = useState(false);


  useEffect(() => {
    if (provider === 'openwa') {
      checkStatus();
      const interval = setInterval(checkStatus, 10000); // Check every 10s
      return () => clearInterval(interval);
    }
  }, [provider]);

  async function checkStatus() {
    setCheckingStatus(true);
    try {
      const res = await checkWhatsAppStatusAction();
      setIsConnected(res.connected);
    } catch {
      setIsConnected(false);
    } finally {
      setCheckingStatus(false);
    }
  }

  function handleWaSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setWaError(null);
    setWaSuccess(false);
    
    const formData = new FormData(e.currentTarget);
    formData.append('provider', provider);

    startTransition(async () => {
      const res = await saveWhatsAppConfigAction(formData);
      if (res?.error) {
        setWaError(res.error);
      } else {
        setWaSuccess(true);
      }
    });
  }

  function handleWaDisconnect() {
    if (confirm('¿Seguro que deseas desvincular WhatsApp y cerrar sesión?')) {
      setWaError(null);
      setWaSuccess(false);
      startTransition(async () => {
        const res = await disconnectWhatsAppAction();
        if (res?.error) {
          setWaError(res.error);
        } else {
          setWaSuccess(true);
          alert('Sesión de WhatsApp cerrada con éxito. Revisa tu consola de PowerShell para ver el nuevo código QR.');
        }
      });
    }
  }

  function handleCalIdSave() {
    setCalError(null);
    setCalSuccess(false);
    startTransition(async () => {
      const res = await saveGoogleCalendarIdAction(calId);
      if (res?.error) {
        setCalError(res.error);
      } else {
        setCalSuccess(true);
      }
    });
  }


  function handleGoogleConnect() {
    startTransition(async () => {
      await connectGoogleCalendarAction();
    });
  }

  function handleGoogleDisconnect() {
    if (confirm('¿Seguro que deseas desconectar Google Calendar?')) {
      startTransition(async () => {
        const res = await disconnectGoogleCalendarAction();
        if (res?.error) {
          alert('Error: ' + res.error);
        } else {
          window.location.reload();
        }
      });
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Plugs size={28} weight="fill" className="text-primary-400" />
          Integraciones
        </h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(148, 163, 184, 0.6)' }}>
          Configura tus canales de comunicación y herramientas externas.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* WhatsApp Config Card */}
        <div className="card space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(16, 185, 129, 0.15)' }}>
              <WhatsappLogo size={24} weight="fill" className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">WhatsApp</h2>
              <p className="text-xs" style={{ color: 'rgba(148, 163, 184, 0.5)' }}>Canal principal de chat de los clientes</p>
            </div>
          </div>

          {/* Provider Selector Tabs */}
          <div className="flex p-1 rounded-xl bg-slate-900 border border-white/5">
            <button
              onClick={() => setProvider('openwa')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                provider === 'openwa' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              OpenWA (Local/Pruebas)
            </button>
            <button
              onClick={() => setProvider('meta')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                provider === 'meta' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Meta Cloud API (Producción)
            </button>
          </div>

          {waError && (
            <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.2)', color: '#fb7185' }}>
              {waError}
            </div>
          )}

          {waSuccess && (
            <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
              Configuración de WhatsApp guardada exitosamente.
            </div>
          )}

          <form onSubmit={handleWaSubmit} className="space-y-4">
            {provider === 'openwa' ? (
              <>
                {/* Status Indicator */}
                <div className="p-4 rounded-xl border flex items-center justify-between transition-colors bg-slate-900/40 border-white/5">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isConnected ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                    }`}>
                      {isConnected ? <WifiHigh size={20} /> : <WifiSlash size={20} />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {isConnected ? 'WhatsApp Conectado' : 'WhatsApp Desconectado'}
                      </p>
                      <p className="text-xs" style={{ color: 'rgba(148, 163, 184, 0.5)' }}>
                        {isConnected 
                          ? 'El robot está activo y procesando mensajes localmente.' 
                          : 'El servidor local no responde. Ejecuta node server.js en tu consola.'}
                      </p>
                    </div>
                  </div>
                  {checkingStatus && (
                    <SpinnerGap size={16} className="animate-spin text-slate-500" />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'rgba(148, 163, 184, 0.5)' }}>
                    URL de la API de OpenWA (Bloqueado)
                  </label>
                  <input
                    name="openwaApiUrl"
                    type="url"
                    defaultValue={initialWaConfig?.openwa_api_url || 'http://localhost:2785'}
                    disabled={true}
                    className="input text-sm opacity-60 cursor-not-allowed select-none bg-slate-950"
                    placeholder="http://localhost:2785"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'rgba(148, 163, 184, 0.5)' }}>
                    ID de Sesión (Session ID) (Bloqueado)
                  </label>
                  <input
                    name="openwaSessionId"
                    type="text"
                    defaultValue={initialWaConfig?.openwa_session_id || 'default'}
                    disabled={true}
                    className="input text-sm opacity-60 cursor-not-allowed select-none bg-slate-950"
                    placeholder="default"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'rgba(148, 163, 184, 0.5)' }}>
                    API Key de OpenWA (Opcional) (Bloqueado)
                  </label>
                  <input
                    name="openwaApiKey"
                    type="password"
                    defaultValue={initialWaConfig?.openwa_api_key || ''}
                    disabled={true}
                    className="input text-sm opacity-60 cursor-not-allowed select-none bg-slate-950"
                    placeholder="Sin API Key configurada"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'rgba(148, 163, 184, 0.7)' }}>Identificador de Número de Teléfono (Phone ID)</label>
                  <input
                    name="phoneNumberId"
                    type="text"
                    defaultValue={initialWaConfig?.phone_number_id || ''}
                    required
                    className="input text-sm"
                    placeholder="1029384756..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'rgba(148, 163, 184, 0.7)' }}>ID de cuenta de WhatsApp Business (WABA ID)</label>
                  <input
                    name="wabaId"
                    type="text"
                    defaultValue={initialWaConfig?.waba_id || ''}
                    required
                    className="input text-sm"
                    placeholder="987654321..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'rgba(148, 163, 184, 0.7)' }}>Token de Acceso Permanente (Access Token)</label>
                  <div className="relative">
                    <input
                      name="accessToken"
                      type={showSecret ? 'text' : 'password'}
                      className="input text-sm pr-10"
                      placeholder="EAAGy..."
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showSecret ? <EyeSlash size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'rgba(148, 163, 184, 0.7)' }}>Token de Verificación del Webhook</label>
                  <input
                    name="verifyToken"
                    type="text"
                    defaultValue={initialWaConfig?.verify_token || ''}
                    required
                    className="input text-sm"
                    placeholder="mi-verify-token-seguro"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'rgba(148, 163, 184, 0.7)' }}>App Secret de la App de Meta (Opcional)</label>
                  <input
                    name="appSecret"
                    type="password"
                    className="input text-sm"
                    placeholder="Para validación de firma HMAC"
                  />
                </div>
              </>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="btn-primary flex-1"
              >
                {isPending ? <SpinnerGap size={18} className="animate-spin" /> : null}
                {isPending ? 'Guardando...' : 'Guardar configuración'}
              </button>
              {provider === 'openwa' && isConnected && (
                <button
                  type="button"
                  onClick={handleWaDisconnect}
                  disabled={isPending}
                  className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-xl font-semibold text-sm transition-colors"
                  title="Desvincular WhatsApp"
                >
                  Desvincular
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Google Calendar Card */}
        <div className="card space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(59, 130, 246, 0.15)' }}>
              <GoogleLogo size={24} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Google Calendar</h2>
              <p className="text-xs" style={{ color: 'rgba(148, 163, 184, 0.5)' }}>Para agendar citas y llamadas desde el bot</p>
            </div>
          </div>

          {initialCalendarConfig?.refresh_token_encrypted ? (
            <div className="space-y-6">
              <div className="p-4 rounded-xl glass-light flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse-soft" />
                  <span className="text-sm font-semibold text-white">Conectado a Google</span>
                </div>
                <button
                  onClick={handleGoogleDisconnect}
                  className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                  title="Desconectar"
                >
                  <Trash size={18} />
                </button>
              </div>

              {calError && (
                <div className="p-3 rounded-xl text-sm bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  {calError}
                </div>
              )}

              {calSuccess && (
                <div className="p-3 rounded-xl text-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  Calendario guardado correctamente.
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'rgba(148, 163, 184, 0.7)' }}>
                    Seleccionar calendario para agendar
                  </label>
                  <select
                    value={calId}
                    onChange={(e) => setCalId(e.target.value)}
                    className="input text-sm"
                  >
                    <option value="">Selecciona un calendario</option>
                    {calendarsList.map((cal) => (
                      <option key={cal.id} value={cal.id}>
                        {cal.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleCalIdSave}
                  disabled={isPending || !calId}
                  className="btn-primary w-full"
                >
                  {isPending ? <SpinnerGap size={18} className="animate-spin" /> : null}
                  Guardar calendario
                </button>
              </div>
              
            </div>
          ) : (
            <div className="space-y-4 py-6 text-center">
              <GoogleLogo size={48} className="mx-auto text-slate-500 mb-2" />
              <p className="text-sm" style={{ color: 'rgba(148, 163, 184, 0.7)' }}>
                Conecta tu cuenta de Google para que el bot pueda verificar disponibilidad y agendar citas en tu calendario.
              </p>
              <button
                onClick={handleGoogleConnect}
                disabled={isPending}
                className="btn-primary inline-flex mt-2"
              >
                {isPending ? <SpinnerGap size={18} className="animate-spin" /> : <GoogleLogo size={18} weight="bold" />}
                Conectar Google Calendar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}