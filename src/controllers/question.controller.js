import { answerQuestion } from "../services/rag.service.js";

// ---------------------------------------------------------------------------
// Question Controller — Phase 5
//
// Handles question answering endpoint:
// POST /api/ask
// Request Body: { "documentId": "uuid", "question": "..." }
// Response Body: { "answer": "...", "sources": [ { "documentName": "...", "pageNumber": 1, "excerpt": "..." } ] }
// ---------------------------------------------------------------------------

/**
 * POST /api/ask
 * Asks a question about a specific ingested document.
 */
export async function askQuestion(req, res, next) {
  try {
    const { documentId, question } = req.body || {};

    if (!documentId) {
      return res.status(400).json({ error: "Field 'documentId' is required in request body." });
    }

    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return res.status(400).json({ error: "Field 'question' is required in request body." });
    }

    const result = await answerQuestion(documentId, question);

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
