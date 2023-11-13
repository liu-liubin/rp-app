import type {PathVariables} from 'electron-log';
import fs from 'fs-extra';
import path from 'path';
import Log, { info, error, warn, debug } from 'electron-log';
import store from '../store';

/**
 * 
 */
class Logger {
  static __path = '';
  static info(...params: Array<unknown>): void {
    Log.transports.file.fileName = 'main.log';
    info(...params);
  }
  static error(...params: Array<unknown>): void {
    error(...params);
  }
  static warn(...params: Array<unknown>): void {
    warn(...params);
  }
  static debug(...params: Array<unknown>): void {
    if(!store.get('debug')){
      return;
    }
    Log.transports.file.fileName = 'debug.log';
    debug(...params);
  }
  static runtime(...params: Array<unknown>){
    Log.transports.file.fileName = 'runtime.log';
    info(...params);
  }
  static removeRuntime(){
    const file = Log.transports.file.resolvePath({fileName: 'runtime.log'} as PathVariables);
    fs.writeFile(file, '', {encoding:'utf-8'});
  }
  static getFile(): string{
    return this.logPath;
  }

  static get logPath(){
    return this.__path || Log.transports.file.getFile().path;
  }
  static set logPath(_path:string){
    this.__path = _path;
    Log.transports.file.resolvePath = (vars:PathVariables)=>{
      return path.resolve(this.__path, vars.fileName || 'main.log');
    }
  }
}

export {Log};

export default Logger;
