import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { getDocumentById } from "./document.service.js";
import { retrieveSimilarChunks } from "./retrieval.service.js";

// ---------------------------------------------------------------------------
// RAG Service — Answer Generation (Phase 5)
//
// This service orchestrates the full Retrieval-Augmented Generation pipeline:
//   1. Validates document existence and ingestion status.
//   2. Performs semantic retrieval using pgvector to fetch top relevant chunks.
//   3. Constructs a strictly grounded prompt with context excerpts and citations.
//   4. Calls the configured LLM (Gemini / OpenAI via LangChain.js).
//   5. Returns the grounded answer along with source document citations.
//
// Guard against hallucination:
//   The prompt strictly instructs the LLM to answer using ONLY the context.
//   If the context lacks sufficient information, the model is instructed to
//   state that clearly rather than inventing an answer.
// ---------------------------------------------------------------------------

let _aiModule = null;

async function getChatModel() {
  if (!_aiModule) {
    _aiModule = await import("../config/ai.js");
  }
  return _aiModule.chatModel;
}

/**
 * Answers a user's question based on the content of a specific document.
 *
 * @param {string} documentId - UUID of the target document.
 * @param {string} question - Question asked by the user.
 * @returns {Promise<{ answer: string, sources: Array<{ documentName: string, pageNumber: number, excerpt: string }> }>}
 */
export async function answerQuestion(documentId, question) {
  if (!documentId) {
    const error = new Error("documentId is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!question || typeof question !== "string" || question.trim().length === 0) {
    const error = new Error("question is required.");
    error.statusCode = 400;
    throw error;
  }

  const cleanQuestion = question.trim();

  // 1. Verify document exists
  const doc = await getDocumentById(documentId);
  if (!doc) {
    const error = new Error(`Document with id "${documentId}" not found.`);
    error.statusCode = 404;
    throw error;
  }

  if (doc.status !== "COMPLETED") {
    const error = new Error(
      `Document "${doc.filename}" is currently ${doc.status}. Please wait until ingestion is COMPLETED.`
    );
    error.statusCode = 400;
    throw error;
  }

  // 2. Retrieve top-k semantically relevant chunks (k=4)
  const chunks = await retrieveSimilarChunks(documentId, cleanQuestion, 4);

  if (!chunks || chunks.length === 0) {
    return {
      answer: "I cannot find sufficient information in the document to answer this question.",
      sources: [],
    };
  }

  // 3. Format context with page citations
  const contextSections = chunks.map((chunk, index) => {
    const pageLabel = chunk.pageNumber ? `Page ${chunk.pageNumber}` : "Unknown Page";
    return `[Passage ${index + 1} - ${pageLabel}]:\n${chunk.content}`;
  });
  const contextText = contextSections.join("\n\n");

  // 4. Construct grounded system and human prompt messages
  const systemPrompt = `You are a concise and helpful document question-answering assistant.
Your task is to answer the user's question using ONLY the provided document context below.

Strict rules:
1. Base your answer strictly on the provided context passages. Do not assume or extrapolate.
2. If the context does not contain sufficient information to answer the question, state: "I cannot find sufficient information in the document to answer this question."
3. Keep your response direct, factual, and clear.`;

  const userPrompt = `Document Context:
${contextText}

Question: ${cleanQuestion}`;

  // 5. Invoke the configured Chat Model
  const chatModel = await getChatModel();
  const response = await chatModel.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt),
  ]);

  const answer =
    typeof response.content === "string"
      ? response.content.trim()
      : Array.isArray(response.content)
      ? response.content.map((c) => c.text || "").join("").trim()
      : String(response.content).trim();

  // 6. Build source citations
  const sources = chunks.map((c) => ({
    documentName: doc.filename,
    pageNumber: c.pageNumber,
    excerpt: c.content,
  }));

  return {
    answer,
    sources,
  };
}
