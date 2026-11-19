import express from "express";
import documentRoutes from "./routes/document.routes.js";
import questionRoutes from "./routes/question.routes.js";
import errorMiddleware from "./middleware/error.middleware.js";

const app = express();

// ---------------------------------------------------------------------------
// Built-in Middleware
//
// express.json() parses incoming JSON request bodies so req.body is populated.
// express.urlencoded() handles HTML form-encoded bodies (also needed for
// some multipart form clients).
// ---------------------------------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------------------------------------
// Health Check
//
// A simple GET / route that returns status 200 with basic metadata.
// Useful for confirming the server is alive and for infrastructure health
// probes (e.g., Render, Railway, Fly.io).
// ---------------------------------------------------------------------------
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    project: "RAG API",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------
app.use("/api/documents", documentRoutes);
app.use("/api/ask", questionRoutes);

// ---------------------------------------------------------------------------
// 404 Handler
//
// Catches any request that did not match a registered route.
// Must come after all routes.
// ---------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ---------------------------------------------------------------------------
// Global Error Handler
//
// Must come last. Any error passed to next(err) lands here.
// ---------------------------------------------------------------------------
app.use(errorMiddleware);

export default app;
