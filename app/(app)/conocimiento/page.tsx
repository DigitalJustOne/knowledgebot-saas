import { BookBookmark } from '@phosphor-icons/react/dist/ssr';
import { redirect } from 'next/navigation';

export default async function KnowledgeBasePage() {
  const { getCurrentUser } = await import('@/lib/auth/actions');
  const profile = await getCurrentUser();

  if (!profile) redirect('/login');

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <BookBookmark size={28} weight="fill" className="text-primary-400" />
          Base de Conocimiento
        </h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(148, 163, 184, 0.6)' }}>
          Gestiona los documentos, archivos y textos que KnowledgeBot usará para responder a tus clientes.
        </p>
      </div>

      <div className="glass p-8 rounded-2xl border border-white/5 text-center">
        <BookBookmark size={48} className="mx-auto text-primary-400/50 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">Sección en construcción</h3>
        <p style={{ color: 'rgba(148, 163, 184, 0.6)' }}>
          Pronto podrás subir tus documentos aquí para entrenar a tu IA.
        </p>
      </div>
    </div>
  );
}
