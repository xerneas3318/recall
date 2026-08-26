// Entry point. Loads the environment, wires up the API routes, serves the
// front end, and starts listening on localhost. Run it with:  npm start
//
// The app keeps all of its state on disk (a SQLite file plus the uploads
// folder), so you can close it and pick your conversations back up later.

require("dotenv").config();

const express = require("express");
const path = require("node:path");
const { PORT, hasApiKey, CHAT_MODEL } = require("./src/config");

const app = express();
app.use(express.json({ limit: "2mb" }));

// Lets the front end warn you up front if the API key isn't set yet.
app.get("/api/status", (req, res) => {
  res.json({ hasApiKey, chatModel: CHAT_MODEL });
});

app.use("/api/classes", require("./src/routes/classes"));
app.use("/api/memory", require("./src/routes/memory"));
app.use("/api", require("./src/routes/files"));
app.use("/api", require("./src/routes/chats"));

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`Recall running at http://localhost:${PORT}`);
  if (!hasApiKey) {
    console.log("No ANTHROPIC_API_KEY found. Copy .env.example to .env and add your key.");
  }
});
