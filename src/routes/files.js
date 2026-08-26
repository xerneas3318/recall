// Uploading and serving images and pdfs. Files land in the uploads/ folder with
// a random name; the database remembers the original name, type, and which
// message they belong to.

const express = require("express");
const path = require("node:path");
const multer = require("multer");
const { db, now } = require("../db");
const { UPLOAD_DIR } = require("../config");

const router = express.Router();

// Only the image types the model actually accepts, plus pdf.
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

function kindFor(mime) {
  if (mime === "application/pdf") return "pdf";
  if (IMAGE_TYPES.includes(mime)) return "image";
  return null;
}

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 15 * 1024 * 1024, files: 8 },
  fileFilter: (req, file, cb) => cb(null, Boolean(kindFor(file.mimetype))),
});

const insertStmt = db.prepare(
  `INSERT INTO attachments (message_id, chat_id, kind, filename, stored_name, mime, size, created_at)
   VALUES (NULL, NULL, ?, ?, ?, ?, ?, ?)`,
);
const getStmt = db.prepare(
  "SELECT stored_name, mime, filename FROM attachments WHERE id = ?",
);

// Stage one or more files. They aren't tied to a message until it's sent.
router.post("/uploads", upload.array("files", 8), (req, res) => {
  const saved = (req.files || []).map((f) => {
    const kind = kindFor(f.mimetype);
    const { lastInsertRowid } = insertStmt.run(
      kind,
      f.originalname,
      f.filename,
      f.mimetype,
      f.size,
      now(),
    );
    const id = Number(lastInsertRowid);
    return { id, kind, filename: f.originalname, mime: f.mimetype, size: f.size, url: `/api/files/${id}` };
  });
  res.status(201).json(saved);
});

// Serve a stored file back for display in the browser.
router.get("/files/:id", (req, res) => {
  const att = getStmt.get(req.params.id);
  if (!att) return res.status(404).end();

  res.type(att.mime);
  res.setHeader("Content-Disposition", `inline; filename="${att.filename}"`);
  res.sendFile(path.join(UPLOAD_DIR, att.stored_name));
});

module.exports = router;
