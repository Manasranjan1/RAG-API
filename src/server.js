import dotenv from "dotenv";
dotenv.config();

// Import app only — the AI config is intentionally NOT imported here in Phase 0.
// It will be imported once needed in Phase 2+.
// This keeps the server startable even before AI keys are configured.
import app from "./app.js";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`RAG API server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
