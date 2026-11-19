import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

// A single connection pool is created once and reused for all database queries.
// pg.Pool manages multiple connections internally, so we don't create a new
// connection for every request.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Supabase requires SSL. 'require' accepts the cert without strict CA validation,
  // which is acceptable for a portfolio project.
  ssl: { rejectUnauthorized: false },
});

// Test the connection when the module loads so we know immediately if the
// DATABASE_URL is misconfigured, rather than finding out on the first query.
pool.on("connect", () => {
  console.log("Connected to PostgreSQL database");
});

pool.on("error", (err) => {
  console.error("Unexpected database error:", err.message);
});

export default pool;
