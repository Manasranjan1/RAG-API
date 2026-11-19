// One-time database setup script.
// Reads schema.sql and executes it against the configured PostgreSQL database.
//
// Usage:
//   node src/scripts/setup-db.mjs
//
// Run this ONCE after creating your Supabase project and setting DATABASE_URL.
// It is safe to re-run — all statements use IF NOT EXISTS.

import dotenv from "dotenv";
dotenv.config();

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../config/database.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, "../../schema.sql");

async function setupDatabase() {
  if (!process.env.DATABASE_URL) {
    console.error("Error: DATABASE_URL is not set in your .env file.");
    process.exit(1);
  }

  console.log("Reading schema.sql...");
  const sql = await fs.readFile(schemaPath, "utf-8");

  console.log("Connecting to database...");
  const client = await pool.connect();

  try {
    console.log("Running schema...\n");
    await client.query(sql);
    console.log("✅ Database setup complete.");
    console.log("   Tables created: documents, document_chunks");
    console.log("   Extension enabled: vector (pgvector)");
    console.log("   Indexes created: document_id lookup, HNSW embedding search");
  } catch (err) {
    console.error("❌ Database setup failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

setupDatabase();
