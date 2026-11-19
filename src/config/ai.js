import dotenv from "dotenv";
dotenv.config();

// ---------------------------------------------------------------------------
// AI Provider Configuration Layer
//
// This module is the single place where AI models and embedding instances are
// created. All other modules import the ready-to-use `chatModel` and
// `embeddings` exports — they never know which provider is active.
//
// To switch providers: change AI_PROVIDER in .env and restart.
// No RAG pipeline code needs to change.
//
// Supported values for AI_PROVIDER:
//   google  — Google Gemini (default, free-tier API)
//   openai  — OpenAI GPT
// ---------------------------------------------------------------------------

const provider = process.env.AI_PROVIDER || "google";

let chatModel;
let embeddings;

if (provider === "google") {
  // Only import Google packages when the provider is "google".
  // This avoids loading OpenAI SDK (and requiring an OpenAI key) unnecessarily.
  const { ChatGoogleGenerativeAI } = await import("@langchain/google-genai");
  const { GoogleGenerativeAIEmbeddings } = await import(
    "@langchain/google-genai"
  );

  if (!process.env.GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY is required when AI_PROVIDER=google");
  }

  // text-embedding-004 produces 768-dimensional vectors.
  // The database schema uses vector(768). Keep these in sync.
  chatModel = new ChatGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_API_KEY,
    model: process.env.GOOGLE_CHAT_MODEL || "gemini-1.5-flash",
    temperature: 0.2, // Lower temperature = more factual, less creative answers
  });

  embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY,
    model: process.env.GOOGLE_EMBEDDING_MODEL || "text-embedding-004",
  });

  console.log(`AI Provider: Google Gemini`);
  console.log(`  Chat model:      ${process.env.GOOGLE_CHAT_MODEL || "gemini-1.5-flash"}`);
  console.log(`  Embedding model: ${process.env.GOOGLE_EMBEDDING_MODEL || "text-embedding-004"} (768 dims)`);
} else if (provider === "openai") {
  const { ChatOpenAI } = await import("@langchain/openai");
  const { OpenAIEmbeddings } = await import("@langchain/openai");

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required when AI_PROVIDER=openai");
  }

  // text-embedding-3-small produces 1536-dimensional vectors.
  // If switching from Google, the database vector column size must be updated
  // and all document embeddings must be regenerated.
  chatModel = new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
    temperature: 0.2,
  });

  embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
  });

  console.log(`AI Provider: OpenAI`);
  console.log(`  Chat model:      ${process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini"}`);
  console.log(`  Embedding model: ${process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small"} (1536 dims)`);
} else {
  throw new Error(
    `Unknown AI_PROVIDER "${provider}". Supported values: google, openai`
  );
}

export { chatModel, embeddings };
