// Reading and editing the broad-context profile that gets sent with every class.

const express = require("express");
const { getProfile, setProfile } = require("../settings");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({ profile: getProfile() });
});

router.put("/", (req, res) => {
  setProfile(req.body.profile || "");
  res.json({ profile: getProfile() });
});

module.exports = router;
