// Everything that talks to Claude lives here: building the context we send,
// turning stored messages (and their attachments) into API content blocks,
// and streaming the reply back.

const fs = require("node:fs");
const path = require("node:path");
const Anthropic = require("@anthropic-ai/sdk");
const { UPLOAD_DIR, CHAT_MODEL } = require("./config");

// Reads ANTHROPIC_API_KEY from the environment. The placeholder keeps the
// constructor from throwing when the key is missing, so the app still boots and
// can show a friendly "add your key" message instead of crashing.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "MISSING_API_KEY" });

// The persona plus the class's accumulated memory of weak spots. This is what
// makes the tutor feel like it actually remembers you between sessions.
function systemPrompt(className, memories) {
  const lines = [
    `You are a sharp, patient study tutor helping the student with their ${className} coursework.`,
    "When they paste homework, a worksheet, or a photo of their work, check it carefully, point out exactly what is wrong and why, and show the correct reasoning step by step.",
    "When they ask for help, teach the underlying idea rather than just handing over an answer.",
    "When they ask for a practice worksheet, write one that targets the specific things they get wrong. Include an answer key at the end.",
    "Use Markdown. Be concrete and show your work.",
    "Write all math as plain text, not LaTeX: no dollar signs, no \\frac, no \\cdot. Use ^ for exponents (x^2), * or plain juxtaposition for multiplication, and / for division.",
  ];

  if (memories.length) {
    lines.push(
      "",
      "Here is what this student has repeatedly struggled with in this class. Lean on it: revisit these ideas, watch for these mistakes, and aim practice at them.",
    );
    for (const m of memories) lines.push(`- ${m.content}`);
  }

  return lines.join("\n");
}

// Read a stored upload back into the base64 form the API expects.
function attachmentBlock(att) {
  const data = fs.readFileSync(path.join(UPLOAD_DIR, att.stored_name)).toString("base64");
  if (att.kind === "pdf") {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data },
    };
  }
  return {
    type: "image",
    source: { type: "base64", media_type: att.mime, data },
  };
}

// Turn a stored message plus its attachments into one API message. A plain
// text turn stays a string; anything with files becomes a content-block array.
function toApiMessage(message, attachments) {
  if (!attachments.length) {
    return { role: message.role, content: message.content };
  }
  const blocks = attachments.map(attachmentBlock);
  if (message.content.trim()) blocks.push({ type: "text", text: message.content });
  return { role: message.role, content: blocks };
}

// Stream a reply. onText fires for every chunk; the resolved value is the full
// text so the caller can save it.
async function streamReply({ className, memories, messages, onText }) {
  const stream = client.messages.stream({
    model: CHAT_MODEL,
    max_tokens: 4096,
    system: systemPrompt(className, memories),
    messages,
  });

  stream.on("text", onText);
  const final = await stream.finalMessage();
  return final.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}

module.exports = { client, systemPrompt, toApiMessage, streamReply };
