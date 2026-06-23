import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Run the project's local Prisma CLI (5.x). Never use bare `npx prisma` — that
 * can install Prisma 7, which rejects `url` in schema.prisma.
 */
export function runPrisma(args, cwd = process.cwd()) {
  const prismaEntry = resolve(cwd, "node_modules", "prisma", "build", "index.js");

  if (!existsSync(prismaEntry)) {
    console.error(
      "Prisma is not installed locally (expected prisma@5.x in node_modules).\n" +
        "Run: npm install\n\n" +
        "Do not use bare `npx prisma` — it may install Prisma 7, which is incompatible with this schema.",
    );
    return 1;
  }

  const result = spawnSync(process.execPath, [prismaEntry, ...args], {
    cwd,
    stdio: "inherit",
    env: process.env,
  });

  return result.status ?? 1;
}
