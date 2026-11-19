import { Router } from "express";

const router = Router();

// ---------------------------------------------------------------------------
// Question Routes — Phase 0 stub
//
// Real implementation is added in Phase 5 (RAG and Answer Generation).
// ---------------------------------------------------------------------------

// POST /api/ask  — ask a question about a specific document
router.post("/", (req, res) => {
  res.status(501).json({ message: "Not implemented yet — coming in Phase 5" });
});

export default router;
