// Classes are the top-level sections, one per subject. Each keeps its own
// chats and its own struggle memory.

const express = require("express");
const { db, now } = require("../db");
const { listMemories, addMemory } = require("../memory");

const router = express.Router();

const listStmt = db.prepare(
  "SELECT id, name, created_at FROM classes ORDER BY created_at ASC",
);
const getStmt = db.prepare("SELECT id, name FROM classes WHERE id = ?");
const insertStmt = db.prepare(
  "INSERT INTO classes (name, created_at) VALUES (?, ?)",
);
const renameStmt = db.prepare("UPDATE classes SET name = ? WHERE id = ?");
const deleteStmt = db.prepare("DELETE FROM classes WHERE id = ?");

router.get("/", (req, res) => {
  res.json(listStmt.all());
});

router.post("/", (req, res) => {
  const name = (req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "name is required" });

  const { lastInsertRowid } = insertStmt.run(name, now());
  res.status(201).json({ id: Number(lastInsertRowid), name });
});

router.patch("/:id", (req, res) => {
  const name = (req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "name is required" });

  renameStmt.run(name, req.params.id);
  res.json({ id: Number(req.params.id), name });
});

router.delete("/:id", (req, res) => {
  deleteStmt.run(req.params.id);
  res.status(204).end();
});

// Class-scoped struggle memory.
router.get("/:id/memory", (req, res) => {
  res.json(listMemories(req.params.id));
});

router.post("/:id/memory", (req, res) => {
  if (!getStmt.get(req.params.id)) {
    return res.status(404).json({ error: "class not found" });
  }
  const row = addMemory(req.params.id, req.body.content || "");
  if (!row) return res.status(409).json({ error: "empty or duplicate note" });
  res.status(201).json(row);
});

module.exports = router;
