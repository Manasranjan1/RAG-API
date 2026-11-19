# Async Document Intelligence (RAG API)

A lightweight, asynchronous document question-answering backend API built with **Retrieval-Augmented Generation (RAG)**, **LangChain.js**, **Google Gemini**, **Express.js**, and **pgvector on Supabase PostgreSQL**.

Upload PDF documents and ask questions about their contents. The system retrieves relevant passages from PostgreSQL using vector similarity search and uses a grounded LLM to generate factual, context-constrained answers with source citations.

---

## 1. System Architecture

```mermaid
flowchart TD
    subgraph Client ["Client / Postman / Frontend"]
        U1["Upload PDF (POST /api/documents/upload)"]
        Q1["Ask Question (POST /api/ask)"]
        P1["Poll Status (GET /api/documents/:id)"]
    end

    subgraph Express ["Express.js Backend API"]
        UC["Document Controller"]
        QC["Question Controller"]
        IS["Ingestion Service (Async Worker)"]
        RS["RAG Service"]
        CS["Chunking Service"]
        ES["Embedding Service"]
        RetS["Retrieval Service"]
    end

    subgraph Storage ["PostgreSQL (Supabase) + pgvector"]
        T1[("documents Table")]
        T2[("document_chunks Table (vector 768)")]
        HNSW["HNSW Cosine Index (<=>)"]
    end

    subgraph AI ["AI Provider Layer"]
        GEM["Google Gemini (gemini-3-flash-preview)"]
        EMB["Gemini Embeddings (gemini-embedding-001)"]
        OAI["Alternative: OpenAI (gpt-4o-mini / text-embedding-3-small)"]
    end

    %% Ingestion Flow
    U1 -->|multipart/form-data| UC
    UC -->|1. Create PENDING record| T1
    UC -->|2. HTTP 202 Accepted| U1
    UC -.->|3. setImmediate async| IS
    IS -->|4. Parse PDF| IS
    IS -->|5. Recursive Split| CS
    CS -->|6. Chunks with metadata| IS
    IS -->|7. Generate Vectors| ES
    ES -->|embedDocuments| EMB
    IS -->|8. Bulk INSERT chunks + vectors| T2
    IS -->|9. Update status to COMPLETED| T1

    %% Status Polling
    P1 --> UC
    UC -->|Query status & total_chunks| T1

    %% Q&A Flow
    Q1 -->|{ documentId, question }| QC
    QC -->|Verify COMPLETED status| RS
    RS -->|Check document existence| T1
    RS --> RetS
    RetS -->|Embed user query| ES
    ES -->|embedQuery| EMB
    RetS -->|Similarity Search <=>| HNSW
    HNSW -->|Top-K chunks & similarity| RetS
    RetS -->|Relevant context passages| RS
    RS -->|Grounded context + Anti-hallucination prompt| GEM
    GEM -->|Answer with source citations| RS
    RS -->|{ answer, sources }| QC
    QC --> Q1
```

---

## 2. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Runtime** | Node.js (v22+, ES Modules) | Asynchronous JavaScript runtime |
| **Backend Framework** | Express.js | REST API routing and middleware pipeline |
| **AI Framework** | LangChain.js (`@langchain/core`) | Common model and prompt interfaces |
| **Primary LLM** | Google Gemini (`gemini-3-flash-preview`) | Fast, context-grounded answer generation |
| **Embedding Model** | Google Gemini (`gemini-embedding-001`) | 768-dimensional vector representations (MRL truncation) |
| **Database** | PostgreSQL on Supabase | Persistent metadata and relational chunk storage |
| **Vector Store** | `pgvector` extension | Vector similarity search using HNSW indexing and Cosine Distance (`<=>`) |
| **PDF Processing** | `pdf-parse` (v2 class API) | Fast page-level text and metadata extraction |
| **File Uploads** | `multer` | Multipart file handling with size and MIME validation |
| **Testing** | Node.js Native Test Runner (`node:test`) | Zero-dependency, automated integration test suite |

---

## 3. Core Architectural Decisions

