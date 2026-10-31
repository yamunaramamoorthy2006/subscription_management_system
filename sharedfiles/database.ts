import fs from 'fs';
import path from 'path';
// sql.js CommonJS export
const initSqlJs = require('sql.js');

const DB_DIR = path.resolve(__dirname, '../../../data');
const DB_PATH = path.join(DB_DIR, 'subscription_os.db');
const SCHEMA_PATH = path.resolve(__dirname, 'schema.sql');

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

class DatabaseManager {
  private db: any = null;
  private SQL: any = null;
  private inTransaction: boolean = false;

  async init(): Promise<void> {
    if (this.db) return;

    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    this.SQL = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      this.db = new this.SQL.Database(fileBuffer);
    } else {
      this.db = new this.SQL.Database();
      const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
      this.db.exec(schemaSql);
      this.saveToDisk();
    }

    // Enable foreign keys
    this.db.exec('PRAGMA foreign_keys = ON;');
  }

  saveToDisk(): void {
    if (!this.db || this.inTransaction) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_PATH, buffer);
    } catch (err) {
      console.error('Failed to persist database to disk:', err);
    }
  }

  query<T = any>(sql: string, params: any[] = []): T[] {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(sql);
    if (params && params.length > 0) {
      stmt.bind(params);
    }
    const rows: T[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return rows;
  }

  get<T = any>(sql: string, params: any[] = []): T | undefined {
    const rows = this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : undefined;
  }

  run(sql: string, params: any[] = []): RunResult {
    if (!this.db) throw new Error('Database not initialized');
    if (params && params.length > 0) {
      this.db.run(sql, params);
    } else {
      this.db.run(sql);
    }

    const res = this.db.exec('SELECT last_insert_rowid() AS id, changes() AS changes');
    const lastInsertRowid = res[0]?.values[0]?.[0] !== undefined ? Number(res[0].values[0][0]) : 0;
    const changes = res[0]?.values[0]?.[1] !== undefined ? Number(res[0].values[0][1]) : 0;

    if (!this.inTransaction) {
      this.saveToDisk();
    }
    return { lastInsertRowid, changes };
  }

  exec(sql: string): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.exec(sql);
    if (!this.inTransaction) {
      this.saveToDisk();
    }
  }

  transaction<T>(fn: () => T): T {
    if (!this.db) throw new Error('Database not initialized');
    this.inTransaction = true;
    this.db.exec('BEGIN TRANSACTION;');
    try {
      const result = fn();
      this.db.exec('COMMIT;');
      this.inTransaction = false;
      this.saveToDisk();
      return result;
    } catch (error) {
      try {
        this.db.exec('ROLLBACK;');
      } catch (e) {
        // ignore rollback error if already aborted
      }
      this.inTransaction = false;
      throw error;
    }
  }
}

export const dbManager = new DatabaseManager();
