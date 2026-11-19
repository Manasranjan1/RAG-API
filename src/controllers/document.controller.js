import { processDocumentAsync } from "../services/ingestion.service.js";
import {
  createDocument,
  getAllDocuments,
  getDocumentById,
} from "../services/document.service.js";

// ---------------------------------------------------------------------------
// Document Controller — Asynchronous Ingestion (Phase 6)
//
// The upload endpoint now responds immediately:
//   1. Inserts document record with status 'PENDING'.
//   2. Dispatches asynchronous background processing (extract -> chunk -> embed -> store).
//   3. Returns HTTP 202 Accepted without keeping the client waiting.
//
// Clients can poll GET /api/documents/:id to observe status transitions:
//   PENDING -> PROCESSING -> COMPLETED | FAILED
// ---------------------------------------------------------------------------

/**
 * POST /api/documents/upload
 *
 * Accepts a PDF via multipart/form-data (field name: "file").
 * Creates a document entry and starts background ingestion asynchronously.
 */
export async function uploadDocument(req, res, next) {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: "No file uploaded. Send a PDF in the 'file' field." });
    }

    const { originalname, path: filePath } = req.file;

    // 1. Create document record with status PENDING
    const doc = await createDocument(originalname);

    // 2. Dispatch background processing asynchronously using setImmediate
    // This allows the response to be sent immediately while processing continues
    setImmediate(() => {
      processDocumentAsync(doc.id, filePath);
    });

    // 3. Return 202 Accepted with document metadata
    return res.status(202).json({
      message: "Document uploaded successfully. Processing started.",
      document: {
        id: doc.id,
        filename: doc.filename,
        status: doc.status,
        createdAt: doc.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/documents
 * Lists all documents and their ingestion statuses.
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
 * Returns details and ingestion status for a single document.
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
