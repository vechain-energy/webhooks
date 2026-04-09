import pino, { type Logger } from 'pino';

import type { LogLevel } from './types.js';

export function createLogger(level: LogLevel): Logger {
  return pino({
    level,
    base: null,
    timestamp: pino.stdTimeFunctions.isoTime
  });
}
