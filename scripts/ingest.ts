import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import Papa from 'papaparse';
import { pipeline } from '@xenova/transformers';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Chunk text
function chunkText(text: string, chunkSize: number = 800, overlap: number = 100): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + chunkSize, text.length);
    if (end < text.length) {
      const nextNewline = text.lastIndexOf('\n', end);
      const nextPeriod = text.lastIndexOf('.', end);
      const splitIndex = Math.max(nextNewline, nextPeriod);
      if (splitIndex > i + chunkSize / 2) {
        end = splitIndex + 1;
      }
    }
    chunks.push(text.slice(i, end).trim());
    i = end - overlap;
  }
  return chunks.filter(c => c.length > 0);
}

async function ingestFile(filePath: string) {
  const title = path.basename(filePath);
  
  // Create an organization if none exists
  let { data: orgData } = await supabase.from('organizations').select('id').limit(1);
  let orgId = '';
  if (!orgData || orgData.length === 0) {
    const { data: newOrg } = await supabase.from('organizations').insert({
      name: 'KnowledgeBot Default Org',
      slug: 'knowledgebot-default'
    }).select('id').single();
    if (newOrg) orgId = newOrg.id;
  } else {
    orgId = orgData[0].id;
  }

  if (!orgId) throw new Error('No se pudo encontrar o crear una organización');

  console.log('Cargando el motor de inteligencia artificial local (esto puede tardar unos segundos la primera vez)...');
  const extractor = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');

  const content = fs.readFileSync(filePath, 'utf-8');
  let textToProcess = '';
  
  if (filePath.toLowerCase().endsWith('.csv')) {
      const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
      textToProcess = parsed.data.map(row => JSON.stringify(row)).join('\n');
  } else {
      textToProcess = content;
  }

  console.log(`Procesando ${title}...`);

  const { data: doc, error: docError } = await supabase
    .from('knowledge_documents')
    .insert({
      organization_id: orgId,
      title,
      source_type: 'manual',
      source_url: filePath,
    })
    .select('id')
    .single();

  if (docError || !doc) {
    throw new Error(`Error insertando documento: ${docError?.message}`);
  }

  const documentId = doc.id;
  const chunks = chunkText(textToProcess);
  console.log(`Se crearon ${chunks.length} fragmentos de memoria. Generando vectores localmente...`);

  const batchSize = 10;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const chunkBatch = chunks.slice(i, i + batchSize);
    console.log(`Inyectando fragmentos ${i + 1} a ${Math.min(i + batchSize, chunks.length)} de ${chunks.length}...`);
    
    try {
      const embeddings = await Promise.all(chunkBatch.map(async text => {
         const output = await extractor(text, { pooling: 'mean', normalize: true });
         return Array.from(output.data);
      }));
      
      const rows = chunkBatch.map((chunkText, idx) => ({
        organization_id: orgId,
        document_id: documentId,
        content: chunkText,
        embedding: embeddings[idx],
        token_count: Math.ceil(chunkText.length / 4)
      }));

      const { error: insertError } = await supabase
        .from('knowledge_chunks')
        .insert(rows);

      if (insertError) {
        console.error(`Error guardando en BD: ${insertError.message}`);
      }
    } catch (e: any) {
      console.error(`Error local: ${e.message}`);
    }
  }

  console.log(`¡Memoria inyectada con éxito!`);
}

const targetPath = process.argv[2];
if (!targetPath) {
  console.log('Debes proporcionar la ruta de un archivo.');
  process.exit(1);
}

ingestFile(targetPath).catch(console.error);
