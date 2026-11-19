import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";

// ---------------------------------------------------------------------------
// Chunking
//
// Why chunk at all?
//   Embedding models have a token limit (e.g., text-embedding-004 accepts up
//   to 2 048 tokens). More importantly, smaller, focused chunks produce better
//   retrieval results — a 10-page PDF embedded as one giant vector loses all
//   fine-grained meaning. Chunking lets us pinpoint the exact passage that
//   answers a question.
//
// Why RecursiveCharacterTextSplitter?
//   It tries to split on natural boundaries in this order:
//     "\n\n"  → paragraph breaks  (best)
//     "\n"    → line breaks
//     " "     → word boundaries
//     ""      → character-level   (last resort)
//   This keeps semantically related sentences together as long as possible.
//
// Why chunk overlap?
//   A sentence that falls at the boundary of two chunks would be split and
//   lose context. Overlap duplicates a small portion of text across adjacent
//   chunks so no idea is "cut off" at the edges.
// ---------------------------------------------------------------------------

/**
 * Splits an array of page objects into LangChain Document chunks.
 *
 * Each output chunk is a LangChain `Document` with:
 *   - `pageContent`: the chunk text
 *   - `metadata.pageNumber`: the source page number (inherited from the input page)
 *
 * @param {{ pageNumber: number, text: string }[]} pages
 * @returns {Promise<Document[]>}
 */
export async function chunkPages(pages) {
  const chunkSize = parseInt(process.env.CHUNK_SIZE || "1000", 10);
  const chunkOverlap = parseInt(process.env.CHUNK_OVERLAP || "200", 10);

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
  });

  // Wrap each page in a LangChain Document.
  // splitDocuments() propagates metadata to every child chunk automatically,
  // so each chunk remembers which page it came from.
  const documents = pages.map(
    (p) =>
      new Document({
        pageContent: p.text,
        metadata: { pageNumber: p.pageNumber },
      })
  );

  const chunks = await splitter.splitDocuments(documents);
  return chunks;
}
