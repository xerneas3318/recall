// Turning data into DOM: a small Markdown renderer for the tutor's replies,
// plus the builder for a message bubble and its attachments.

function escapeHtml(s) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

// Inline formatting on an already-escaped line: code, bold, italics.
function inline(s) {
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  return s;
}

const isSpecial = (l) =>
  /^```/.test(l) ||
  /^#{1,3}\s+/.test(l) ||
  /^\s*[-*]\s+/.test(l) ||
  /^\s*\d+\.\s+/.test(l) ||
  /^\s*\|.*\|\s*$/.test(l);

// Split "| a | b |" into ["a", "b"].
function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

// A deliberately small Markdown-to-HTML pass. Handles the things Claude
// actually uses in tutoring: headings, lists, fenced code, and emphasis.
function renderMarkdown(src) {
  const lines = escapeHtml(src).split("\n");
  let html = "";
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      const code = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++; // closing fence
      html += `<pre><code>${code.join("\n")}</code></pre>`;
      continue;
    }

    // GitHub-style table: a header row, a |---|---| separator, then body rows.
    if (
      /^\s*\|.*\|\s*$/.test(line) &&
      i + 1 < lines.length &&
      /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) &&
      lines[i + 1].includes("-")
    ) {
      const header = splitRow(line);
      i += 2; // skip the header and the separator
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(splitRow(lines[i++]));
      const head = header.map((h) => `<th>${inline(h)}</th>`).join("");
      const body = rows
        .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
        .join("");
      html += `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const lvl = heading[1].length;
      html += `<h${lvl}>${inline(heading[2])}</h${lvl}>`;
      i++;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(inline(lines[i++].replace(/^\s*[-*]\s+/, "")));
      }
      html += `<ul>${items.map((t) => `<li>${t}</li>`).join("")}</ul>`;
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(inline(lines[i++].replace(/^\s*\d+\.\s+/, "")));
      }
      html += `<ol>${items.map((t) => `<li>${t}</li>`).join("")}</ol>`;
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    const para = [];
    while (i < lines.length && lines[i].trim() !== "" && !isSpecial(lines[i])) {
      para.push(lines[i++]);
    }
    html += `<p>${para.map(inline).join("<br>")}</p>`;
  }

  return html;
}

function thumbsEl(attachments) {
  const thumbs = document.createElement("div");
  thumbs.className = "thumbs";
  for (const a of attachments) {
    if (a.kind === "image") {
      const img = document.createElement("img");
      img.src = a.url;
      img.alt = a.filename;
      thumbs.appendChild(img);
    } else {
      const link = document.createElement("a");
      link.className = "file-chip";
      link.href = a.url;
      link.target = "_blank";
      link.textContent = "📄 " + a.filename;
      thumbs.appendChild(link);
    }
  }
  return thumbs;
}

// A message row. The tutor gets an avatar and full-width markdown (with a slot
// for sources); the student's turn is a rounded bubble on the right.
function messageEl(msg) {
  const el = document.createElement("div");
  el.className = `msg ${msg.role}`;
  if (msg.id) el.dataset.id = msg.id;
  const hasAtt = msg.attachments && msg.attachments.length;

  if (msg.role === "assistant") {
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = "◆";
    el.appendChild(avatar);

    const col = document.createElement("div");
    col.className = "msg-col";
    if (hasAtt) col.appendChild(thumbsEl(msg.attachments));
    const body = document.createElement("div");
    body.className = "md";
    body.innerHTML = renderMarkdown(msg.content || "");
    col.appendChild(body);
    const sources = document.createElement("div");
    sources.className = "sources";
    col.appendChild(sources);
    el.appendChild(col);
  } else {
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    if (hasAtt) bubble.appendChild(thumbsEl(msg.attachments));
    const body = document.createElement("div");
    body.className = "text";
    body.textContent = msg.content || "";
    bubble.appendChild(body);
    el.appendChild(bubble);
  }
  return el;
}

// Show what the tutor looked up, under its reply.
function renderSources(el, searches) {
  const box = el.querySelector(".sources");
  if (!box || !searches || !searches.length) return;
  box.innerHTML = `<b>🌐 Looked up:</b> ${searches.map(escapeHtml).join(" · ")}`;
}

window.Render = { renderMarkdown, messageEl, renderSources, escapeHtml };
