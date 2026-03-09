import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../../../data/rag.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    mkdirSync(path.dirname(DB_PATH), { recursive: true });
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    runMigrations(_db);
  }
  return _db;
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS parents (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_parents_filename ON parents(filename);

    CREATE TABLE IF NOT EXISTS bm25_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS query_log (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      model TEXT NOT NULL,
      latency_ms INTEGER NOT NULL,
      sources TEXT NOT NULL,
      num_retrieved INTEGER NOT NULL,
      context_size INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_query_log_timestamp ON query_log(timestamp);

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      filename TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS onboarding_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'MessageSquare',
      filename TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Seed onboarding questions if table is empty
  const count = db.prepare('SELECT COUNT(*) as n FROM onboarding_questions').get() as { n: number };
  if (count.n === 0) {
    const insert = db.prepare(
      'INSERT INTO onboarding_questions (text, icon, sort_order) VALUES (?, ?, ?)'
    );
    const seed = db.transaction((questions: { text: string; icon: string; sort_order: number }[]) => {
      for (const q of questions) insert.run(q.text, q.icon, q.sort_order);
    });
    seed([
      { text: '¿Cuál es la arquitectura general del proyecto?', icon: 'Layers', sort_order: 1 },
      { text: '¿Cómo funciona el sistema de autenticación?', icon: 'Shield', sort_order: 2 },
      { text: '¿Qué tecnologías y frameworks se utilizan?', icon: 'Code', sort_order: 3 },
      { text: '¿Cómo está configurado el pipeline de CI/CD?', icon: 'GitCompare', sort_order: 4 },
      { text: '¿Cómo se gestiona el estado de la aplicación?', icon: 'Database', sort_order: 5 },
      { text: '¿Qué convenciones de código sigue el proyecto?', icon: 'BookOpen', sort_order: 6 },
    ]);
  }
}
