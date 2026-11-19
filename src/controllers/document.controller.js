import { extractPagesFromPDF } from "../services/ingestion.service.js";
import { chunkPages } from "../services/chunking.service.js";
import { generateEmbeddings } from "../services/embedding.service.js";

// ---------------------------------------------------------------------------
// Document Controller — Phase 2
//
// The upload endpoint now runs the full pipeline synchronously:
//   extract text → chunk → generate embeddings → return verification response.
//
// No database storage yet — that comes in Phase 3.
// Asynchronous ingestion (immediate response + background processing) comes
// in Phase 6. For now, the endpoint waits for the entire pipeline to finish
// before responding, which is fine for verification purposes.
// ---------------------------------------------------------------------------

/**
 * POST /api/documents/upload
 *
 * Accepts a PDF via multipart/form-data (field name: "file").
 * Runs the full ingestion pipeline and returns a verification summary.
 */
export async function uploadDocument(req, res, next) {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: "No file uploaded. Send a PDF in the 'file' field." });
    }

    const { originalname, filename, size, path: filePath } = req.file;

    // ── Step 1: Extract text from PDF (Phase 1) ──────────────────────────
    const pages = await extractPagesFromPDF(filePath);

    // ── Step 2: Split pages into chunks (Phase 2) ─────────────────────────
    const chunks = await chunkPages(pages);

    // ── Step 3: Generate embedding vectors (Phase 2) ──────────────────────
    // Extract just the text from each chunk to pass to the embedding model.
    const chunkTexts = chunks.map((c) => c.pageContent);
    const vectors = await generateEmbeddings(chunkTexts);

    // ── Build verification response ───────────────────────────────────────
    // We show enough detail to confirm the pipeline is working correctly
    // without sending the full vectors (768 floats × N chunks = very large).
    return res.status(200).json({
      message: "PDF processed successfully. Ready for database storage (Phase 3).",
      document: {
        originalName: originalname,
        storedAs: filename,
        sizeBytes: size,
        sizeMB: (size / (1024 * 1024)).toFixed(2),
      },
      pipeline: {
        pages: pages.length,
        chunks: chunks.length,
        embeddingDimensions: vectors[0]?.length ?? 0,
        chunkSize: parseInt(process.env.CHUNK_SIZE || "1000", 10),
        chunkOverlap: parseInt(process.env.CHUNK_OVERLAP || "200", 10),
      },
      // Show a preview of each chunk so it's easy to inspect in Postman.
      // pageNumber is the original source page, preserved through the splitter.
      chunkPreviews: chunks.map((chunk, i) => ({
        chunkIndex: i + 1,
        pageNumber: chunk.metadata.pageNumber,
        characterCount: chunk.pageContent.length,
        excerpt:
          chunk.pageContent.length > 150
            ? chunk.pageContent.slice(0, 150) + "…"
            : chunk.pageContent,
        // Show first 6 dims so it's clear the vector is real but keep response small.
        embeddingPreview: vectors[i]?.slice(0, 6).map((v) => parseFloat(v.toFixed(6))),
      })),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/documents
 *
 * Returns all uploaded documents.
 * Stub in Phase 1 — will be implemented once the database is in place (Phase 3).
 */
export async function listDocuments(req, res) {
  res.status(501).json({ message: "Not implemented yet — coming in Phase 3" });
}

/**
 * GET /api/documents/:id
 *
 * Returns details for a single document.
 * Stub in Phase 1 — will be implemented once the database is in place (Phase 3).
 */
export async function getDocument(req, res) {
  res.status(501).json({ message: "Not implemented yet — coming in Phase 3" });
}
