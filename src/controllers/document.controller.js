import {
  extractPagesFromPDF,
  summarisePages,
} from "../services/ingestion.service.js";

// ---------------------------------------------------------------------------
// Document Controller — Phase 1
//
// Controllers handle the HTTP layer: reading the request, calling services,
// and writing the response. They contain no business logic themselves.
//
// In Phase 1 we do not store anything in the database yet.
// The upload endpoint extracts text and returns a summary immediately.
// Database persistence and async processing come in Phase 3 and Phase 6.
// ---------------------------------------------------------------------------

/**
 * POST /api/documents/upload
 *
 * Accepts a PDF via multipart/form-data (field name: "file").
 * Extracts text and returns a page-by-page summary.
 *
 * multer has already written the file to uploads/ and populated req.file
 * by the time this handler runs.
 */
export async function uploadDocument(req, res, next) {
  try {
    // multer populates req.file when a file is present and passes validation.
    // If no file was sent at all, req.file is undefined.
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded. Send a PDF in the 'file' field." });
    }

    const { originalname, filename, size, path: filePath } = req.file;

    // Extract text from the PDF — this is the core Phase 1 work.
    const pages = await extractPagesFromPDF(filePath);
    const summary = summarisePages(pages);

    return res.status(200).json({
      message: "PDF uploaded and text extracted successfully.",
      document: {
        originalName: originalname,
        storedAs: filename,
        sizeBytes: size,
        sizeMB: (size / (1024 * 1024)).toFixed(2),
      },
      extraction: summary,
    });
  } catch (err) {
    // Pass unexpected errors to the global error handler (error.middleware.js).
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
