import pool from "../config/database.js";

// ---------------------------------------------------------------------------
// Document Service — Database Operations
//
// This module owns all SQL queries for the `documents` and `document_chunks`
// tables. No SQL lives anywhere else in the application.
//
// Every function uses the shared `pool` from database.js which manages a
// connection pool internally — we never create raw connections here.
// ---------------------------------------------------------------------------

/**
 * Inserts a new document row with status PENDING.
 * Called at the very start of the upload flow, before any processing begins.
 *
 * @param {string} filename  - The original PDF filename.
 * @returns {Promise<object>} - The newly inserted document row.
 */
export async function createDocument(filename) {
  const result = await pool.query(
    `INSERT INTO documents (filename, status)
     VALUES ($1, 'PENDING')
     RETURNING *`,
    [filename]
  );
  return result.rows[0];
}

/**
 * Updates a document's status and optional metadata.
 * Used to transition: PENDING → PROCESSING → COMPLETED | FAILED.
 *
 * @param {string} id
 * @param {{ status: string, totalChunks?: number, errorMessage?: string }} fields
 * @returns {Promise<object>}
 */
export async function updateDocumentStatus(id, { status, totalChunks, errorMessage }) {
  const result = await pool.query(
    `UPDATE documents
     SET status        = $1,
         total_chunks  = $2,
         error_message = $3,
         updated_at    = NOW()
     WHERE id = $4
     RETURNING *`,
    [status, totalChunks ?? null, errorMessage ?? null, id]
  );
  return result.rows[0];
}

/**
 * Bulk-inserts all chunks and their embedding vectors for a document.
 *
 * We build a single parameterised INSERT instead of one query per chunk.
 * This is significantly faster because it makes one round-trip to the
 * database rather than N round-trips (one per chunk).
 *
 * pgvector format: the embedding column expects a string like "[0.1,0.2,…]".
 * We format each JavaScript number[] into that string before passing it as a
 * parameter, then cast it with ::vector in the SQL so PostgreSQL knows the type.
 *
 * @param {string}   documentId
 * @param {import('@langchain/core/documents').Document[]} chunks  - LangChain Document objects
 * @param {number[][]} vectors  - Parallel array of embedding vectors
 */
export async function saveChunks(documentId, chunks, vectors) {
  if (chunks.length === 0) return;

  // Build the VALUES clause dynamically:
  //   ($1, $2, $3::vector, $4), ($5, $6, $7::vector, $8), ...
  const valuePlaceholders = [];
  const params = [];

  chunks.forEach((chunk, i) => {
    // Each chunk occupies 4 parameters: document_id, content, embedding, page_number
    const base = i * 4;
    valuePlaceholders.push(
      `($${base + 1}, $${base + 2}, $${base + 3}::vector, $${base + 4})`
    );
    params.push(
      documentId,
      chunk.pageContent,
      `[${vectors[i].join(",")}]`, // Format JS array → pgvector string "[x,y,z,…]"
      chunk.metadata.pageNumber ?? null
    );
  });

  await pool.query(
    `INSERT INTO document_chunks (document_id, content, embedding, page_number)
     VALUES ${valuePlaceholders.join(", ")}`,
    params
  );
}

/**
 * Returns all documents ordered by most recently created first.
 *
 * @returns {Promise<object[]>}
 */
export async function getAllDocuments() {
  const result = await pool.query(
    `SELECT id, filename, status, total_chunks, error_message, created_at, updated_at
     FROM documents
     ORDER BY created_at DESC`
  );
  return result.rows;
}

/**
 * Returns a single document by its UUID.
 * Returns null if not found.
 *
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getDocumentById(id) {
  const result = await pool.query(
    `SELECT id, filename, status, total_chunks, error_message, created_at, updated_at
     FROM documents
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}
