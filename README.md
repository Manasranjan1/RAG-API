# Async Document Intelligence — RAG API

A lightweight document question-answering API built with **Retrieval-Augmented Generation (RAG)**. Upload PDF files and ask questions about their contents. The system retrieves relevant passages and generates accurate, context-grounded answers with source citations.

Built for a developer portfolio to demonstrate practical RAG, LangChain.js, embeddings, vector search, and Express API skills.

---

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | Node.js 22 (ES Modules) |
| Backend | Express.js |
| AI Framework | LangChain.js |
| Primary LLM | Google Gemini (`gemini-1.5-flash`) |
| Embeddings | Google Gemini (`text-embedding-004`, 768 dims) |
| Vector DB | pgvector on Supabase PostgreSQL |
| PDF Parsing | `pdf-parse` |

---

## Getting Started

### 1. Clone the repository

```bash
git clone <repo-url>
cd rag-api
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
# Edit .env and fill in GOOGLE_API_KEY and DATABASE_URL
```

### 4. Run the development server

```bash
npm run dev
```

### 5. Test the health endpoint

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "project": "RAG API",
  "version": "0.1.0",
  "timestamp": "..."
}
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/api/documents/upload` | Upload a PDF and start ingestion |
| GET | `/api/documents` | List documents and statuses |
| GET | `/api/documents/:id` | Get document details |
| POST | `/api/ask` | Ask a question about a document |

---

## Project Status

> Phase 0 complete — basic server scaffold. See development phases below.

---

## Architecture (coming after Phase 3)

---

## Development Phases

- [x] Phase 0 — Project setup and Express server
- [ ] Phase 1 — PDF upload and text extraction
- [ ] Phase 2 — Chunking and embeddings
- [ ] Phase 3 — PostgreSQL and pgvector storage
- [ ] Phase 4 — Semantic search and retrieval
- [ ] Phase 5 — RAG and answer generation
- [ ] Phase 6 — Async ingestion and source citations
- [ ] Phase 7 — Testing, documentation, deployment
