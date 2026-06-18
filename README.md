# KnowledgeBot SaaS - WhatsApp AI with Supabase RAG

KnowledgeBot is a multi-tenant WhatsApp assistant for businesses with large knowledge bases. It keeps the same operational base as the existing SaaS bots, but replaces vertical-specific knowledge with a Supabase vector memory/RAG layer.

## Stack

- Next.js 16 App Router
- Supabase Auth, Postgres, RLS and Realtime
- Supabase `pgvector` tables for permanent knowledge memory
- OpenRouter for chat completions, currently `deepseek/deepseek-chat`
- OpenAI-compatible embeddings endpoint for vector search
- Google Calendar for scheduling
- Meta Cloud API or OpenWA for WhatsApp

## RAG Memory

The initial schema creates:

- `knowledge_documents`: source documents per organization
- `knowledge_chunks`: embedded fragments with `vector(1536)`
- `match_knowledge_chunks(...)`: RPC used by the agent tool `queryKnowledgeBase`

The agent must call `queryKnowledgeBase` before answering questions about policies, products, requirements, processes, prices, support, manuals, inventory, contracts or specialized business information. If no reliable chunk is found, the prompt instructs it to say that clearly and escalate or ask for more context.

## Local Setup

1. Copy `.env.example` to `.env.local`.
2. Fill Supabase, OpenRouter, embeddings, Google OAuth and encryption values.
3. Apply Supabase migrations in order:
   - `supabase/migrations/00001_initial_schema.sql`
   - `supabase/migrations/00002_add_agent_metadata.sql`
4. Install and run:

```bash
npm install
npm run dev -- -p 3003
```

Open http://localhost:3003.

## Loading Knowledge

For each organization, insert one row in `knowledge_documents`, split the source into chunks, generate embeddings using the same `EMBEDDINGS_MODEL`, and insert rows into `knowledge_chunks` with the matching `organization_id` and `document_id`.

The default schema expects 1536-dimensional embeddings. If you choose another embedding model, update both `knowledge_chunks.embedding vector(1536)` and the `match_knowledge_chunks` function signature.

## Notes

- Use a fresh Supabase project for this bot.
- Keep `OPENROUTER_API_KEY` for the chat model and `EMBEDDINGS_API_KEY` for vector embeddings.
- Google OAuth is only needed for calendar scheduling.
- WhatsApp can run through OpenWA for local testing or Meta Cloud API for production.

## Docker & Production Deployment (Railway)

### Running Locally with Docker Compose

This project includes a fully optimized production Docker structure. You can run both the Next.js SaaS app and the local WhatsApp bridge (Puppeteer + Chromium) with one command.

1. Ensure you have your `.env.local` configured in the root of `knowledgebot-saas`.
2. Start the services:
   ```bash
   docker-compose up --build
   ```
3. The Next.js SaaS app will be running at `http://localhost:3003`.
4. The WhatsApp bridge will be running at `http://localhost:3004`. Because both containers share the host network via `network_mode: "host"`, they will seamlessly communicate using `localhost`.

### Deploying to Railway (PaaS)

Railway natively detects the `Dockerfile` at the root of `knowledgebot-saas` and will automatically deploy it.

1. **Next.js SaaS App**:
   - Create a new service on Railway from GitHub pointing to `knowledgebot-saas`.
   - Add all environment variables listed in `.env.example` in the Railway variables dashboard.
   - Set the port to `3003` (Railway binds it automatically).

2. **WhatsApp Bridge (`wa-server-knowledge`)**:
   - Create a second service pointing to the same repository.
   - Set the build configuration to use `Dockerfile.whatsapp` and build context to `../wa-server-knowledge`.
   - Ensure the WhatsApp bridge can talk to the Next.js App's public URL (configure it via environment variables if you deploy to separate cloud domains).
