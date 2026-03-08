import { getDb } from '../lib/database.js';
import { SqliteParentStorage } from './sqliteParentStorage.js';
import { SqliteBM25Storage } from './sqliteBM25Storage.js';
import { SqliteQueryLogger } from './sqliteQueryLogger.js';
import type { IParentStorage, IBM25Storage, IQueryLogger } from './interfaces.js';

const db = getDb();

export const parentStorage: IParentStorage = new SqliteParentStorage(db);
export const bm25Storage: IBM25Storage = new SqliteBM25Storage(db);
export const queryLogger: IQueryLogger = new SqliteQueryLogger(db);

export type { IParentStorage, IBM25Storage, IQueryLogger };
export type { ParentEntry, SerializedDocument, QueryLogEntry, QueryLogSource } from './interfaces.js';
