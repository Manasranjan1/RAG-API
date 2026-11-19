import test, { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import FormData from "form-data";
import http from "http";
import app from "../src/app.js";
import pool from "../src/config/database.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let server;
let baseUrl;

// Helper: HTTP POST with FormData (multipart)
function postForm(url, formData) {
  return new Promise((resolve, reject) => {
    const { hostname, port, pathname } = new URL(url);
    const headers = formData.getHeaders();
    formData.getLength((err, length) => {
      if (!err && length) headers["Content-Length"] = length;
      const req = http.request(
        { hostname, port, path: pathname, method: "POST", headers },
        (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => {
            try {
              resolve({ status: res.statusCode, body: JSON.parse(body) });
            } catch {
              resolve({ status: res.statusCode, body });
            }
          });
        }
      );
      req.on("error", reject);
      formData.pipe(req);
    });
  });
}

// Helper: HTTP POST with JSON body
function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    const { hostname, port, pathname } = new URL(url);
    const bodyStr = JSON.stringify(payload);
    const headers = {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(bodyStr),
    };
    const req = http.request(
      { hostname, port, path: pathname, method: "POST", headers },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, body });
          }
        });
      }
    );
    req.on("error", reject);
    req.write(bodyStr);
    req.end();
  });
}

// Helper: HTTP GET
function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    }).on("error", reject);
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe("Async Document Intelligence (RAG API) - Automated Test Suite", () => {
  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://localhost:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  });

  it("1. Health Check - GET /health returns 200 and ok status", async () => {
    const res = await get(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "ok");
    assert.equal(res.body.project, "RAG API");
  });

  it("2. Upload Validation - POST /api/documents/upload rejects request with missing file", async () => {
    const form = new FormData();
    form.append("dummy", "value");
    const res = await postForm(`${baseUrl}/api/documents/upload`, form);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /No file uploaded/);
  });

  it("3. Upload Validation - POST /api/documents/upload rejects non-PDF file type", async () => {
    const form = new FormData();
    form.append("file", Buffer.from("Hello world"), {
      filename: "notes.txt",
      contentType: "text/plain",
    });
    const res = await postForm(`${baseUrl}/api/documents/upload`, form);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Only PDF files are accepted/);
  });

  let validDocId;

  it("4. Asynchronous PDF Upload - POST /api/documents/upload accepts valid PDF with 202 status", async () => {
    const pdfPath = path.join(__dirname, "../uploads/test_sample.pdf");
    const form = new FormData();
    form.append("file", fs.createReadStream(pdfPath), {
      filename: "test_sample.pdf",
      contentType: "application/pdf",
    });

    const res = await postForm(`${baseUrl}/api/documents/upload`, form);
    assert.equal(res.status, 202);
    assert.ok(res.body.document?.id);
    assert.equal(res.body.document.status, "PENDING");
    validDocId = res.body.document.id;
  });

  it("5. Ingestion State Tracking - Polls until status transitions to COMPLETED", async () => {
    assert.ok(validDocId, "Valid document ID required from upload test");
    let completed = false;

    for (let i = 0; i < 20; i++) {
      await sleep(1500);
      const res = await get(`${baseUrl}/api/documents/${validDocId}`);
      if (res.body.document?.status === "COMPLETED") {
        completed = true;
        assert.ok(res.body.document.total_chunks > 0);
        break;
      }
      if (res.body.document?.status === "FAILED") {
        assert.fail(`Ingestion failed with error: ${res.body.document.error_message}`);
      }
    }

    assert.equal(completed, true, "Document did not reach COMPLETED status within timeout");
  });

  it("6. Document Listing - GET /api/documents returns array containing ingested document", async () => {
    const res = await get(`${baseUrl}/api/documents`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.documents));
    const found = res.body.documents.find((d) => d.id === validDocId);
    assert.ok(found, "Uploaded document should appear in documents list");
    assert.equal(found.status, "COMPLETED");
  });

  it("7. Document Details - GET /api/documents/:id returns document metadata", async () => {
    const res = await get(`${baseUrl}/api/documents/${validDocId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.document.id, validDocId);
    assert.equal(res.body.document.filename, "test_sample.pdf");
  });

  it("8. RAG Question Answering - POST /api/ask answers relevant question with source citations", async () => {
    const res = await postJson(`${baseUrl}/api/ask`, {
      documentId: validDocId,
      question: "What does this document say about vector embeddings?",
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.answer && typeof res.body.answer === "string");
    assert.ok(Array.isArray(res.body.sources) && res.body.sources.length > 0);
    assert.equal(res.body.sources[0].documentName, "test_sample.pdf");
    assert.ok(res.body.sources[0].pageNumber);
    assert.ok(res.body.sources[0].excerpt);
  });

  it("9. Strict Grounding - POST /api/ask declines ungrounded questions without hallucination", async () => {
    const res = await postJson(`${baseUrl}/api/ask`, {
      documentId: validDocId,
      question: "What is the capital of Antarctica?",
    });

    assert.equal(res.status, 200);
    assert.match(
      res.body.answer.toLowerCase(),
      /cannot find sufficient information/
    );
  });

  it("10. Validation - POST /api/ask rejects missing question with 400", async () => {
    const res = await postJson(`${baseUrl}/api/ask`, {
      documentId: validDocId,
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /'question' is required/);
  });

  it("11. Error Handling - POST /api/ask returns 404 for non-existent document", async () => {
    const res = await postJson(`${baseUrl}/api/ask`, {
      documentId: "00000000-0000-0000-0000-000000000000",
      question: "Hello?",
    });
    assert.equal(res.status, 404);
    assert.match(res.body.error, /not found/);
  });

  let failedDocId;

  it("12. Failure Handling - Uploading corrupted PDF transitions to FAILED status", async () => {
    const form = new FormData();
    form.append("file", Buffer.from("%PDF-1.4\n%%EOF"), {
      filename: "corrupted_test.pdf",
      contentType: "application/pdf",
    });

    const uploadRes = await postForm(`${baseUrl}/api/documents/upload`, form);
    assert.equal(uploadRes.status, 202);
    failedDocId = uploadRes.body.document.id;

    // Allow background ingestion to fail and record status
    await sleep(3000);

    const docRes = await get(`${baseUrl}/api/documents/${failedDocId}`);
    assert.equal(docRes.body.document.status, "FAILED");
    assert.ok(docRes.body.document.error_message);
  });

  it("13. Guardrail - POST /api/ask on FAILED document returns 400 error", async () => {
    assert.ok(failedDocId);
    const res = await postJson(`${baseUrl}/api/ask`, {
      documentId: failedDocId,
      question: "Can you answer?",
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /is currently FAILED/);
  });
});
