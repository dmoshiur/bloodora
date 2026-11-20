/**
 * Database CLI: `npm run db:init` | `npm run db:backup`
 *
 * db:init   — apply schema + seeds (idempotent).
 * db:backup — dump every table to data/backup-<timestamp>.json (dev utility).
 */
import fs from "node:fs";
import path from "node:path";
import { bootstrapDatabase } from "./db/init.js";
import { closeClient } from "./db/client.js";
import { get, transaction } from "./db/query.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  const command = process.argv[2] || "init";

  if (command === "init") {
    await bootstrapDatabase();
    const users = await get<{ n: number }>(`SELECT COUNT(*) AS n FROM users`);
    const products = await get<{ n: number }>(`SELECT COUNT(*) AS n FROM products`);
    logger.info("db:init: done", { users: users?.n ?? 0, products: products?.n ?? 0 });
  } else if (command === "backup") {
    // Backups must not run migrations/seeds before capturing the original data.
    const out = await transaction(async tx => {
      const tables = await tx.all<{name: string; sql: string}>("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
      const data: Record<string, unknown[]> = {};
      for (const table of tables) {
        const quoted = '"' + table.name.replaceAll('"', '""') + '"';
        data[table.name] = await tx.all(`SELECT * FROM ${quoted}`);
      }
      return { format: "bloodferry-backup-v1", created_at: new Date().toISOString(), schema: tables, data };
    }, "read");
    const dir = path.resolve(process.cwd(), "data");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(file, JSON.stringify(out, (_key, value) => {
      if (value instanceof ArrayBuffer) return { type: "blob", base64: Buffer.from(value).toString("base64") };
      if (ArrayBuffer.isView(value)) return { type: "blob", base64: Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString("base64") };
      return value;
    }, 2), { mode: 0o600 });
    logger.info("db:backup: written", { file });
  } else {
    console.error(`Unknown command: ${command} (use init | backup)`);
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    logger.error("db-cli: failed", { err: String(err) });
    process.exitCode = 1;
  })
  .finally(() => closeClient());
