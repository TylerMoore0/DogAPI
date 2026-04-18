import { Database } from "bun:sqlite";
import { readFileSync } from "fs";
import { join } from "path";

const DB_PATH = process.env.DB_PATH ?? "daycare.db";

export const db = new Database(DB_PATH, { create: true });

// Enforce foreign keys for every connection. SQLite defaults this off.
db.exec("PRAGMA foreign_keys = ON;");
db.exec("PRAGMA journal_mode = WAL;");

export function initSchema(): void {
    const schemaPath = join(import.meta.dir, "schema.sql");
    const schema = readFileSync(schemaPath, "utf-8");
    db.exec(schema);
}
