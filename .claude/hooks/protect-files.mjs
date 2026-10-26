// PreToolUse hook (Edit|Write): exit 2 blocks the edit. Fails closed on bad input.
import { readFileSync } from "node:fs";
import path from "node:path";

const block = (why) => {
  process.stderr.write(`protected path: ${why}. Ask a human to make this change.\n`);
  process.exit(2);
};

let filePath;
try {
  filePath = JSON.parse(readFileSync(0, "utf8"))?.tool_input?.file_path;
} catch {
  block("could not parse hook input");
}
if (typeof filePath !== "string") process.exit(0);

const p = filePath.split(path.sep).join("/");
const base = path.posix.basename(p);

if (base.startsWith(".env") && base !== ".env.example") block(base);
if (/(^|\/)\.github\/workflows\//.test(p)) block("CI workflow");
if (/(^|\/)\.claude\/settings[^/]*\.json$/.test(p)) block("Claude settings");
if (/(^|\/)\.claude\/hooks\//.test(p)) block("Claude hooks");
if (/(^|\/)drizzle\//.test(p)) block("migrations");
if (base === "package-lock.json") block("lockfile");
process.exit(0);
