import { extractPagesFromPDF } from "../services/ingestion.service.js";
import { chunkPages } from "../services/chunking.service.js";
import { generateEmbeddings } from "../services/embedding.service.js";
import {
  createDocument,
  updateDocumentStatus,
  saveChunks,
  getAllDocuments,
  getDocumentById,
} from "../services/document.service.js";

// ---------------------------------------------------------------------------
// Document Controller — Phase 3
//
// The upload flow now persists to PostgreSQL:
//
//   1. Create a document row (status: PENDING)
//   2. Extract text from the PDF
//   3. Chunk the text
//   4. Generate embeddings
//   5. Save all chunks + vectors to document_chunks
//   6. Update document status to COMPLETED
//   7. Return the document ID and status
//
// The flow is still synchronous in Phase 3 — the response is sent only after
// the entire pipeline finishes. Async (background) ingestion comes in Phase 6.
//
// Error handling:
//   If anything fails after the document row is created, we update the
//   document status to FAILED with an error message, then re-throw so the
//   global error handler can respond with a 500. This keeps the database
//   consistent and lets the client call GET /api/documents/:id to see why
//   processing failed.
// ---------------------------------------------------------------------------

/**
 * POST /api/documents/upload
 */
export async function uploadDocument(req, res, next) {
  // documentId is set as soon as we insert the row so we can update status
  // to FAILED even if an error occurs mid-pipeline.
  let documentId = null;

  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: "No file uploaded. Send a PDF in the 'file' field." });
    }

    const { originalname, path: filePath } = req.file;

    // ── Step 1: Create document row (status: PENDING) ─────────────────────
    const doc = await createDocument(originalname);
    documentId = doc.id;

    // ── Step 2: Mark as PROCESSING ────────────────────────────────────────
    await updateDocumentStatus(documentId, { status: "PROCESSING" });

    // ── Step 3: Extract text from PDF ─────────────────────────────────────
    const pages = await extractPagesFromPDF(filePath);

    // ── Step 4: Chunk the text ────────────────────────────────────────────
    const chunks = await chunkPages(pages);

    // ── Step 5: Generate embeddings ───────────────────────────────────────
    const chunkTexts = chunks.map((c) => c.pageContent);
    const vectors = await generateEmbeddings(chunkTexts);

    // ── Step 6: Save chunks + embeddings to database ──────────────────────
    await saveChunks(documentId, chunks, vectors);

    // ── Step 7: Mark as COMPLETED ─────────────────────────────────────────
    const completed = await updateDocumentStatus(documentId, {
      status: "COMPLETED",
      totalChunks: chunks.length,
    });

    return res.status(201).json({
      message: "Document uploaded and processed successfully.",
      document: {
        id: completed.id,
        filename: completed.filename,
        status: completed.status,
        totalChunks: completed.total_chunks,
        createdAt: completed.created_at,
      },
    });
  } catch (err) {
    // If we already created a document row, mark it as FAILED so the client
    // can inspect what went wrong via GET /api/documents/:id.
    if (documentId) {
      await updateDocumentStatus(documentId, {
        status: "FAILED",
        errorMessage: err.message,
      }).catch(() => {}); // Ignore secondary DB errors during error handling
    }
    next(err);
  }
}

/**
 * GET /api/documents
 * Lists all documents with their current status.
 */
export async function listDocuments(req, res, next) {
  try {
    const documents = await getAllDocuments();
    return res.json({ documents });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/documents/:id
 * Returns details for a single document.
 */
export async function getDocument(req, res, next) {
  try {
    const doc = await getDocumentById(req.params.id);

    if (!doc) {
      return res
        .status(404)
        .json({ error: `Document with id "${req.params.id}" not found.` });
    }

    return res.json({ document: doc });
  } catch (err) {
    next(err);
  }
}
