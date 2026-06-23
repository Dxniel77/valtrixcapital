/**
 * Production build: prisma generate + next build.
 * If prisma generate fails because the query engine DLL is locked (e.g. dev server
 * on Windows), continue when an existing client is present.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runPrisma } from "./prisma-cli.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const prismaClient = path.join(root, "node_modules", ".prisma", "client", "index.js");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  return result.status ?? 1;
}

const genStatus = runPrisma(["generate"], root);
if (genStatus !== 0) {
  if (existsSync(prismaClient)) {
    console.warn(
      "[build] prisma generate failed (engine file may be locked). Using existing Prisma client.",
    );
  } else {
    process.exit(genStatus);
  }
}

const buildStatus = run("npx", ["next", "build"]);
process.exit(buildStatus);
