import fs from "fs/promises";
import { PDFParse } from "pdf-parse";
import { chunkPages } from "./chunking.service.js";
import { generateEmbeddings } from "./embedding.service.js";
import { updateDocumentStatus, saveChunks } from "./document.service.js";

// ---------------------------------------------------------------------------
// Ingestion Service — Asynchronous Ingestion (Phase 6)
//
// Responsible for:
//   1. Extracting text from uploaded PDF files page by page.
//   2. Managing asynchronous background ingestion:
//      - Transitions: PENDING -> PROCESSING -> COMPLETED | FAILED
//      - Extracts text, splits into chunks, computes embeddings, and stores in DB
//      - Tracks errors and updates database status accordingly
//
// In-Process Background Task Note:
//   Ingestion runs asynchronously using Node.js event-loop scheduling (setImmediate).
//   No external queue infrastructure (Redis, BullMQ) is needed for this portfolio MVP.
//   Known limitation: background jobs running in-process are not durable across
//   application restarts.
// ---------------------------------------------------------------------------

/**
 * Extracts text from a PDF file, returning an array of page objects.
 *
 * @param {string} filePath - Absolute path to the uploaded PDF.
 * @returns {Promise<{ pageNumber: number, text: string }[]>}
 */
export async function extractPagesFromPDF(filePath) {
  const buffer = await fs.readFile(filePath);
  const parser = new PDFParse({ data: buffer });

  let result;
  try {
    result = await parser.getText();
  } finally {
    await parser.destroy();
  }

  if (!result || !result.pages || result.pages.length === 0) {
    throw new Error(
      "Could not extract any text from this PDF. It may be a scanned image-only document."
    );
  }

  const pages = result.pages
    .map((p) => ({
      pageNumber: p.num,
      text: p.text.trim(),
    }))
    .filter((p) => p.text.length > 0);

  if (pages.length === 0) {
    throw new Error(
      "The PDF was parsed but all pages appear to be empty or image-only. No text could be extracted."
    );
  }

  return pages;
}

/**
 * Processes an uploaded document asynchronously in the background.
 *
 * Transitions status:
 *   PENDING -> PROCESSING -> COMPLETED (or FAILED)
 *
 * @param {string} documentId - UUID of the document in PostgreSQL.
 * @param {string} filePath - Absolute path to the uploaded file.
 */
export async function processDocumentAsync(documentId, filePath) {
  console.log(`[Ingestion] Starting background processing for document: ${documentId}`);

  try {
    // 1. Mark as PROCESSING
    await updateDocumentStatus(documentId, { status: "PROCESSING" });

    // 2. Extract text from PDF
    const pages = await extractPagesFromPDF(filePath);
    console.log(`[Ingestion] Extracted ${pages.length} pages for document: ${documentId}`);

    // 3. Chunk the text
    const chunks = await chunkPages(pages);
    console.log(`[Ingestion] Generated ${chunks.length} chunks for document: ${documentId}`);

    // 4. Generate embeddings
    const chunkTexts = chunks.map((c) => c.pageContent);
    const vectors = await generateEmbeddings(chunkTexts);
    console.log(`[Ingestion] Computed embeddings for document: ${documentId}`);

    // 5. Save chunks and embeddings into PostgreSQL
    await saveChunks(documentId, chunks, vectors);

    // 6. Mark as COMPLETED
    await updateDocumentStatus(documentId, {
      status: "COMPLETED",
      totalChunks: chunks.length,
    });

    console.log(`[Ingestion] Successfully completed ingestion for document: ${documentId}`);
  } catch (err) {
    console.error(`[Ingestion Error] Failed processing document ${documentId}:`, err.message);

    // Record failure in the database with error message
    try {
      await updateDocumentStatus(documentId, {
        status: "FAILED",
        errorMessage: err.message,
      });
    } catch (dbErr) {
      console.error(`[Ingestion Error] Failed to update FAILED status in database:`, dbErr.message);
    }
  }
}