### In-Process Asynchronous Ingestion
- Uploading a PDF triggers an immediate HTTP `202 Accepted` response.
- Ingestion runs in the background using `setImmediate()`, updating document states from `PENDING` $\to$ `PROCESSING` $\to$ `COMPLETED` (or `FAILED`).
- **Interview Note**: Eliminates the operational complexity of external message queues (Redis/BullMQ) for an MVP portfolio project while keeping HTTP requests fast and non-blocking. Documented trade-off: in-process background tasks are not durable across application restarts.

### Anti-Hallucination Prompt Engineering
- The RAG system prompt explicitly forces the LLM to answer using **only** retrieved document context excerpts.
- If relevant context is absent, the model is strictly constrained to reply:
  > *"I cannot find sufficient information in the document to answer this question."*

### Configurable AI Provider Layer
- AI providers are decoupled through `src/config/ai.js`.
- Switching from Google Gemini to OpenAI requires updating `AI_PROVIDER=openai` in `.env` without modifying RAG pipeline code.
- Dynamic lazy imports ensure that unused provider packages and API keys are never required or initialized.

### pgvector Cosine Similarity Search
- Chunks and query embeddings are compared using the cosine distance operator (`<=>`).
- Cosine distance measures semantic angle rather than vector magnitude:
  $$\text{Cosine Distance} = 1 - \text{Cosine Similarity}$$
- An HNSW index (`vector_cosine_ops`) provides fast approximate nearest-neighbor retrieval without needing an offline training step.

---

## 4. Database Schema

The database uses PostgreSQL with `pgvector` enabled:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents table: tracks file metadata and ingestion lifecycle
CREATE TABLE documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename    TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | PROCESSING | COMPLETED | FAILED
  total_chunks INTEGER,
  error_message TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Document Chunks table: stores text passages and embeddings
CREATE TABLE document_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  embedding   vector(768), -- Matches gemini-embedding-001 outputDimensionality
  page_number INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookup by document ID
CREATE INDEX idx_chunks_document_id ON document_chunks(document_id);

-- HNSW index for fast approximate nearest-neighbor vector search
CREATE INDEX idx_chunks_embedding ON document_chunks USING hnsw (embedding vector_cosine_ops);
```

---

## 5. Getting Started

### Prerequisites
- Node.js 18+ (Node 22 recommended)
- A Supabase account (free tier) with PostgreSQL and `pgvector`
- A Google Gemini API Key from [Google AI Studio](https://aistudio.google.com/)

### 1. Clone & Install
```bash
git clone <repository-url>
cd rag-api
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

`.env` configuration:
```env
PORT=3000
NODE_ENV=development

# AI Provider ("google" or "openai")
AI_PROVIDER=google
GOOGLE_API_KEY=your_gemini_api_key_here
GOOGLE_CHAT_MODEL=gemini-3-flash-preview
GOOGLE_EMBEDDING_MODEL=gemini-embedding-001

# Supabase Session Mode Pooler URI (IPv4 compatible)
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres

# Document Splitting
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
```

> **Supabase Tip**: Always use the **Session Mode Pooler** connection string (`aws-0-*.pooler.supabase.com:5432` with username `postgres.[project-ref]`) to avoid IPv6-only DNS issues (`ENOTFOUND`) on standard IPv4 networks.

### 3. Initialize Database Tables
Run the database schema setup script:
```bash
npm run setup-db
```

### 4. Start the Application
```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

---

## 6. API Reference & Examples

### Health Check
```http
GET /health
```
**Response (`200 OK`):**
```json
{
  "status": "ok",
  "project": "RAG API",
  "version": "0.1.0",
  "timestamp": "2026-11-19T18:00:00.000Z"
}
```

---

### 1. Upload Document (Async Ingestion)
```http
POST /api/documents/upload
Content-Type: multipart/form-data
```
| Field | Type | Description |
|---|---|---|
| `file` | File (`.pdf`) | PDF file to upload and ingest (max 10 MB) |

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/documents/upload \
  -F "file=@document.pdf"
```

**Response (`202 Accepted`):**
```json
{
  "message": "Document uploaded successfully. Processing started.",
  "document": {
    "id": "8225e006-ba94-4bae-b1ba-cec36a2faa86",
    "filename": "document.pdf",
    "status": "PENDING",
    "createdAt": "2026-11-19T17:49:34.997Z"
  }
}
```

