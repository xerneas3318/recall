# Recall

I kept getting homework wrong, asking an AI to explain it, then making the same mistake a week later in a fresh chat that knew none of my history. Nothing carried over.

Recall fixes that. It's a homework chat tool with memory: I paste in what I got wrong, it grades it and quietly notes what I fumbled, per class. Next time, in any chat for that class, it already knows, and any practice it makes targets those weak spots. Global memory, aimed at homework.

I use it for a couple of my classes. It's just nice to stop forgetting my own mistakes.

## What it does

- One class per subject, preloaded with my current courses.
- Paste homework or a photo/PDF and ask what's wrong; it works through the errors, not just the answer.
- Saves what I looked shaky on to that class's memory, shown on the right and editable.
- Worksheets it generates target those weak spots, with an answer key.
- A broad-context note (who I am, my course load, the level to teach at) goes out with every class; editable from the sidebar.
- A Web toggle lets it look things up.
- Everything is saved to disk, so I can close it and come back.

Runs locally. The only thing that leaves my machine is the model call.

## Running it

You need Node 20 or newer and an Anthropic API key.

```bash
git clone https://github.com/xerneas3318/recall.git
cd recall
npm install
cp .env.example .env     # put your ANTHROPIC_API_KEY in here
npm start
```

Then open http://localhost:5173. Your key stays in `.env`, which is gitignored.

It's plain Node and Express with a vanilla JS front end, SQLite for storage (the built-in `node:sqlite`), and the Anthropic SDK for the model.

## Config

Set through environment variables in `.env`:

| Variable | Default | What it does |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | (required) | your Anthropic API key |
| `PORT` | `5173` | port it runs on |
| `RECALL_CHAT_MODEL` | `claude-opus-4-8` | the model that answers |
| `RECALL_MEMORY_MODEL` | `claude-haiku-4-5` | the cheaper model that records weak spots |

To spend less, switch `RECALL_CHAT_MODEL` to `claude-sonnet-5`.

## License

MIT. See [LICENSE](LICENSE).
