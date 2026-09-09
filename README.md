# Recall

Recall is a homework chat tool with memory. Paste in a problem you got wrong; it grades it, notes the exact mistake, and keeps that note per class. In any later chat for that class it already knows your weak spots, and any worksheet it makes targets them.

Think of it as global memory aimed at homework: it remembers what you keep getting wrong and helps you fix it.

## What it does

- One class per subject, preloaded with the current term's courses.
- Paste homework or a photo/PDF and ask what's wrong; it works through the errors, not just the answer.
- Saves the shaky spots to that class's memory, shown on the right and editable.
- Worksheets it generates target those weak spots, with an answer key.
- A broad-context note (background, course load, the level to teach at) goes out with every class; editable from the sidebar.
- A Web toggle lets it look things up.
- Chats and memory are saved to disk, so you can close it and come back.

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
