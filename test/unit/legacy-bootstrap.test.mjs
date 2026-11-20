/**
 * Regression test for the production bootstrap failure:
 *   "db: bootstrap failed — SQL_INPUT_ERROR: SQLite input error:
 *    no such column: is_active (at offset 62)"
 *
 * A legacy database whose `users` table predates the `is_active` column made
 * `applySchema()` fail in stage (1) — the CREATE INDEX statements used to live
 * in the same batch as the CREATE TABLEs, which runs BEFORE the ALTER that
 * adds the column. The fix: tables first, column-alignment migrations second,
 * every index third, and the schema_migrations marker only after all of them.
 *
 * This test builds a legacy-shaped database, applies the schema, and asserts
 * the repair is complete and lossless.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createClient } from '@libsql/client';

const dir = mkdtempSync(path.join(tmpdir(), 'bloodferry-legacy-'));
const dbFile = path.join(dir, 'legacy.db');
Object.assign(process.env, {
  NODE_ENV: 'test',
  LOG_LEVEL: 'error',
  JWT_SECRET: 'isolated-test-signing-secret-never-deploy',
  TURSO_DATABASE_URL: `file:${dbFile}`,
  TURSO_AUTH_TOKEN: '',
  SMS_PROVIDER: 'disabled',
  SMTP_ENABLED: '0',
});

before(async () => {
  // Build the legacy database BEFORE the application touches it: a users
  // table without is_active, products without is_active, navigation without
  // is_active — and one pre-existing row in each, to prove no record is lost.
  const c = createClient({ url: `file:${dbFile}` });
  await c.batch([
    `CREATE TABLE users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, phone TEXT NOT NULL,
      password_hash TEXT NOT NULL, is_admin INTEGER NOT NULL DEFAULT 0, role TEXT NOT NULL DEFAULT 'user',
      donation_role TEXT NOT NULL DEFAULT 'Both',
      blood_group TEXT, city TEXT, address_holding TEXT, division TEXT, district TEXT, upazila TEXT,
      union_area TEXT, can_donate INTEGER NOT NULL DEFAULT 0, last_donation TEXT,
      is_verified INTEGER NOT NULL DEFAULT 0, image_file TEXT, session_token TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
    `INSERT INTO users (id, name, email, phone, password_hash, is_admin, role, blood_group, city, division, district, can_donate)
       VALUES ('u-legacy-1', 'Legacy Donor', 'legacy@example.com', '+8801700000001', 'hash', 0, 'user', 'O+', 'Kalai', 'Rajshahi', 'Kalai', 1)`,
    `CREATE TABLE products (
      id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, price REAL NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0, category TEXT, description TEXT, image_file TEXT,
      sales_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
    `INSERT INTO products (id, slug, name, price, stock, category) VALUES
       ('oxy-legacy-1', 'oxy-legacy-1', 'Legacy Oxy 20L', 2500, 7, 'oxygen')`,
    `CREATE TABLE navigation (
      id TEXT PRIMARY KEY, label TEXT NOT NULL, path TEXT NOT NULL UNIQUE,
      title TEXT, purpose TEXT, keywords TEXT, area TEXT NOT NULL DEFAULT 'public',
      section TEXT NOT NULL DEFAULT 'main', icon TEXT, position INTEGER NOT NULL DEFAULT 0,
      requires_auth INTEGER NOT NULL DEFAULT 0, requires_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `INSERT INTO navigation (id, label, path, created_at, updated_at) VALUES
       ('nav-legacy-1', 'Legacy Home', '/', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')`,
  ], 'write');
  c.close();
});

after(async () => {
  const { closeClient } = await import('../../src/db/client.ts');
  closeClient();
  rmSync(dir, { recursive: true, force: true });
});

test('applySchema repairs a legacy database without losing records', async () => {
  const { applySchema } = await import('../../src/db/schema.ts');
  const { all, get, run } = await import('../../src/db/query.ts');

  await applySchema(); // must not throw — previously died at CREATE INDEX idx_users_admin

  // Migrated columns exist now.
  for (const [table, column] of [['users', 'is_active'], ['products', 'is_active'], ['navigation', 'is_active']]) {
    const cols = await all(`PRAGMA table_info(${table})`);
    assert.ok(cols.some((c) => c.name === column), `${table}.${column} missing after migration`);
  }

  // The indexes that previously broke bootstrap now exist.
  const indexes = (await all(`SELECT name FROM sqlite_master WHERE type = 'index'`)).map((r) => r.name);
  for (const idx of ['idx_users_admin', 'idx_users_active', 'idx_products_active', 'idx_nav_area']) {
    assert.ok(indexes.includes(idx), `index ${idx} missing after migration`);
  }

  // Pre-existing records survived and were backfilled with the declared DEFAULT (1 = visible/active).
  const user = await get('SELECT is_active, name FROM users WHERE id = ?', ['u-legacy-1']);
  assert.equal(user.name, 'Legacy Donor');
  assert.equal(user.is_active, 1);
  const product = await get('SELECT is_active, slug FROM products WHERE id = ?', ['oxy-legacy-1']);
  assert.equal(product.slug, 'oxy-legacy-1');
  assert.equal(product.is_active, 1);
  const nav = await get('SELECT is_active FROM navigation WHERE id = ?', ['nav-legacy-1']);
  assert.equal(nav.is_active, 1);

  // The repair is recorded in schema_migrations.
  const marker = await get(`SELECT id FROM schema_migrations WHERE id = 'bootstrap-column-alignment-v1'`);
  assert.equal(marker?.id, 'bootstrap-column-alignment-v1');

  // Re-running is a no-op (idempotent) and does not overwrite backfilled values.
  await run('UPDATE products SET is_active = 0 WHERE id = ?', ['oxy-legacy-1']);
  await applySchema();
  const after2 = await get('SELECT is_active FROM products WHERE id = ?', ['oxy-legacy-1']);
  assert.equal(after2.is_active, 0, 'idempotent re-run must not clobber an admin\'s data');
});
