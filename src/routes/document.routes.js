import { Router } from "express";

const router = Router();

// ---------------------------------------------------------------------------
// Document Routes — Phase 0 stubs
//
// These routes return placeholder responses so the router is wired up
// correctly from the start. Real implementations are added in Phase 1.
// ---------------------------------------------------------------------------

// POST /api/documents/upload  — upload a PDF and start ingestion
router.post("/upload", (req, res) => {
  res.status(501).json({ message: "Not implemented yet — coming in Phase 1" });
});

// GET /api/documents  — list all uploaded documents and their statuses
router.get("/", (req, res) => {
  res.status(501).json({ message: "Not implemented yet — coming in Phase 1" });
});

// GET /api/documents/:id  — get a single document's details and status
router.get("/:id", (req, res) => {
  res.status(501).json({ message: "Not implemented yet — coming in Phase 1" });
});

export default router;
