// The struggle memory. After each exchange we quietly ask a small model what
// the student seems shaky on, then keep those notes per class so every later
// chat (and every generated worksheet) can lean on them.

const { db, now } = require("./db");
const { client } = require("./anthropic");
const { MEMORY_MODEL } = require("./config");

const MAX_PER_CLASS = 50;

const listStmt = db.prepare(
  "SELECT id, content, created_at FROM memories WHERE class_id = ? ORDER BY created_at DESC, id DESC",
);
const insertStmt = db.prepare(
  "INSERT INTO memories (class_id, content, created_at) VALUES (?, ?, ?)",
);
const deleteStmt = db.prepare("DELETE FROM memories WHERE id = ?");
const trimStmt = db.prepare(
  `DELETE FROM memories WHERE class_id = ? AND id NOT IN (
     SELECT id FROM memories WHERE class_id = ? ORDER BY created_at DESC, id DESC LIMIT ?
   )`,
);

function listMemories(classId) {
  return listStmt.all(classId);
}

function deleteMemory(id) {
  deleteStmt.run(id);
}

// Two notes count as the same idea if one contains the other. Keeps the list
// from filling up with near-identical phrasings of the same weak spot.
function isDuplicate(content, existing) {
  const a = content.toLowerCase().trim();
  return existing.some((m) => {
    const b = m.content.toLowerCase().trim();
    return a === b || a.includes(b) || b.includes(a);
  });
}

function addMemory(classId, content) {
  const text = content.trim();
  if (!text) return null;
  if (isDuplicate(text, listMemories(classId))) return null;

  const { lastInsertRowid } = insertStmt.run(classId, text, now());
  trimStmt.run(classId, classId, MAX_PER_CLASS);
  return { id: Number(lastInsertRowid), content: text };
}

const STRUGGLE_SCHEMA = {
  type: "object",
  properties: {
    struggles: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["struggles"],
  additionalProperties: false,
};

// Ask the small model to name the weak spots in one exchange, then store any
// new ones. Returns the notes that were actually added.
async function extractAndStore({ classId, className, userText, assistantText }) {
  const prompt = [
    `Class: ${className}`,
    "",
    "A student and their tutor just had this exchange. Identify concepts or skills the student appears to struggle with or got wrong.",
    "Return 0 to 3 short, specific notes, each a concise phrase naming the underlying weak spot (for example \"sign errors when distributing negatives\" or \"confuses correlation with causation\").",
    "Do not restate the problem. If nothing points to a struggle, return an empty list.",
    "",
    "STUDENT:",
    userText || "(no text)",
    "",
    "TUTOR:",
    assistantText || "(no reply)",
  ].join("\n");

  const response = await client.messages.create({
    model: MEMORY_MODEL,
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
    output_config: {
      format: { type: "json_schema", schema: STRUGGLE_SCHEMA },
    },
  });

  const text = response.content.find((b) => b.type === "text");
  let struggles = [];
  try {
    struggles = JSON.parse(text.text).struggles || [];
  } catch {
    struggles = [];
  }

  const added = [];
  for (const s of struggles) {
    const row = addMemory(classId, s);
    if (row) added.push(row);
  }
  return added;
}

module.exports = { listMemories, addMemory, deleteMemory, extractAndStore };
