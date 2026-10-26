// SessionStart (compact) hook: re-prints the Always/Never rules and the in-progress phase.
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const read = (f) => {
  try {
    return readFileSync(path.join(root, f), "utf8");
  } catch {
    return "";
  }
};

const claude = read("CLAUDE.md");
const start = claude.indexOf("## Always");
const rules = start >= 0 ? claude.slice(start).split(/\n## (?!Always|Never)/)[0] : "";
const phase = read("docs/ai/PROGRESS.md")
  .split("\n")
  .filter((l) => /in progress/i.test(l));

console.log(rules.trim() || "Never: see CLAUDE.md (could not read it).");
console.log("\nCurrent phase:\n" + (phase.join("\n") || "(none marked in progress)"));
