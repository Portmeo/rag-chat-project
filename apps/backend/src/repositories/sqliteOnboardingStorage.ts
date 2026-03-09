import type Database from 'better-sqlite3';
import type { IOnboardingStorage, OnboardingQuestion } from './interfaces.js';

export class SqliteOnboardingStorage implements IOnboardingStorage {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  async getAll(): Promise<OnboardingQuestion[]> {
    return this.db.prepare(
      'SELECT id, text, icon, filename, sort_order FROM onboarding_questions ORDER BY sort_order'
    ).all() as OnboardingQuestion[];
  }

  async upsert(question: Omit<OnboardingQuestion, 'id'> & { id?: number }): Promise<void> {
    if (question.id) {
      this.db.prepare(`
        UPDATE onboarding_questions SET text = ?, icon = ?, filename = ?, sort_order = ? WHERE id = ?
      `).run(question.text, question.icon, question.filename, question.sort_order, question.id);
    } else {
      this.db.prepare(`
        INSERT INTO onboarding_questions (text, icon, filename, sort_order) VALUES (?, ?, ?, ?)
      `).run(question.text, question.icon, question.filename, question.sort_order);
    }
  }

  async delete(id: number): Promise<void> {
    this.db.prepare('DELETE FROM onboarding_questions WHERE id = ?').run(id);
  }
}
