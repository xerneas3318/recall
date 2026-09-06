// Chats and the message flow. Sending a message streams the reply back over
// Server-Sent Events, saves it, and then quietly updates the class's struggle
// memory from what just happened.

const express = require("express");
const { db, now } = require("../db");
const { toApiMessage, streamReply } = require("../anthropic");
const { listMemories, extractAndStore } = require("../memory");
const { getProfile } = require("../settings");

const router = express.Router();

const getClassStmt = db.prepare("SELECT id, name FROM classes WHERE id = ?");
const chatOwnerStmt = db.prepare(
  "SELECT c.id, c.title, c.class_id, cl.name AS class_name FROM chats c JOIN classes cl ON cl.id = c.class_id WHERE c.id = ?",
);
const listChatsStmt = db.prepare(
  "SELECT id, title, updated_at FROM chats WHERE class_id = ? ORDER BY updated_at DESC",
);
const allChatsStmt = db.prepare(
  `SELECT c.id, c.title, c.class_id, cl.name AS class_name, c.updated_at
   FROM chats c JOIN classes cl ON cl.id = c.class_id ORDER BY c.updated_at DESC`,
);
const insertChatStmt = db.prepare(
  "INSERT INTO chats (class_id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
);
const renameChatStmt = db.prepare("UPDATE chats SET title = ? WHERE id = ?");
const touchChatStmt = db.prepare("UPDATE chats SET updated_at = ? WHERE id = ?");
const deleteChatStmt = db.prepare("DELETE FROM chats WHERE id = ?");

const listMessagesStmt = db.prepare(
  "SELECT id, role, content, created_at FROM messages WHERE chat_id = ? ORDER BY id ASC",
);
const insertMessageStmt = db.prepare(
  "INSERT INTO messages (chat_id, role, content, created_at) VALUES (?, ?, ?, ?)",
);
const attachmentsForStmt = db.prepare(
  "SELECT id, kind, filename, stored_name, mime FROM attachments WHERE message_id = ? ORDER BY id ASC",
);
const linkAttachmentStmt = db.prepare(
  "UPDATE attachments SET message_id = ?, chat_id = ? WHERE id = ? AND message_id IS NULL",
);

function sse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// Shape a stored message for the browser: attachments become links, not paths.
function messageForClient(row) {
  const attachments = attachmentsForStmt.all(row.id).map((a) => ({
    id: a.id,
    kind: a.kind,
    filename: a.filename,
    url: `/api/files/${a.id}`,
  }));
  return { ...row, attachments };
}

// Every chat across all classes, for the command palette.
router.get("/all-chats", (req, res) => {
  res.json(allChatsStmt.all());
});

// --- chats within a class ---

router.get("/classes/:classId/chats", (req, res) => {
  res.json(listChatsStmt.all(req.params.classId));
});

router.post("/classes/:classId/chats", (req, res) => {
  if (!getClassStmt.get(req.params.classId)) {
    return res.status(404).json({ error: "class not found" });
  }
  const title = (req.body.title || "New chat").trim() || "New chat";
  const ts = now();
  const { lastInsertRowid } = insertChatStmt.run(req.params.classId, title, ts, ts);
  res.status(201).json({ id: Number(lastInsertRowid), title, updated_at: ts });
});

router.get("/chats/:chatId", (req, res) => {
  const chat = chatOwnerStmt.get(req.params.chatId);
  if (!chat) return res.status(404).json({ error: "chat not found" });

  const messages = listMessagesStmt.all(chat.id).map(messageForClient);
  res.json({ id: chat.id, class_id: chat.class_id, title: chat.title, messages });
});

router.patch("/chats/:chatId", (req, res) => {
  const title = (req.body.title || "").trim();
  if (!title) return res.status(400).json({ error: "title is required" });
  renameChatStmt.run(title, req.params.chatId);
  res.json({ id: Number(req.params.chatId), title });
});

router.delete("/chats/:chatId", (req, res) => {
  deleteChatStmt.run(req.params.chatId);
  res.status(204).end();
});

// --- send a message and stream the reply ---

router.post("/chats/:chatId/messages", async (req, res) => {
  const chat = chatOwnerStmt.get(req.params.chatId);
  if (!chat) return res.status(404).json({ error: "chat not found" });

  const content = (req.body.content || "").toString();
  const attachmentIds = Array.isArray(req.body.attachmentIds) ? req.body.attachmentIds : [];
  const web = Boolean(req.body.web);
  if (!content.trim() && attachmentIds.length === 0) {
    return res.status(400).json({ error: "message is empty" });
  }

  // Save the student's turn and attach any staged files to it.
  const { lastInsertRowid } = insertMessageStmt.run(chat.id, "user", content, now());
  const userMessageId = Number(lastInsertRowid);
  for (const id of attachmentIds) linkAttachmentStmt.run(userMessageId, chat.id, id);

  // First real message names the chat.
  if (chat.title === "New chat") {
    const snippet = content.trim().slice(0, 60) || "Homework upload";
    renameChatStmt.run(snippet, chat.id);
  }
  touchChatStmt.run(now(), chat.id);

  // Rebuild the whole conversation for the API, attachments and all.
  const apiMessages = listMessagesStmt.all(chat.id).map((m) =>
    toApiMessage(m, attachmentsForStmt.all(m.id)),
  );
  const memories = listMemories(chat.class_id);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let fullText = "";
  let searches = [];
  try {
    const result = await streamReply({
      className: chat.class_name,
      memories,
      messages: apiMessages,
      web,
      profile: getProfile(),
      onText: (delta) => {
        if (!res.writableEnded) sse(res, "delta", { text: delta });
      },
    });
    fullText = result.text;
    searches = result.searches;
  } catch (err) {
    sse(res, "error", { message: err.message || "The tutor could not respond." });
    return res.end();
  }

  const saved = insertMessageStmt.run(chat.id, "assistant", fullText, now());
  touchChatStmt.run(now(), chat.id);
  sse(res, "done", {
    assistantMessageId: Number(saved.lastInsertRowid),
    title: chatOwnerStmt.get(chat.id).title,
    searches,
  });

  // Update the struggle memory from this exchange, then tell the client.
  try {
    const added = await extractAndStore({
      classId: chat.class_id,
      className: chat.class_name,
      userText: content,
      assistantText: fullText,
    });
    sse(res, "memory", { added, memory: listMemories(chat.class_id) });
  } catch {
    // Memory is a nice-to-have; never let it break the reply.
  }
  res.end();
});

module.exports = router;
