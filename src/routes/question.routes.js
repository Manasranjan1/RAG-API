import { Router } from "express";
import { askQuestion } from "../controllers/question.controller.js";

const router = Router();

// ---------------------------------------------------------------------------
// Question Routes — Phase 5
//
// POST /api/ask  — ask a question about an ingested document using RAG
// ---------------------------------------------------------------------------

router.post("/", askQuestion);

export default router;
