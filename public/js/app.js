// The interface controller: keeps track of the selected class and chat, wires
// up the buttons, and drives the streaming conversation.

(function () {
  const el = (id) => document.getElementById(id);

  const els = {
    classList: el("class-list"),
    chatList: el("chat-list"),
    chatsTitle: el("chats-title"),
    addClass: el("add-class"),
    addChat: el("add-chat"),
    messages: el("messages"),
    emptyState: el("empty-state"),
    composer: el("composer"),
    input: el("input"),
    sendBtn: el("send-btn"),
    attachBtn: el("attach-btn"),
    fileInput: el("file-input"),
    chips: el("attachment-chips"),
    memoryList: el("memory-list"),
    memoryInput: el("memory-input"),
    memoryHint: el("memory-hint"),
    keyWarning: el("key-warning"),
  };

  const state = {
    classId: null,
    chatId: null,
    staged: [], // uploaded-but-unsent attachments
    sending: false,
  };

  const LAST_CLASS = "recall.classId";
  const LAST_CHAT = "recall.chatId";

  // --- classes ---

  async function loadClasses(selectId) {
    const classes = await API.listClasses();
    els.classList.innerHTML = "";
    for (const c of classes) {
      const li = document.createElement("li");
      li.dataset.id = c.id;
      li.innerHTML = `<span class="label"></span><button class="del" title="Delete class">×</button>`;
      li.querySelector(".label").textContent = c.name;
      li.addEventListener("click", (e) => {
        if (e.target.classList.contains("del")) return;
        selectClass(c.id);
      });
      li.querySelector(".del").addEventListener("click", () => removeClass(c.id, c.name));
      els.classList.appendChild(li);
    }

    const target = selectId || Number(localStorage.getItem(LAST_CLASS));
    if (target && classes.some((c) => c.id === target)) selectClass(target);
  }

  async function addClass() {
    const name = prompt("Name this class (e.g. Calc II, CS 2110):");
    if (!name || !name.trim()) return;
    const created = await API.createClass(name.trim());
    await loadClasses(created.id);
  }

  async function removeClass(id, name) {
    if (!confirm(`Delete "${name}" and all of its chats and memory?`)) return;
    await API.deleteClass(id);
    if (state.classId === id) {
      state.classId = null;
      state.chatId = null;
      localStorage.removeItem(LAST_CLASS);
      localStorage.removeItem(LAST_CHAT);
      resetToEmpty();
    }
    await loadClasses();
  }

  async function selectClass(id) {
    state.classId = id;
    localStorage.setItem(LAST_CLASS, id);
    highlight(els.classList, id);

    els.addChat.disabled = false;
    els.memoryInput.disabled = false;
    els.composer.hidden = false;

    await Promise.all([loadChats(), loadMemory()]);

    // Restore the last chat in this class if it still exists, else a blank slate.
    const savedChat = Number(localStorage.getItem(LAST_CHAT));
    const chatEls = [...els.chatList.children].map((c) => Number(c.dataset.id));
    if (savedChat && chatEls.includes(savedChat)) selectChat(savedChat);
    else showBlankChat();
  }

  // --- chats ---

  async function loadChats() {
    const chats = await API.listChats(state.classId);
    els.chatList.innerHTML = "";
    for (const c of chats) {
      const li = document.createElement("li");
      li.dataset.id = c.id;
      li.innerHTML = `<span class="label"></span><button class="del" title="Delete chat">×</button>`;
      li.querySelector(".label").textContent = c.title;
      li.addEventListener("click", (e) => {
        if (e.target.classList.contains("del")) return;
        selectChat(c.id);
      });
      li.querySelector(".del").addEventListener("click", () => removeChat(c.id));
      els.chatList.appendChild(li);
    }
    if (state.chatId) highlight(els.chatList, state.chatId);
  }

  async function newChat() {
    const chat = await API.createChat(state.classId);
    await loadChats();
    selectChat(chat.id);
  }

  async function removeChat(id) {
    if (!confirm("Delete this chat?")) return;
    await API.deleteChat(id);
    if (state.chatId === id) {
      state.chatId = null;
      localStorage.removeItem(LAST_CHAT);
      showBlankChat();
    }
    await loadChats();
  }

  async function selectChat(id) {
    state.chatId = id;
    localStorage.setItem(LAST_CHAT, id);
    highlight(els.chatList, id);

    const chat = await API.getChat(id);
    els.messages.innerHTML = "";
    for (const m of chat.messages) els.messages.appendChild(Render.messageEl(m));
    scrollDown();
    els.input.focus();
  }

  function showBlankChat() {
    state.chatId = null;
    localStorage.removeItem(LAST_CHAT);
    highlight(els.chatList, null);
    els.messages.innerHTML =
      `<div class="empty"><h1>New chat</h1><p>Paste your homework or ask a question. A chat is created the moment you send.</p></div>`;
  }

  function resetToEmpty() {
    els.composer.hidden = true;
    els.addChat.disabled = true;
    els.memoryInput.disabled = true;
    els.chatList.innerHTML = "";
    els.memoryList.innerHTML = "";
    els.messages.innerHTML =
      `<div class="empty"><h1>Pick a class to start</h1><p>Create a class on the left, then paste your homework and ask what you got wrong.</p></div>`;
  }

  // --- memory ---

  async function loadMemory() {
    const memory = await API.listMemory(state.classId);
    renderMemory(memory);
  }

  function renderMemory(memory, freshIds = []) {
    els.memoryList.innerHTML = "";
    els.memoryHint.hidden = memory.length > 0;
    for (const m of memory) {
      const li = document.createElement("li");
      li.textContent = m.content;
      if (freshIds.includes(m.id)) li.classList.add("fresh");
      const del = document.createElement("button");
      del.className = "del";
      del.textContent = "×";
      del.title = "Remove";
      del.addEventListener("click", async () => {
        await API.deleteMemory(m.id);
        loadMemory();
      });
      li.appendChild(del);
      els.memoryList.appendChild(li);
    }
  }

  async function addMemoryNote() {
    const content = els.memoryInput.value.trim();
    if (!content) return;
    els.memoryInput.value = "";
    try {
      await API.addMemory(state.classId, content);
    } catch {
      /* empty or duplicate; ignore */
    }
    loadMemory();
  }

  // --- attachments ---

  async function onFilesChosen(files) {
    if (!files.length) return;
    try {
      const uploaded = await API.uploadFiles(files);
      state.staged.push(...uploaded);
      renderChips();
    } catch {
      alert("Upload failed. Images and PDFs up to 15 MB are supported.");
    }
    els.fileInput.value = "";
  }

  function renderChips() {
    els.chips.innerHTML = "";
    state.staged.forEach((a, index) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = (a.kind === "pdf" ? "📄 " : "🖼 ") + a.filename;
      const x = document.createElement("button");
      x.textContent = "×";
      x.addEventListener("click", () => {
        state.staged.splice(index, 1);
        renderChips();
      });
      chip.appendChild(x);
      els.chips.appendChild(chip);
    });
  }

  // --- sending ---

  async function send() {
    if (state.sending || !state.classId) return;
    const content = els.input.value.trim();
    if (!content && state.staged.length === 0) return;

    // Starting a fresh chat? Create one now so the message has a home.
    if (!state.chatId) {
      const chat = await API.createChat(state.classId);
      state.chatId = chat.id;
      localStorage.setItem(LAST_CHAT, chat.id);
      els.messages.innerHTML = "";
    }

    const attachments = state.staged.slice();
    const attachmentIds = attachments.map((a) => a.id);

    // Show the student's turn immediately.
    els.messages.appendChild(
      Render.messageEl({ role: "user", content, attachments }),
    );

    // Reset the composer.
    els.input.value = "";
    els.input.style.height = "auto";
    state.staged = [];
    renderChips();

    // Placeholder for the streaming reply.
    const bubble = Render.messageEl({ role: "assistant", content: "" });
    bubble.classList.add("streaming");
    const body = bubble.querySelector(".md");
    els.messages.appendChild(bubble);
    scrollDown();

    state.sending = true;
    els.sendBtn.disabled = true;
    let acc = "";

    await API.sendMessage(
      state.chatId,
      { content, attachmentIds },
      {
        onDelta: (text) => {
          acc += text;
          body.innerHTML = Render.renderMarkdown(acc);
          scrollDown();
        },
        onDone: () => {
          bubble.classList.remove("streaming");
          loadChats(); // the first message may have renamed the chat
        },
        onMemory: (data) => {
          const freshIds = (data.added || []).map((m) => m.id);
          renderMemory(data.memory || [], freshIds);
        },
        onError: (msg) => {
          bubble.classList.remove("streaming");
          body.innerHTML = `<p style="color:var(--danger)">${Render.escapeHtml(msg)}</p>`;
        },
      },
    );

    state.sending = false;
    els.sendBtn.disabled = false;
    els.input.focus();
  }

  // --- helpers ---

  function highlight(listEl, id) {
    for (const li of listEl.children) {
      li.classList.toggle("active", Number(li.dataset.id) === Number(id));
    }
  }

  function scrollDown() {
    els.messages.scrollTop = els.messages.scrollHeight;
  }

  function autoGrow() {
    els.input.style.height = "auto";
    els.input.style.height = Math.min(els.input.scrollHeight, 200) + "px";
  }

  // --- wiring ---

  els.addClass.addEventListener("click", addClass);
  els.addChat.addEventListener("click", newChat);
  els.sendBtn.addEventListener("click", send);
  els.attachBtn.addEventListener("click", () => els.fileInput.click());
  els.fileInput.addEventListener("change", (e) => onFilesChosen([...e.target.files]));

  els.input.addEventListener("input", autoGrow);
  els.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  els.memoryInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addMemoryNote();
  });

  for (const btn of document.querySelectorAll(".quick-actions button")) {
    btn.addEventListener("click", () => {
      els.input.value = btn.dataset.prompt;
      send();
    });
  }

  // --- boot ---

  async function boot() {
    try {
      const status = await API.status();
      if (!status.hasApiKey) els.keyWarning.hidden = false;
    } catch {
      /* status is best-effort */
    }
    await loadClasses();
  }

  boot();
})();
