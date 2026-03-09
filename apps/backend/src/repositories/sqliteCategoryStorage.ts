import type Database from 'better-sqlite3';
import type { ICategoryStorage, CategoryEntry } from './interfaces.js';
import { extractCategoryFromFilename } from '../services/rag/categoryExtractor.js';
import { createLogger } from '../lib/logger.js';

const logger = createLogger('CATEGORIES');

export class SqliteCategoryStorage implements ICategoryStorage {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  async upsert(entry: CategoryEntry): Promise<void> {
    this.db.prepare(`
      INSERT INTO categories (name, filename) VALUES (?, ?)
      ON CONFLICT(filename) DO UPDATE SET name = excluded.name
    `).run(entry.name, entry.filename);
  }

  async getAll(): Promise<CategoryEntry[]> {
    return this.db.prepare('SELECT name, filename FROM categories ORDER BY name').all() as CategoryEntry[];
  }

  async deleteByFilename(filename: string): Promise<void> {
    this.db.prepare('DELETE FROM categories WHERE filename = ?').run(filename);
  }

  async backfillFromFilenames(filenames: string[]): Promise<number> {
    const existing = new Set(
      (this.db.prepare('SELECT filename FROM categories').all() as { filename: string }[])
        .map(r => r.filename)
    );

    const missing = filenames.filter(f => !existing.has(f));
    if (missing.length === 0) return 0;

    const stmt = this.db.prepare(`
      INSERT INTO categories (name, filename) VALUES (?, ?)
      ON CONFLICT(filename) DO NOTHING
    `);

    const insertMany = this.db.transaction((entries: { name: string; filename: string }[]) => {
      for (const e of entries) stmt.run(e.name, e.filename);
    });

    const entries = missing.map(f => ({ name: extractCategoryFromFilename(f), filename: f }));
    insertMany(entries);

    logger.log(`Backfilled ${missing.length} categories from existing documents`);
    return missing.length;
  }
}
