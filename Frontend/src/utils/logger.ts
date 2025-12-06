/**
 * Logger utility - Structured logging system
 * Only logs errors and critical information
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

class Logger {
  private enabled: boolean = __DEV__;
  private minLevel: LogLevel = 'error'; // Only errors by default in production

  constructor() {
    // In development, show warnings and errors
    if (__DEV__) {
      this.minLevel = 'warn';
    }
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.enabled) return false;
    
    const levels: LogLevel[] = ['error', 'warn', 'info', 'debug'];
    return levels.indexOf(level) <= levels.indexOf(this.minLevel);
  }

  error(component: string, message: string, error?: any): void {
    if (this.shouldLog('error')) {
      console.error(`[${component}] ERROR: ${message}`, error || '');
    }
  }

  warn(component: string, message: string, data?: any): void {
    if (this.shouldLog('warn')) {
      console.warn(`[${component}] WARN: ${message}`, data || '');
    }
  }

  info(component: string, message: string, data?: any): void {
    if (this.shouldLog('info')) {
      console.log(`[${component}] ${message}`, data || '');
    }
  }

  debug(component: string, message: string, data?: any): void {
    if (this.shouldLog('debug')) {
      console.log(`[${component}] DEBUG: ${message}`, data || '');
    }
  }
}

export const logger = new Logger();

