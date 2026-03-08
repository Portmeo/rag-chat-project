import type Database from 'better-sqlite3';
import { Document } from 'langchain/document';
import type { IParentStorage, ParentEntry } from './interfaces.js';

export class SqliteParentStorage implements IParentStorage {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  async saveParents(parents: ParentEntry[]): Promise<void> {
    const insert = this.db.prepare(
      `INSERT OR REPLACE INTO parents (id, filename, content, metadata, created_at)
       VALUES (@id, @filename, @content, @metadata, datetime('now'))`
    );

    const insertMany = this.db.transaction((entries: ParentEntry[]) => {
      for (const entry of entries) {
        insert.run({
          id: entry.id,
          filename: entry.filename,
          content: entry.document.pageContent,
          metadata: JSON.stringify(entry.document.metadata),
        });
      }
    });

    insertMany(parents);
  }

  async getParentsByIds(ids: string[]): Promise<Map<string, Document>> {
    if (ids.length === 0) return new Map();

    const placeholders = ids.map(() => '?').join(',');
    const rows = this.db
      .prepare(`SELECT id, content, metadata FROM parents WHERE id IN (${placeholders})`)
      .all(...ids) as Array<{ id: string; content: string; metadata: string }>;

    const result = new Map<string, Document>();
    for (const row of rows) {
      result.set(
        row.id,
        new Document({
          pageContent: row.content,
          metadata: JSON.parse(row.metadata),
        })
      );
    }
    return result;
  }

  async deleteByFilename(filename: string): Promise<void> {
    this.db.prepare('DELETE FROM parents WHERE filename = ?').run(filename);
  }

  async clear(): Promise<void> {
    this.db.prepare('DELETE FROM parents').run();
  }
}
