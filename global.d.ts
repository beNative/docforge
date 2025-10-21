declare module 'vite' {
  export interface ConfigEnv {
    command: 'build' | 'serve';
    mode: string;
  }

  export type UserConfig = Record<string, unknown>;

  export type PluginOption = unknown;

  export function defineConfig(config: UserConfig | ((env: ConfigEnv) => UserConfig)): UserConfig;
  export function loadEnv(mode: string, root?: string, prefix?: string): Record<string, string>;
}

declare module '@vitejs/plugin-react' {
  import type { PluginOption } from 'vite';
  const plugin: (options?: Record<string, unknown>) => PluginOption;
  export default plugin;
}

declare module 'better-sqlite3' {
  export interface RunResult {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  export interface Statement<TResult = unknown, TRow = unknown> {
    all(...params: unknown[]): TRow[];
    get(...params: unknown[]): TRow | undefined;
    run(...params: unknown[]): RunResult;
  }

  export interface TransactionWrapper<TArgs extends unknown[], TResult> {
    (...params: TArgs): TResult;
    default(...params: TArgs): TResult;
  }

  export interface BackupOptions {
    progress?: (info: { totalPages: number; remainingPages: number }) => void;
  }

  export default class Database {
    constructor(path: string, options?: { readonly?: boolean; fileMustExist?: boolean; timeout?: number });
    prepare<TResult = unknown, TRow = unknown>(sql: string): Statement<TResult, TRow>;
    exec(sql: string): this;
    pragma<T = unknown>(pragma: string, options?: { simple?: boolean }): T;
    transaction<TArgs extends unknown[], TResult>(
      handler: (...params: TArgs) => TResult,
    ): TransactionWrapper<TArgs, TResult>;
    backup(fileName: string, options?: BackupOptions): Promise<void>;
    close(): void;
  }
}
declare module 'plantuml-encoder';
