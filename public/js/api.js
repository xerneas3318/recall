// Thin wrappers around the backend. Everything the UI needs to fetch or change
// goes through here so app.js stays about the interface, not about HTTP.

async function json(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res.status === 204 ? null : res.json();
}

// Pull one "event:/data:" block apart into { event, data }.
function parseEvent(raw) {
  let event = "message";
  let data = "";
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  try {
    return { event, data: data ? JSON.parse(data) : {} };
  } catch {
    return { event, data: {} };
  }
}

const API = {
  status: () => json("GET", "/api/status"),

  listClasses: () => json("GET", "/api/classes"),
  createClass: (name) => json("POST", "/api/classes", { name }),
  deleteClass: (id) => json("DELETE", `/api/classes/${id}`),

  listChats: (classId) => json("GET", `/api/classes/${classId}/chats`),
  createChat: (classId) => json("POST", `/api/classes/${classId}/chats`, {}),
  getChat: (chatId) => json("GET", `/api/chats/${chatId}`),
  renameChat: (chatId, title) => json("PATCH", `/api/chats/${chatId}`, { title }),
  deleteChat: (chatId) => json("DELETE", `/api/chats/${chatId}`),

  listMemory: (classId) => json("GET", `/api/classes/${classId}/memory`),
  addMemory: (classId, content) => json("POST", `/api/classes/${classId}/memory`, { content }),
  deleteMemory: (id) => json("DELETE", `/api/memory/${id}`),

  getProfile: () => json("GET", "/api/profile"),
  updateProfile: (profile) => json("PUT", "/api/profile", { profile }),

  async uploadFiles(files) {
    const fd = new FormData();
    for (const f of files) fd.append("files", f);
    const res = await fetch("/api/uploads", { method: "POST", body: fd });
    if (!res.ok) throw new Error("upload failed");
    return res.json();
  },

  // Send a message and stream the reply. handlers: onDelta, onDone, onMemory, onError.
  async sendMessage(chatId, payload, handlers) {
    const res = await fetch(`/api/chats/${chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const msg = (await res.json().catch(() => ({}))).error || "request failed";
      return handlers.onError && handlers.onError(msg);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      let idx;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const { event, data } = parseEvent(buf.slice(0, idx));
        buf = buf.slice(idx + 2);
        if (event === "delta") handlers.onDelta && handlers.onDelta(data.text);
        else if (event === "done") handlers.onDone && handlers.onDone(data);
        else if (event === "memory") handlers.onMemory && handlers.onMemory(data);
        else if (event === "error") handlers.onError && handlers.onError(data.message);
      }
    }
  },
};

window.API = API;
