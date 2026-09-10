/**
 * Application logger (contract C2).
 *
 * `debug` and `info` are development-only: they are no-ops unless
 * `import.meta.env.DEV` is true, so nothing chatty ships to production.
 * `warn` and `error` always reach the console — real failures must stay visible.
 *
 * Diagnostic tools (`utils/databaseDiagnostic.ts`, `utils/detailedDiagnostic.ts`)
 * intentionally keep their own raw `console` calls and must not use this module.
 */

export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

const isDev = (): boolean => import.meta.env.DEV === true;

const makeLogger = (scope?: string): Logger => {
  const prefix: string[] = scope ? [`[${scope}]`] : [];

  return {
    debug: (...args: unknown[]): void => {
      if (isDev()) console.debug(...prefix, ...args);
    },
    info: (...args: unknown[]): void => {
      if (isDev()) console.info(...prefix, ...args);
    },
    warn: (...args: unknown[]): void => {
      console.warn(...prefix, ...args);
    },
    error: (...args: unknown[]): void => {
      console.error(...prefix, ...args);
    },
  };
};

/** Unscoped application logger. */
export const logger: Logger = makeLogger();

/** Returns a logger that prefixes every line with `[scope]`. */
export function createLogger(scope: string): Logger {
  return makeLogger(scope);
}
