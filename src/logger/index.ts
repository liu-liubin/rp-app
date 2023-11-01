import { info, error, warn, debug, transports } from 'electron-log';

/**
 * 
 */
class Logger {
  static info(...params: Array<unknown>): void {
    info(...params);
  }
  static error(...params: Array<string|number>): void {
    error(...params);
  }
  static warn(...params: Array<unknown>): void {
    warn(...params);
  }
  static debug(...params: Array<string|number>): void {
    debug(...params);
  }
  static getFile(): string{
    return transports.file.getFile().path;
  }
}

export default Logger;
