-- =============================================================
-- RAG API — Database Schema
-- =============================================================
-- Run this in Supabase SQL Editor (or via npm run setup-db).
-- Safe to run multiple times (uses IF NOT EXISTS).
-- =============================================================

-- Step 1: Enable pgvector extension
-- pgvector adds the `vector` data type and similarity search operators.
-- Supabase supports this natively — just run the CREATE EXTENSION.
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================
-- Table: documents
--
-- Stores metadata for each uploaded PDF.
-- Processing status is tracked here so the API can report
-- whether ingestion is pending, running, complete, or failed.
-- =============================================================
CREATE TABLE IF NOT EXISTS documents (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  filename    TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'PENDING',
    -- Allowed values: PENDING | PROCESSING | COMPLETED | FAILED
  total_chunks INTEGER,
    -- Set after all chunks are stored successfully.
  error_message TEXT,
    -- Populated only when status = 'FAILED'.
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- Table: document_chunks
--
-- Stores the individual text chunks extracted from each PDF,
-- along with their 768-dimensional embedding vector.
--
-- Relationship: one document → many document_chunks.
-- ON DELETE CASCADE ensures chunks are removed when the parent
-- document is deleted (no orphaned chunk rows).
-- =============================================================
CREATE TABLE IF NOT EXISTS document_chunks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL,
  embedding   vector(768),
    -- 768 dimensions matches gemini-embedding-001 with outputDimensionality=768.
    -- If you switch embedding models, drop and recreate this table and
    -- re-ingest all documents.
  page_number INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- Indexes
-- =============================================================

-- Fast lookup of all chunks belonging to a document.
-- Used in the retrieval query (Phase 4) to scope search to one document.
CREATE INDEX IF NOT EXISTS idx_chunks_document_id
  ON document_chunks(document_id);

-- HNSW index for approximate nearest-neighbour (ANN) vector search.
--
-- Why HNSW over IVFFlat?
--   IVFFlat requires a training step (must have data before creating the index).
--   HNSW builds incrementally as rows are inserted — no training required.
--   HNSW also provides better recall and query speed at the cost of slightly
--   more memory, which is acceptable for a portfolio project.
--
-- vector_cosine_ops → uses cosine distance (<=>).
-- Cosine similarity is preferred for text embeddings because it measures
-- the angle between vectors (semantic direction) rather than their magnitude.
CREATE INDEX IF NOT EXISTS idx_chunks_embedding
  ON document_chunks
  USING hnsw (embedding vector_cosine_ops);
