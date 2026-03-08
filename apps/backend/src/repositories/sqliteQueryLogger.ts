import type Database from 'better-sqlite3';
import type { IQueryLogger, QueryLogEntry } from './interfaces.js';

export class SqliteQueryLogger implements IQueryLogger {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  async log(entry: QueryLogEntry): Promise<void> {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO query_log
         (id, timestamp, question, answer, model, latency_ms, sources, num_retrieved, context_size)
         VALUES (@id, @timestamp, @question, @answer, @model, @latency_ms, @sources, @num_retrieved, @context_size)`
      )
      .run({
        id: entry.id,
        timestamp: entry.timestamp,
        question: entry.question,
        answer: entry.answer,
        model: entry.model,
        latency_ms: entry.latency_ms,
        sources: JSON.stringify(entry.sources),
        num_retrieved: entry.num_retrieved,
        context_size: entry.context_size,
      });
  }

  async getRecent(limit = 50): Promise<QueryLogEntry[]> {
    const rows = this.db
      .prepare(
        `SELECT id, timestamp, question, answer, model, latency_ms, sources, num_retrieved, context_size
         FROM query_log ORDER BY timestamp DESC LIMIT ?`
      )
      .all(limit) as Array<Omit<QueryLogEntry, 'sources'> & { sources: string }>;

    return rows.map(row => ({
      ...row,
      sources: JSON.parse(row.sources),
    }));
  }
}
