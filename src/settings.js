// The shared key/value settings, the "broad context" profile the tutor sees for
// every class, and a one-time seed of the student's actual course load.

const { db, now } = require("./db");

const getStmt = db.prepare("SELECT value FROM settings WHERE key = ?");
const setStmt = db.prepare(
  "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
);
const classExistsStmt = db.prepare("SELECT 1 FROM classes WHERE name = ? LIMIT 1");
const insertClassStmt = db.prepare("INSERT INTO classes (name, created_at) VALUES (?, ?)");

function get(key) {
  const row = getStmt.get(key);
  return row ? row.value : null;
}

function set(key, value) {
  setStmt.run(key, value);
}

function getProfile() {
  return get("profile") || "";
}

function setProfile(text) {
  set("profile", (text || "").toString());
}

// The courses on this term's schedule, one class per course (labs and
// discussions fold into their parent course).
const DEFAULT_CLASSES = [
  "CHEM 2090 (General Chemistry)",
  "CS 2800 (Discrete Structures)",
  "MATH 1920 (Multivariable Calculus)",
  "PHYS 1110 (Physics I: Mechanics)",
  "ENGRI 1310 (Intro Engineering)",
  "ENGRG 1050 (Engineering Seminar)",
];

const DEFAULT_PROFILE = [
  "The student is a first-year engineering student at Cornell University. Their full course load this term:",
  "- CHEM 2090 General Chemistry (lecture MoWeFr, plus the CHEM 2091 lab on Thursdays)",
  "- CS 2800 Discrete Structures (lecture MoWeFr, discussion Thursdays)",
  "- MATH 1920 Multivariable Calculus for Engineers (lecture MoWeFr, discussion Mondays)",
  "- PHYS 1110 Physics I: Mechanics (lecture Fridays, lab Tuesdays)",
  "- ENGRI 1310 Introduction to Engineering (lecture TuTh, project lab Wednesdays)",
  "- ENGRG 1050 Engineering advising seminar (Tuesdays)",
  "",
  "Pitch explanations at the level of a strong, motivated first-year engineering student who has seen single-variable calculus. These courses reinforce each other, so connect ideas across them when it helps: the multivariable calculus shows up directly in the physics and the chemistry, and the discrete structures underpins the CS work. Assume standard US-semester intro-engineering textbooks and conventions.",
].join("\n");

// Run once: create the course classes and set the default profile. Guarded so
// deleting a class doesn't make it reappear on the next start.
function seed() {
  if (get("seeded") === "1") return;
  for (const name of DEFAULT_CLASSES) {
    if (!classExistsStmt.get(name)) insertClassStmt.run(name, now());
  }
  if (!get("profile")) set("profile", DEFAULT_PROFILE);
  set("seeded", "1");
}

module.exports = { get, set, getProfile, setProfile, seed };
