declare module 'better-sqlite3' {
  type Numeric = number | bigint;

  export interface RunResult {
    changes: number;
    lastInsertRowid: Numeric;
  }

  export interface Statement {
    run(...params: any[]): RunResult;
    get<T = any>(...params: any[]): T;
    all<T = any>(...params: any[]): T[];
    iterate<T = any>(...params: any[]): IterableIterator<T>;
    pluck(toggleState?: boolean): this;
    raw(toggleState?: boolean): this;
  }

  export interface Transaction {
    (...params: any[]): any;
  }

  export interface DatabaseOptions {
    readonly memory?: boolean;
    readonly readonly?: boolean;
    readonly fileMustExist?: boolean;
    readonly timeout?: number;
  }

  export default class Database {
    constructor(filename: string, options?: DatabaseOptions);
    prepare(sql: string): Statement;
    transaction<T extends (...args: any[]) => any>(fn: T): Transaction;
    exec(sql: string): this;
    pragma(query: string, options?: { simple?: boolean }): any;
    backup(destination: string, options?: { progress?: (info: { totalPages: number; remainingPages: number }) => void }): Promise<void>;
    close(): void;
    defaultSafeIntegers(toggleState?: boolean): this;
  }

  export namespace Database {
    export type RunResult = RunResult;
  }
}
