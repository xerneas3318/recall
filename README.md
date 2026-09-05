# Recall

I kept getting homework wrong and asking an AI to explain it, and the annoying part was that every question lived in its own separate chat. I'd work out that I keep messing up, say, integration by parts, and then a week later in a brand new chat I'd make the exact same mistake and have to re-explain all my context from scratch. Nothing carried over. My mistakes didn't stick, and neither did the help.

So I made Recall. It's a chat tool for homework that keeps a memory of what I keep getting wrong, per class, and reuses it. I paste in homework and ask what I messed up, it grades it, and quietly writes down the thing I fumbled. Next time, in any chat for that class, it already knows. When I ask for practice it points at those weak spots instead of random problems.

The way I think about it: global memory, but aimed specifically at asking homework questions. It remembers what I'm struggling with and then actually helps me on it.

I've been using it for a couple of my classes so far and it's honestly just nice to not forget my own mistakes.

## What it does

- Keeps a separate class for each subject, so my chem mistakes don't get tangled up with the CS ones. It comes preloaded with my current courses.
- I paste homework, or drop in a photo or a PDF, and ask what I got wrong. It walks through the actual errors instead of just handing over the answer.
- After each exchange it saves whatever I looked shaky on to that class's memory. The list shows on the right and I can edit or delete anything.
- If I ask for a worksheet it builds one around my weak spots, with an answer key.
- There's a broad-context note that goes out with every class (who I am, my whole course load, the level to explain things at) so any class's tutor has the bigger picture. I can edit it from the sidebar.
- Flip on the Web switch and it can look things up when it needs to.
- Everything is saved to disk, so I can close it and come back and my chats and memory are still there.

It all runs locally. The only thing that leaves my machine is the actual call to the model.

## Running it

You need Node 20 or newer and an Anthropic API key.

```bash
git clone https://github.com/xerneas3318/recall.git
cd recall
npm install
cp .env.example .env     # put your ANTHROPIC_API_KEY in here
npm start
```

Then open http://localhost:5173. Your key only lives in `.env`, which is gitignored, so it never leaves your machine.

It's plain Node and Express with a vanilla JS front end, SQLite for storage (the built-in `node:sqlite`), and the Anthropic SDK for the model.

## Config

Everything is set through environment variables in `.env`:

| Variable | Default | What it does |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | (required) | your Anthropic API key |
| `PORT` | `5173` | port it runs on |
| `RECALL_CHAT_MODEL` | `claude-opus-4-8` | the model that answers |
| `RECALL_MEMORY_MODEL` | `claude-haiku-4-5` | the cheaper model that records weak spots |

If you want to spend less, switch `RECALL_CHAT_MODEL` to `claude-sonnet-5`. It handles homework help really well for a lot less.

## Where it's at

It's a personal project. Single user, no login, and it assumes you trust whatever is on your own machine. It works well enough that I actually use it. Things I might add later: picking a different model per class, exporting a class's memory, and searching back through old chats.

## License

MIT. See [LICENSE](LICENSE).
