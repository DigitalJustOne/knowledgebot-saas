import { tool, jsonSchema } from 'ai';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
import { pipeline } from '@xenova/transformers';

interface ToolContext {
  orgId: string;
}

// Global variable to cache the extractor so it doesn't load every time
let extractorCache: any = null;

async function getExtractor() {
  if (!extractorCache) {
    extractorCache = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');
  }
  return extractorCache;
}

async function createQueryEmbedding(input: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(input, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

export function queryKnowledgeBaseTool(ctx: ToolContext) {
  return tool({
    description:
      'Busca informacion en la base de conocimiento vectorial de Supabase. Uso obligatorio antes de responder preguntas sobre politicas, productos, procesos, precios, requisitos, documentacion, soporte, inventario, manuales, contratos o cualquier dato que pueda estar en la base documental del negocio. No inventes respuestas si esta herramienta no devuelve resultados.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Pregunta o termino de busqueda del cliente, redactado con suficiente contexto.',
        },
        limit: {
          type: 'number',
          description: 'Cantidad maxima de fragmentos a recuperar. Usa 4 a 8 normalmente.',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Etiquetas opcionales para filtrar la busqueda, por ejemplo: precios, soporte, politicas.',
        },
      },
      required: ['query'],
    }),
    execute: async (args: any) => {
      const query = String(args.query || '').trim();
      const limit = Math.min(Math.max(Number(args.limit || 30), 1), 30);
      const tags = Array.isArray(args.tags) ? args.tags.filter(Boolean).map(String) : null;
      const threshold = 0.05; // Hardcoded to very low to prevent filtering
      const fs = require('fs');

      const logMessage = `\n[${new Date().toISOString()}] [TOOL CALL] queryKnowledgeBase: query="${query}", limit=${limit}`;
      try { fs.appendFileSync('agent_calls.log', logMessage + '\n'); } catch(e) {}

      if (!query) {
        return { success: false, error: 'Debes enviar una pregunta o termino de busqueda.' };
      }

      try {
        const supabase = createAdminClient();
        const embedding = await createQueryEmbedding(query);

        const { data, error } = await (supabase as any).rpc('match_knowledge_chunks', {
          target_organization_id: ctx.orgId,
          query_embedding: embedding,
          match_count: limit,
          match_threshold: threshold,
          filter_tags: tags && tags.length > 0 ? tags : null,
        });

        if (error) {
          logger.error('Knowledge base query RPC error', { error: error.message });
          return { success: false, error: `Error al consultar la base de conocimiento: ${error.message}` };
        }

        let records = (data || []).map((row: any) => ({
          id: row.chunk_id,
          documentId: row.document_id,
          title: row.document_title,
          sourceUrl: row.source_url,
          content: row.content,
          similarity: row.similarity,
          tags: row.tags || [],
          metadata: row.metadata || {},
        }));

        // SIEMPRE hacer busqueda hibrida para asegurar resultados exactos
        const keywords = query.split(' ').filter((w: string) => w.length > 3);
        if (keywords.length > 0) {
          const orQuery = keywords.map(kw => `content.ilike.%${kw}%`).join(',');
          const { data: textData } = await (supabase as any)
            .from('knowledge_chunks')
            .select('*')
            .eq('organization_id', ctx.orgId)
            .or(orQuery)
            .limit(10);
          if (textData) {
            for (const row of textData) {
              if (!records.find((r: any) => r.id === row.id)) {
                records.push({
                  id: row.id,
                  documentId: row.document_id,
                  title: 'Búsqueda por palabra clave',
                  sourceUrl: '',
                  content: row.content,
                  similarity: 1.0,
                  tags: [],
                  metadata: {}
                });
              }
            }
          }
        }



        const resultLog = `[RESULT] queryKnowledgeBase: ${records.length} resultado(s) para query="${query}"\n`;
        try { fs.appendFileSync('agent_calls.log', resultLog); } catch(e) {}

        return {
          success: true,
          query,
          records,
          note: records.length > 0
            ? 'Usa solo estos fragmentos para responder. NOTA: Las tablas estan separadas por |. La primera fila son las cantidades (ej. 6 | 12 | 30). Las filas siguientes tienen el producto y sus precios bajo cada cantidad (ej. Dril Bordada | 20000 | 15000 significa que 6 cuestan 20000 cada una, 12 cuestan 15000, etc.). Si falta un dato especifico, dilo.'
            : 'No se encontro informacion confiable en la base de conocimiento para esta pregunta.',
        };
      } catch (err: any) {
        logger.error('Knowledge base query error', { error: String(err) });
        const errMsg = `[ERROR] queryKnowledgeBase: ${err.message || String(err)}\n`;
        try { fs.appendFileSync('agent_calls.log', errMsg); } catch(e) {}
        return { success: false, error: err.message || String(err) };
      }
    },
  } as any);
}
