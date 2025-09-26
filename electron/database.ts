import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

const isDev = !app.isPackaged;

class DatabaseService {
  private db: Database.Database | null = null;
  private readonly dbPath: string;
  private readonly migrationsPath: string;

  constructor() {
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
    
    // Path to migration files.
    this.migrationsPath = isDev
      ? path.join(app.getAppPath(), 'electron/migrations')
      : path.join((process as any).resourcesPath, 'electron/migrations');
  }

  public open(): void {
    try {
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
      const migrationFiles = fs.readdirSync(this.migrationsPath)
        .filter(file => file.endsWith('.sql'))
        .sort();

      this.db.transaction(() => {
        for (const file of migrationFiles) {
          const version = parseInt(file.split('_')[0], 10);
          if (version > currentVersion) {
            console.log(`Applying migration: ${file}`);
            const script = fs.readFileSync(path.join(this.migrationsPath, file), 'utf-8');
            this.db!.exec(script);
            this.db!.pragma(`user_version = ${version}`);
          }
        }
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
  
  public transaction<T extends (...args: any[]) => any>(fn: T): T {
    if (!this.db) throw new Error('Database is not open.');
    return this.db.transaction(fn);
  }
}

// Export a singleton instance
export const databaseService = new DatabaseService();