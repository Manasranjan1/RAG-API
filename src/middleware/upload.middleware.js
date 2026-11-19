import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Upload Middleware (multer)
//
// multer handles multipart/form-data requests (file uploads).
// We configure it with:
//   1. diskStorage — where and how to save files
//   2. fileFilter  — reject anything that is not a PDF
//   3. limits      — cap file size at 10 MB
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Files land in <project-root>/uploads/ — this folder is gitignored.
const UPLOADS_DIR = path.join(__dirname, "../../uploads");

// diskStorage gives us control over the filename.
// Without this, multer would use a random name with no extension.
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),

  filename: (_req, file, cb) => {
    // Prefix with a timestamp + random number to prevent name collisions
    // when two users upload a file with the same original name.
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    // Keep the original filename so it stays human-readable in uploads/.
    cb(null, `${unique}-${file.originalname}`);
  },
});

// Reject files that are not PDFs before they are written to disk.
const fileFilter = (_req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true); // accept
  } else {
    // Passing an Error as the first argument rejects the file.
    // multer will expose this error so we can return a 400 response.
    const err = new Error(
      `Invalid file type "${file.mimetype}". Only PDF files are accepted.`
    );
    err.statusCode = 400;
    cb(err, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB — prevents oversized PDFs from wasting server resources
  },
});

export default upload;
