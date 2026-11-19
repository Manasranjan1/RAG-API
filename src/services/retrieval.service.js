import pool from "../config/database.js";
import { generateQueryEmbedding } from "./embedding.service.js";

// ---------------------------------------------------------------------------
// Retrieval Service — Semantic Search (Phase 4)
//
// This service takes a user question and a document ID, embeds the question
// into the same 768-dimensional semantic space as the stored chunks, and queries
// pgvector for the most semantically relevant chunks.
//
// Cosine Distance (<=>):
//   In pgvector, <=> computes cosine distance.
//   Distance = 1 - CosineSimilarity.
//   Smaller distance = higher semantic similarity.
//   Ordering by `embedding <=> $1::vector ASC` fetches nearest neighbors first.
//
// Scoping:
//   The query filters by `document_id = $2` to ensure retrieval is strictly
//   confined to the document selected by the user.
// ---------------------------------------------------------------------------

/**
 * Searches for the most relevant chunks in a document given a user question.
 *
 * @param {string} documentId - UUID of the target document.
 * @param {string} question - The user query or question.
 * @param {number} [limit=4] - Max number of relevant chunks to retrieve.
 * @returns {Promise<Array<{ id: string, documentId: string, content: string, pageNumber: number, similarity: number, distance: number }>>}
 */
export async function retrieveSimilarChunks(documentId, question, limit = 4) {
  if (!documentId) {
    throw new Error("documentId is required for retrieval.");
  }
  if (!question || typeof question !== "string" || question.trim().length === 0) {
    throw new Error("A valid question string is required for retrieval.");
  }

  // 1. Convert user question into a vector using the configured embedding model
  const queryEmbedding = await generateQueryEmbedding(question.trim());

  // 2. Format JS array into pgvector literal format: '[0.1,0.2,...]'
  const vectorString = `[${queryEmbedding.join(",")}]`;

  // 3. Perform vector similarity search scoped to the documentId
  const query = `
    SELECT 
      id,
      document_id,
      content,
      page_number,
      (embedding <=> $1::vector) AS distance,
      (1 - (embedding <=> $1::vector)) AS similarity
    FROM document_chunks
    WHERE document_id = $2
    ORDER BY embedding <=> $1::vector ASC
    LIMIT $3;
  `;

  const result = await pool.query(query, [vectorString, documentId, limit]);

  return result.rows.map((row) => ({
    id: row.id,
    documentId: row.document_id,
    content: row.content,
    pageNumber: row.page_number,
    distance: parseFloat(row.distance),
    similarity: parseFloat(row.similarity),
  }));
}
