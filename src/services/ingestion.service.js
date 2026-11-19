import fs from "fs/promises";
import { PDFParse } from "pdf-parse";

// ---------------------------------------------------------------------------
// Ingestion Service — Phase 1
//
// Responsible for extracting text from an uploaded PDF file.
//
// Why PDFParse v2 (class-based API)?
//   The installed version of pdf-parse is v2.x, which uses a class-based
//   interface. `PDFParse.getText()` internally iterates every page and returns
//   a structured object with a `pages` array — giving us page-level metadata
//   without any extra work.
//
// In later phases, this service will be extended to also run chunking and
// embedding. For now it only handles extraction.
// ---------------------------------------------------------------------------

/**
 * Extracts text from a PDF file, returning an array of page objects.
 *
 * @param {string} filePath  - Absolute path to the uploaded PDF.
 * @returns {Promise<{ pageNumber: number, text: string }[]>}
 *
 * @throws If the file cannot be read or the PDF cannot be parsed.
 */
export async function extractPagesFromPDF(filePath) {
  const buffer = await fs.readFile(filePath);

  // PDFParse constructor accepts { data: Buffer } or { url: string }.
  // We pass the buffer directly — no extra disk reads needed.
  const parser = new PDFParse({ data: buffer });

  let result;
  try {
    // getText() processes every page and returns:
    //   { total: number, pages: [{ num: number, text: string }, ...] }
    result = await parser.getText();
  } finally {
    // destroy() releases the underlying PDF.js worker resources.
    // Always call this — even if getText() throws — to avoid memory leaks.
    await parser.destroy();
  }

  if (!result || !result.pages || result.pages.length === 0) {
    throw new Error(
      "Could not extract any text from this PDF. It may be a scanned image-only document."
    );
  }

  // Normalise into our own shape: { pageNumber, text }
  // Filter out pages that are entirely blank (common in scanned PDFs).
  const pages = result.pages
    .map((p) => ({
      pageNumber: p.num,
      text: p.text.trim(),
    }))
    .filter((p) => p.text.length > 0);

  if (pages.length === 0) {
    throw new Error(
      "The PDF was parsed but all pages appear to be empty or image-only. No text could be extracted."
    );
  }

  return pages;
}

/**
 * Returns a short summary of the extracted pages for API responses.
 * Keeps the response payload small — callers that need full text access
 * the `pages` array directly.
 *
 * @param {{ pageNumber: number, text: string }[]} pages
 */
export function summarisePages(pages) {
  const totalCharacters = pages.reduce((sum, p) => sum + p.text.length, 0);

  return {
    totalPages: pages.length,
    totalCharacters,
    // Show a short excerpt from each page so the user can confirm extraction worked.
    pages: pages.map((p) => ({
      pageNumber: p.pageNumber,
      characterCount: p.text.length,
      excerpt: p.text.length > 200 ? p.text.slice(0, 200) + "…" : p.text,
    })),
  };
}