---

### 2. List All Documents
```http
GET /api/documents
```

**cURL Example:**
```bash
curl http://localhost:3000/api/documents
```

**Response (`200 OK`):**
```json
{
  "documents": [
    {
      "id": "8225e006-ba94-4bae-b1ba-cec36a2faa86",
      "filename": "document.pdf",
      "status": "COMPLETED",
      "total_chunks": 14,
      "error_message": null,
      "created_at": "2026-11-19T17:49:34.997Z",
      "updated_at": "2026-11-19T17:49:38.210Z"
    }
  ]
}
```

---

### 3. Get Document Details & Status
```http
GET /api/documents/:id
```

**cURL Example:**
```bash
curl http://localhost:3000/api/documents/8225e006-ba94-4bae-b1ba-cec36a2faa86
```

**Response (`200 OK`):**
```json
{
  "document": {
    "id": "8225e006-ba94-4bae-b1ba-cec36a2faa86",
    "filename": "document.pdf",
    "status": "COMPLETED",
    "total_chunks": 14,
    "error_message": null,
    "created_at": "2026-11-19T17:49:34.997Z",
    "updated_at": "2026-11-19T17:49:38.210Z"
  }
}
```

---

### 4. Ask a Question (RAG Q&A)
```http
POST /api/ask
Content-Type: application/json
```

**Request Body:**
```json
{
  "documentId": "8225e006-ba94-4bae-b1ba-cec36a2faa86",
  "question": "What is the primary contribution of this research?"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "documentId": "8225e006-ba94-4bae-b1ba-cec36a2faa86",
    "question": "What is the primary contribution of this research?"
  }'
```

**Response (`200 OK`):**
```json
{
  "answer": "The primary contribution is a novel framework that improves retrieval speed by 40% while preserving context grounding.",
  "sources": [
    {
      "documentName": "document.pdf",
      "pageNumber": 1,
      "excerpt": "This paper introduces a novel framework that improves retrieval speed by 40%..."
    },
    {
      "documentName": "document.pdf",
      "pageNumber": 3,
      "excerpt": "Benchmark results indicate substantial gains in context grounding and accuracy..."
    }
  ]
}
```

**When context is insufficient:**
```json
{
  "answer": "I cannot find sufficient information in the document to answer this question.",
  "sources": []
}
```

---

## 7. Automated Testing

The project includes an end-to-end integration test suite using Node.js's native test runner (`node:test`):

```bash
npm test
```

### Test Coverage Highlights
- ✅ `GET /health` endpoint verification
- ✅ Rejecting missing file uploads (HTTP 400)
- ✅ Rejecting non-PDF file formats (HTTP 400)
- ✅ Valid PDF upload with immediate asynchronous response (HTTP 202)
- ✅ Status polling until background job reaches `COMPLETED`
- ✅ Document listing (`GET /api/documents`)
- ✅ Document retrieval by UUID (`GET /api/documents/:id`)
- ✅ Context-grounded question answering with source citations
- ✅ Anti-hallucination guardrail validation for out-of-context queries
- ✅ Request validation handling (missing fields -> HTTP 400)
- ✅ Missing document error handling (HTTP 404)
- ✅ Corrupted PDF upload failure lifecycle (`FAILED` status with `error_message`)
- ✅ Query blocking on failed documents (HTTP 400)

---

## 8. Deployment Guide

### Deploying to Render / Railway / Fly.io

1. **Environment Variables**: Add all variables from `.env.example` into your cloud provider dashboard:
   - `PORT=3000`
   - `NODE_ENV=production`
   - `AI_PROVIDER=google`
   - `GOOGLE_API_KEY=<your-key>`
   - `GOOGLE_CHAT_MODEL=gemini-3-flash-preview`
   - `GOOGLE_EMBEDDING_MODEL=gemini-embedding-001`
   - `DATABASE_URL=<your-supabase-connection-string>`
2. **Build & Start Commands**:
   - **Build Command**: `npm install`
   - **Pre-deploy / Release Command** (optional): `npm run setup-db`
   - **Start Command**: `npm start`
3. **Health Check Path**: `/health`

---

## 9. License

ISC License. Built by Manas Ranjan.
