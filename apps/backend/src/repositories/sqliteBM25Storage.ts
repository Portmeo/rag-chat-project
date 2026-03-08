import type Database from 'better-sqlite3';
import type { IBM25Storage, SerializedDocument } from './interfaces.js';

export class SqliteBM25Storage implements IBM25Storage {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  async save(documents: SerializedDocument[]): Promise<void> {
    const clear = this.db.prepare('DELETE FROM bm25_documents');
    const insert = this.db.prepare(
      'INSERT INTO bm25_documents (filename, content, metadata) VALUES (@filename, @content, @metadata)'
    );

    const saveAll = this.db.transaction((docs: SerializedDocument[]) => {
      clear.run();
      for (const doc of docs) {
        insert.run({
          filename: doc.filename,
          content: doc.content,
          metadata: JSON.stringify(doc.metadata),
        });
      }
    });

    saveAll(documents);
  }

  async load(): Promise<SerializedDocument[] | null> {
    const rows = this.db
      .prepare('SELECT filename, content, metadata FROM bm25_documents ORDER BY id')
      .all() as Array<{ filename: string; content: string; metadata: string }>;

    if (rows.length === 0) return null;

    return rows.map(row => ({
      filename: row.filename,
      content: row.content,
      metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    }));
  }

  async clear(): Promise<void> {
    this.db.prepare('DELETE FROM bm25_documents').run();
  }
}
