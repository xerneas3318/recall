# Recall

[![Node 20+](https://img.shields.io/badge/Node-20%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Server-Express%205-000000?style=flat-square&logo=express)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/Storage-node%3Asqlite-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://nodejs.org/api/sqlite.html)
[![Claude](https://img.shields.io/badge/Model-Claude%20Opus-CC785C?style=flat-square)](https://www.anthropic.com/)
[![Local-first](https://img.shields.io/badge/Runs-100%25%20localhost-2e7d32?style=flat-square)](#why-recall)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

**A local study companion that remembers what you keep getting wrong.** Paste your
homework, drop in a photo or PDF, and ask what you missed. Recall grades it,
explains the idea, and quietly keeps a per-class memory of your weak spots so every
later answer and every practice worksheet is aimed at the things you actually
struggle with.

It is basically Claude on the web, but wired for coursework: sections for each
class, files that stick around, and a memory that survives closing the app. Nothing
leaves your machine except the calls to the model.

## Contents

- [Why Recall](#why-recall)
- [What it does](#what-it-does)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Repository layout](#repository-layout)
- [Status](#status)
- [License](#license)

## Why Recall

A normal chat window forgets you the moment you close the tab. For studying that is
the wrong shape:

- The whole point is to notice the mistakes you make *over and over* and drill them.
- Homework comes as photos and PDFs, and you want to come back to them later.
- Different classes need different context, not one giant undifferentiated thread.

Recall is built around the opposite trade-off:

- **Persistent memory.** Every exchange is mined for the concepts you fumble, and
  those notes are carried into every future chat in that class.
- **Localhost-able.** The entire thing runs on your own machine at
  `http://localhost:5173`, backed by a single SQLite file and an uploads folder.
- **Continues after you close it.** Chats, files, and memory all live on disk, so
  reopening the app drops you right back where you were.
- **Organized by class.** Each subject is its own section with its own chats and its
  own memory.

## What it does

Recall is one small Express app with a plain browser front end:

- **Sections per class.** Make a class for each subject. Its chats and its struggle
  memory are scoped to it.
- **Grade your homework.** Paste a worksheet or attach an image or PDF and ask what
  you got wrong. The tutor checks it, points out the specific mistakes, and works
  through the correct reasoning.
- **Remembers your weak spots.** After each exchange a small model notes what you
  seem shaky on and saves it to that class's memory. The list shows on the right and
  you can prune or add to it by hand.
- **Builds targeted practice.** Ask for a worksheet and it writes one aimed at your
  recorded weak spots, answer key included. Paste a worksheet and it will work
  through it with you.
- **Keeps everything.** Close the app, come back tomorrow, and your classes, chats,
  uploads, and memory are all still there.

The reply streams in token by token, the same as the web app.

## Architecture

```
   Browser (vanilla JS, SSE) ──► Express (localhost:5173)
                                     │
                                     ├──► node:sqlite   (classes, chats, messages, memory)
                                     ├──► uploads/       (images + pdfs on disk)
                                     └──► Claude API     (@anthropic-ai/sdk)
                                             │
                                             ├── chat model:   streams the tutor's reply
                                             └── memory model: extracts your weak spots
```

Each chat request rebuilds the conversation, injects the class's struggle memory into
the system prompt, streams the answer back over Server-Sent Events, and then makes a
second, cheaper call to update that memory from what just happened.

## Getting started

You need Node 20 or newer (for the built-in `node:sqlite`) and an Anthropic API key.

```bash
git clone https://github.com/xerneas3318/recall.git
cd recall
npm install

cp .env.example .env
# open .env and paste your ANTHROPIC_API_KEY

npm start
```

Then open http://localhost:5173, make a class, and paste some homework.

Get an API key at https://console.anthropic.com/. Your key lives only in `.env`,
which is gitignored and never leaves your machine.

## Configuration

All configuration is environment variables (see `.env.example`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | (required) | Your Anthropic API key |
| `PORT` | `5173` | Port the app listens on |
| `RECALL_CHAT_MODEL` | `claude-opus-4-8` | Model that answers in chat |
| `RECALL_MEMORY_MODEL` | `claude-haiku-4-5` | Cheaper model that records weak spots |

## Repository layout

```
server.js            app entry: wires routes, serves the front end
src/
  config.js          env-driven settings
  db.js              node:sqlite schema and connection
  anthropic.js       building context and streaming the reply
  memory.js          extracting and storing struggle notes
  routes/            one file per group: classes, chats, files, memory
public/
  index.html         the interface
  css/styles.css     styling
  js/                api client, markdown rendering, and the UI controller
data/                the SQLite file (gitignored)
uploads/             stored images and pdfs (gitignored)
```

## Status

Working and useful day to day. It is a personal tool, so it runs single-user with no
auth and assumes you trust whatever is on your own machine. Rough edges and ideas for
later: adjustable models per class, exporting a class's memory, and search across old
chats.

## License

MIT. See [LICENSE](LICENSE).
