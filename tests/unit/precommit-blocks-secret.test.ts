import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, copyFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";

const hasGitleaks = spawnSync("gitleaks", ["version"]).status === 0;

it.skipIf(!hasGitleaks)(
  "pre-commit hook blocks a staged secret and redacts it",
  () => {
    const dir = mkdtempSync(path.join(tmpdir(), "hook-"));
    const git = (...args: string[]) =>
      spawnSync("git", args, { cwd: dir, encoding: "utf8" });
    git("init", "-q");
    git("config", "user.email", "t@example.com");
    git("config", "user.name", "t");
    const hook = path.join(dir, "pre-commit");
    copyFileSync(path.resolve(".githooks/pre-commit"), hook);
    chmodSync(hook, 0o755);
    git("config", "core.hooksPath", dir);

    const token =
      "ghp_" +
      randomBytes(27).toString("base64url").replace(/[-_]/g, "a").slice(0, 36);
    writeFileSync(path.join(dir, "leak.txt"), `token = "${token}"\n`);
    git("add", "leak.txt");
    const res = git("commit", "-m", "leak");

    expect(res.status).not.toBe(0);
    expect(res.stdout + res.stderr).not.toContain(token);
  },
);
