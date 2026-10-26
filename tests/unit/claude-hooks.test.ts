import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const run = (script: string, stdin = "") =>
  spawnSync("node", [`.claude/hooks/${script}`], {
    input: stdin,
    encoding: "utf8",
  });
const protect = (filePath: string) =>
  run(
    "protect-files.mjs",
    JSON.stringify({ tool_input: { file_path: filePath } }),
  );

describe("protect-files hook", () => {
  it.each([
    "/x/.env.local",
    "/x/.env",
    "/x/.github/workflows/ci.yml",
    "/x/.claude/settings.json",
    "/x/.claude/settings.local.json",
    "/x/.claude/hooks/protect-files.mjs",
    "/x/drizzle/0001_x.sql",
    "/x/package-lock.json",
  ])("blocks %s", (p) => {
    const res = protect(p);
    expect(res.status).toBe(2);
    expect(res.stderr).toContain("protected");
  });

  it.each(["/x/src/app/page.tsx", "/x/.env.example"])("allows %s", (p) => {
    expect(protect(p).status).toBe(0);
  });

  it("fails closed on malformed JSON", () => {
    expect(run("protect-files.mjs", "{not json").status).toBe(2);
  });
});

describe("reinject-context hook", () => {
  it("prints the Never list", () => {
    const res = run("reinject-context.mjs");
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("Never");
  });
});
