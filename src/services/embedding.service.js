// ---------------------------------------------------------------------------
// Embedding Service
//
// This module is the single place where text is turned into embedding vectors.
// It wraps the `embeddings` instance from ai.js so that the rest of the
// application never imports the AI config directly.
//
// Why lazy-load ai.js?
//   ai.js uses top-level await to initialize the provider. If we statically
//   imported it at the top of this file, Node.js would execute that code the
//   moment this module is first loaded — which happens at server startup.
//   That would force the user to have a valid API key even before making any
//   requests.
//
//   With a lazy dynamic import, ai.js is only initialized when the first
//   embedding request actually arrives. The server starts cleanly without
//   any API keys configured; a missing key surfaces as a clear 500 error
//   on the first request rather than crashing the server on boot.
//
// ES module caching:
//   Node.js caches imported modules in its module registry. After the first
//   `import('../config/ai.js')` call resolves, every subsequent call returns
//   the same cached module instantly — no re-initialization, no extra API
//   calls. The `_aiModule` variable is just a local reference to that cache.
// ---------------------------------------------------------------------------

let _aiModule = null;

async function getAIModule() {
  if (!_aiModule) {
    _aiModule = await import("../config/ai.js");
  }
  return _aiModule;
}

/**
 * Generates embedding vectors for an array of text strings.
 *
 * Uses the embedding model configured in ai.js (Gemini or OpenAI,
 * depending on AI_PROVIDER env var).
 *
 * @param {string[]} texts  - Array of text strings to embed.
 * @returns {Promise<number[][]>}  - Array of embedding vectors (one per input text).
 *
 * @example
 * const vectors = await generateEmbeddings(["hello world", "foo bar"]);
 * console.log(vectors.length);     // 2
 * console.log(vectors[0].length);  // 768 (Gemini) or 1536 (OpenAI)
 */
export async function generateEmbeddings(texts) {
  if (!texts || texts.length === 0) {
    return [];
  }

  const { embeddings } = await getAIModule();

  // embedDocuments() sends all texts to the embedding API in a single
  // (or batched) call and returns a parallel array of vectors.
  const vectors = await embeddings.embedDocuments(texts);
  return vectors;
}

/**
 * Generates a single embedding vector for a query string.
 * Used during question answering (Phase 4) to embed the user's question.
 *
 * embedQuery() may use a different internal prompt than embedDocuments()
 * on some providers (e.g., Gemini uses "RETRIEVAL_QUERY" vs "RETRIEVAL_DOCUMENT"
 * task types), which can improve retrieval accuracy.
 *
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export async function generateQueryEmbedding(text) {
  const { embeddings } = await getAIModule();
  const vector = await embeddings.embedQuery(text);
  return vector;
}
