// A few knobs, read once at startup. Everything sensitive comes from the
// environment (.env), never from source, so nothing secret lands in git.

const path = require("node:path");
const fs = require("node:fs");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

module.exports = {
  UPLOAD_DIR,
  PORT: process.env.PORT || 5173,
  // The model that answers in chat. Opus is the default; override in .env.
  CHAT_MODEL: process.env.RECALL_CHAT_MODEL || "claude-opus-4-8",
  // A cheaper model does the quiet job of noting what you struggled with.
  MEMORY_MODEL: process.env.RECALL_MEMORY_MODEL || "claude-haiku-4-5",
  hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
};
