
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { INITIAL_SCHEMA } from './schema';

const isDev = !app.isPackaged;

class DatabaseService {
  private db: Database.Database | null = null;
  private dbPath: string | null = null;

  constructor() {
    // Constructor is now empty. Path-dependent logic is deferred.
  }

  /**
   * Initializes the database path and handles renaming from the old app name.
   * This must be called after the app is 'ready'.
   */
  private initializePath(): void {
    if (this.dbPath) return; // Ensure this only runs once

    const oldDbName = 'promptforge.db';
    const dbName = 'docforge.db';
    const userDataPath = app.getPath('userData');
    const oldDbPath = path.join(userDataPath, oldDbName);
    this.dbPath = path.join(userDataPath, dbName);

    // One-time rename of the database file to migrate existing users
    try {
        if (fs.existsSync(oldDbPath) && !fs.existsSync(this.dbPath)) {
            console.log(`Attempting to rename database from ${oldDbName} to ${dbName}...`);
            fs.renameSync(oldDbPath, this.dbPath);
            console.log('Database rename successful.');
        }
    } catch (error) {
        console.error('Failed to rename database file:', error);
    }
  }

  public open(): void {
    try {
      // Initialize the path here, safely after the app is ready.
      this.initializePath();

      if (!this.dbPath) {
        throw new Error('Database path could not be determined.');
      }

      this.db = new Database(this.dbPath, { verbose: isDev ? console.log : undefined });
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      console.log(`Database opened successfully at ${this.dbPath}`);
      this.runMigrations();
    } catch (error) {
      console.error('Failed to open database:', error);
      throw error;
    }
  }

  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('Database connection closed.');
    }
  }
  
  public get isNew(): boolean {
    const stmt = this.db!.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='nodes'");
    const table = stmt.get();
    return !table;
  }

  private runMigrations(): void {
    if (!this.db) throw new Error('Database is not open.');

    const currentVersion = this.db.pragma('user_version', { simple: true }) as number;
    console.log(`Current database version: ${currentVersion}`);

    try {
      this.db.transaction(() => {
        // Migration to version 1: Initial Schema
        if (currentVersion < 1) {
          console.log('Applying migration: version 1 (initial schema)');
          this.db!.exec(INITIAL_SCHEMA);
          this.db!.pragma(`user_version = 1`);
        }

        // Future migrations can be added here, e.g.:
        // if (currentVersion < 2) {
        //   console.log('Applying migration: version 2');
        //   this.db!.exec(MIGRATION_V2_SCRIPT);
        //   this.db!.pragma(`user_version = 2`);
        // }
      })();
      
      const newVersion = this.db.pragma('user_version', { simple: true }) as number;
      if (newVersion > currentVersion) {
        console.log(`Database migrated to version: ${newVersion}`);
      } else {
        console.log('Database is up to date.');
      }

    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  public query(sql: string, params: any[] = []): any[] {
    if (!this.db) throw new Error('Database is not open.');
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(params);
    } catch (error) {
      console.error('Query failed:', { sql, params, error });
      throw error;
    }
  }
  
  public get(sql: string, params: any[] = []): any {
    if (!this.db) throw new Error('Database is not open.');
    try {
      const stmt = this.db.prepare(sql);
      return stmt.get(params);
    } catch (error) {
      console.error('Get query failed:', { sql, params, error });
      throw error;
    }
  }

  public run(sql: string, params: any[] = []): Database.RunResult {
    if (!this.db) throw new Error('Database is not open.');
    try {
      const stmt = this.db.prepare(sql);
      return stmt.run(params);
    } catch (error) {
      console.error('Run command failed:', { sql, params, error });
      throw error;
    }
  }
  
  // Fix: Correct the return type to match what better-sqlite3's transaction method returns.
  // The original 'T' was incorrect as the library wraps the function in a Transaction object.
  public transaction<T extends (...args: any[]) => any>(fn: T): Database.Transaction<T> {
    if (!this.db) throw new Error('Database is not open.');
    return this.db.transaction(fn);
  }
}

// Export a singleton instance
export const databaseService = new DatabaseService();
