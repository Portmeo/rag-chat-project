import { getDb } from '../lib/database.js';
import { SqliteParentStorage } from './sqliteParentStorage.js';
import { SqliteBM25Storage } from './sqliteBM25Storage.js';
import { SqliteQueryLogger } from './sqliteQueryLogger.js';
import { SqliteCategoryStorage } from './sqliteCategoryStorage.js';
import { SqliteOnboardingStorage } from './sqliteOnboardingStorage.js';
import type { IParentStorage, IBM25Storage, IQueryLogger, ICategoryStorage, IOnboardingStorage } from './interfaces.js';

const db = getDb();

export const parentStorage: IParentStorage = new SqliteParentStorage(db);
export const bm25Storage: IBM25Storage = new SqliteBM25Storage(db);
export const queryLogger: IQueryLogger = new SqliteQueryLogger(db);
export const categoryStorage: ICategoryStorage = new SqliteCategoryStorage(db);
export const onboardingStorage: IOnboardingStorage = new SqliteOnboardingStorage(db);

export type { IParentStorage, IBM25Storage, IQueryLogger, ICategoryStorage, IOnboardingStorage };
export type { ParentEntry, SerializedDocument, QueryLogEntry, QueryLogSource, CategoryEntry, OnboardingQuestion } from './interfaces.js';
