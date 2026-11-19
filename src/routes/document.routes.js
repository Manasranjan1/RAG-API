import { Router } from "express";
import upload from "../middleware/upload.middleware.js";
import {
  uploadDocument,
  listDocuments,
  getDocument,
} from "../controllers/document.controller.js";

const router = Router();

// ---------------------------------------------------------------------------
// Document Routes — Phase 1
//
// multer's upload.single("file") middleware runs before the controller:
//   1. Reads the multipart/form-data request.
//   2. Validates the file type and size (rejects non-PDFs, rejects > 10 MB).
//   3. Writes the file to uploads/ and populates req.file.
//   4. If validation fails, multer calls next(err) which hits our global
//      error handler in error.middleware.js.
//
// "file" is the expected form-data field name. The Postman request must use
// this same field name when attaching the PDF.
// ---------------------------------------------------------------------------

// POST /api/documents/upload  — upload a PDF and extract text
router.post("/upload", upload.single("file"), uploadDocument);

// GET /api/documents          — list all documents (Phase 3)
router.get("/", listDocuments);

// GET /api/documents/:id      — get one document by ID (Phase 3)
router.get("/:id", getDocument);

export default router;
