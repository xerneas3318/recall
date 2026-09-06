// The interface controller: keeps track of the selected class and chat, wires
// up the buttons, and drives the streaming conversation.

(function () {
  const el = (id) => document.getElementById(id);

  const els = {
    app: el("app"),
    memoryToggle: el("memory-toggle"),
    classList: el("class-list"),
    chatList: el("chat-list"),
    search: el("search"),
    palette: el("palette"),
    paletteInput: el("palette-input"),
    paletteResults: el("palette-results"),
    addClass: el("add-class"),
    addChat: el("add-chat"),
    chatTopbar: el("chat-topbar"),
    topbarTitle: el("topbar-title"),
    topbarSub: el("topbar-sub"),
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
    themeToggle: el("theme-toggle"),
    webToggle: el("web-toggle"),
    contextBtn: el("context-btn"),
    contextModal: el("context-modal"),
    contextText: el("context-text"),
    contextSave: el("context-save"),
    contextCancel: el("context-cancel"),
  };

  const state = {
    classId: null,
    className: "",
    classes: [],
    chatId: null,
    chats: [], // chats in the current class, newest first
    model: "",
    staged: [], // uploaded-but-unsent attachments
    sending: false,
    web: false, // whether the tutor may search the web
  };

  const LAST_CLASS = "recall.classId";
  const LAST_CHAT = "recall.chatId";

  // --- classes ---

  async function loadClasses(selectId) {
    const classes = await API.listClasses();
    state.classes = classes;
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
    state.className = (state.classes.find((c) => c.id === id) || {}).name || "";
    localStorage.setItem(LAST_CLASS, id);
    highlight(els.classList, id);

    els.addChat.disabled = false;
    els.memoryInput.disabled = false;
    els.composer.hidden = false;
    els.chatTopbar.hidden = false;

    await Promise.all([loadChats(), loadMemory()]);

    // Restore the last chat in this class if it still exists, else a blank slate.
    const savedChat = Number(localStorage.getItem(LAST_CHAT));
    const chatEls = [...els.chatList.children].map((c) => Number(c.dataset.id));
    if (savedChat && chatEls.includes(savedChat)) selectChat(savedChat);
    else showBlankChat();
  }

  // --- chats ---

  async function loadChats() {
    state.chats = await API.listChats(state.classId);
    renderChats();
  }

  // Which time bucket a chat falls in, Open WebUI style.
  function bucketFor(iso) {
    const d = new Date(iso).getTime();
    const nowD = new Date();
    const startToday = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate()).getTime();
    const day = 86400000;
    if (d >= startToday) return { key: "today", label: "Today" };
    if (d >= startToday - day) return { key: "yesterday", label: "Yesterday" };
    if (d >= startToday - 7 * day) return { key: "w", label: "Previous 7 Days" };
    if (d >= startToday - 30 * day) return { key: "m", label: "Previous 30 Days" };
    const dt = new Date(iso);
    return {
      key: `${dt.getFullYear()}-${dt.getMonth()}`,
      label: dt.toLocaleString("default", { month: "long", year: "numeric" }),
    };
  }

  function chatItem(c) {
    const li = document.createElement("li");
    li.dataset.id = c.id;
    li.innerHTML = `<span class="label"></span><button class="del" title="Delete chat">×</button>`;
    li.querySelector(".label").textContent = c.title;
    li.addEventListener("click", (e) => {
      if (e.target.classList.contains("del")) return;
      selectChat(c.id);
    });
    li.querySelector(".del").addEventListener("click", () => removeChat(c.id));
    return li;
  }

  function renderChats() {
    els.chatList.innerHTML = "";
    const chats = state.chats;
    if (!chats.length) return;

    // chats arrive newest-first, so buckets come out in order.
    const groups = [];
    const byKey = {};
    for (const c of chats) {
      const b = bucketFor(c.updated_at);
      if (!byKey[b.key]) {
        byKey[b.key] = { label: b.label, items: [] };
        groups.push(byKey[b.key]);
      }
      byKey[b.key].items.push(c);
    }

    for (const g of groups) {
      const wrap = document.createElement("div");
      wrap.className = "chat-group";
      const head = document.createElement("div");
      head.className = "group-head";
      head.textContent = g.label;
      wrap.appendChild(head);
      const ul = document.createElement("ul");
      ul.className = "list";
      for (const c of g.items) ul.appendChild(chatItem(c));
      wrap.appendChild(ul);
      els.chatList.appendChild(wrap);
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
    setTopbar(chat.title);
    els.messages.innerHTML = "";
    for (const m of chat.messages) els.messages.appendChild(Render.messageEl(m));
    scrollDown();
    els.input.focus();
  }

  function setTopbar(title) {
    els.topbarTitle.textContent = title;
    els.topbarSub.textContent = state.model
      ? `${state.className}  ·  ${state.model}`
      : state.className;
  }

  function showBlankChat() {
    state.chatId = null;
    localStorage.removeItem(LAST_CHAT);
    highlight(els.chatList, null);
    setTopbar("New chat");
    els.messages.innerHTML =
      `<div class="empty"><h1>New chat</h1><p>Paste your homework or ask a question. A chat is created the moment you send.</p></div>`;
  }

  function resetToEmpty() {
    els.composer.hidden = true;
    els.chatTopbar.hidden = true;
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
      { content, attachmentIds, web: state.web },
      {
        onDelta: (text) => {
          acc += text;
          body.innerHTML = Render.renderMarkdown(acc);
          scrollDown();
        },
        onDone: (data) => {
          bubble.classList.remove("streaming");
          Render.renderSources(bubble, data && data.searches);
          if (data && data.title) setTopbar(data.title);
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

  // Works for the flat class list and the grouped chat list alike.
  function highlight(root, id) {
    for (const li of root.querySelectorAll("li[data-id]")) {
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

  const THEME_KEY = "recall.theme";

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
    els.themeToggle.querySelector(".theme-label").textContent =
      theme === "dark" ? "Dark" : "Light";
  }

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
  }

  function toggleWeb() {
    state.web = !state.web;
    els.webToggle.classList.toggle("active", state.web);
    els.webToggle.title = state.web
      ? "Web search is on for the next message"
      : "Let the tutor search the web";
  }

  const MEM_KEY = "recall.memoryOpen";

  function applyMemoryPanel(open) {
    els.app.classList.toggle("memory-open", open);
    els.memoryToggle.classList.toggle("active", open);
    localStorage.setItem(MEM_KEY, open ? "1" : "0");
  }

  function toggleMemoryPanel() {
    applyMemoryPanel(!els.app.classList.contains("memory-open"));
  }

  // --- command palette (Cmd+P) ---

  let paletteItems = [];
  let paletteFiltered = [];
  let paletteSel = 0;

  function buildPaletteItems(allChats) {
    const items = [
      { kind: "Command", label: "New chat", run: () => state.classId && newChat() },
      { kind: "Command", label: "Toggle web search", run: toggleWeb },
      { kind: "Command", label: "Toggle theme", run: toggleTheme },
      { kind: "Command", label: "Toggle weak-spots panel", run: toggleMemoryPanel },
      { kind: "Command", label: "Edit broad context", run: openContext },
    ];
    for (const c of state.classes) {
      items.push({ kind: "Class", label: c.name, run: () => selectClass(c.id) });
    }
    for (const ch of allChats) {
      items.push({
        kind: "Chat",
        label: ch.title,
        sub: ch.class_name,
        run: () => openChatFromPalette(ch.class_id, ch.id),
      });
    }
    return items;
  }

  async function openPalette() {
    let allChats = [];
    try {
      allChats = await API.allChats();
    } catch {
      /* palette still works with classes and commands */
    }
    paletteItems = buildPaletteItems(allChats);
    els.palette.hidden = false;
    els.paletteInput.value = "";
    renderPalette("");
    els.paletteInput.focus();
  }

  function closePalette() {
    els.palette.hidden = true;
  }

  function renderPalette(query) {
    const q = query.trim().toLowerCase();
    paletteFiltered = q
      ? paletteItems.filter((it) => `${it.label} ${it.sub || ""}`.toLowerCase().includes(q))
      : paletteItems;
    paletteSel = 0;

    if (!paletteFiltered.length) {
      els.paletteResults.innerHTML = `<li class="palette-empty">No matches.</li>`;
      return;
    }

    els.paletteResults.innerHTML = "";
    paletteFiltered.forEach((it, i) => {
      const li = document.createElement("li");
      if (i === 0) li.classList.add("sel");
      const label = document.createElement("span");
      label.className = "pl-label";
      label.textContent = it.label;
      li.appendChild(label);
      if (it.sub) {
        const sub = document.createElement("span");
        sub.className = "sub";
        sub.textContent = it.sub;
        li.appendChild(sub);
      }
      const kind = document.createElement("span");
      kind.className = "kind";
      kind.textContent = it.kind;
      li.appendChild(kind);
      li.addEventListener("click", () => activatePalette(i));
      li.addEventListener("mousemove", () => setPaletteSel(i));
      els.paletteResults.appendChild(li);
    });
  }

  function setPaletteSel(i) {
    if (i === paletteSel) return;
    paletteSel = i;
    const lis = els.paletteResults.querySelectorAll("li");
    lis.forEach((li, n) => li.classList.toggle("sel", n === i));
  }

  function movePaletteSel(delta) {
    if (!paletteFiltered.length) return;
    const i = Math.max(0, Math.min(paletteSel + delta, paletteFiltered.length - 1));
    setPaletteSel(i);
    const cur = els.paletteResults.querySelectorAll("li")[i];
    if (cur) cur.scrollIntoView({ block: "nearest" });
  }

  function activatePalette(i) {
    const it = paletteFiltered[typeof i === "number" ? i : paletteSel];
    closePalette();
    if (it) it.run();
  }

  async function openChatFromPalette(classId, chatId) {
    await selectClass(classId);
    await selectChat(chatId);
  }

  async function openContext() {
    const { profile } = await API.getProfile();
    els.contextText.value = profile || "";
    els.contextModal.hidden = false;
    els.contextText.focus();
  }

  async function saveContext() {
    await API.updateProfile(els.contextText.value);
    els.contextModal.hidden = true;
  }

  // --- wiring ---

  els.addClass.addEventListener("click", addClass);
  els.addChat.addEventListener("click", newChat);
  els.sendBtn.addEventListener("click", send);
  els.attachBtn.addEventListener("click", () => els.fileInput.click());
  els.fileInput.addEventListener("change", (e) => onFilesChosen([...e.target.files]));
  els.search.addEventListener("click", openPalette);
  els.paletteInput.addEventListener("input", () => renderPalette(els.paletteInput.value));
  els.paletteInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); movePaletteSel(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); movePaletteSel(-1); }
    else if (e.key === "Enter") { e.preventDefault(); activatePalette(); }
    else if (e.key === "Escape") closePalette();
  });
  els.palette.addEventListener("click", (e) => {
    if (e.target === els.palette) closePalette();
  });
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === "p" || e.key === "P")) {
      e.preventDefault();
      els.palette.hidden ? openPalette() : closePalette();
    } else if (e.key === "Escape" && !els.palette.hidden) {
      closePalette();
    }
  });

  els.themeToggle.addEventListener("click", toggleTheme);
  els.webToggle.addEventListener("click", toggleWeb);
  els.memoryToggle.addEventListener("click", toggleMemoryPanel);
  els.contextBtn.addEventListener("click", openContext);
  els.contextSave.addEventListener("click", saveContext);
  els.contextCancel.addEventListener("click", () => (els.contextModal.hidden = true));
  els.contextModal.addEventListener("click", (e) => {
    if (e.target === els.contextModal) els.contextModal.hidden = true;
  });

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
    applyTheme(localStorage.getItem(THEME_KEY) || "dark");
    applyMemoryPanel(localStorage.getItem(MEM_KEY) === "1");
    try {
      const status = await API.status();
      state.model = status.chatModel || "";
      if (!status.hasApiKey) els.keyWarning.hidden = false;
    } catch {
      /* status is best-effort */
    }
    await loadClasses();
  }

  boot();
})();
