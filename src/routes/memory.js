// Deleting a single struggle note, so you can prune anything the extractor
// got wrong or that you've since mastered.

const express = require("express");
const { deleteMemory } = require("../memory");

const router = express.Router();

router.delete("/:id", (req, res) => {
  deleteMemory(req.params.id);
  res.status(204).end();
});

module.exports = router;
