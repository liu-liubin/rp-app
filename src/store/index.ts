// import path from 'path';
// import {app} from 'electron';
import Store from 'electron-store';

// import { MockplusEnv, TEnvType, envType, onDev } from '../helper/env';
// import mockplus from '../mockplus';

export type Env = 'dev' | 'test' | 'prod';

export interface IMemoryCache{
  tabViews: {
    [k:string]: string[]
  };
  windowMode: {
    [k: string]: 'minimize'|'maximize'|'fullscreen'|'normal'
  };
  displayCursorPosition?: {
    x: number;
    y: number;
  }
}

const store = new Store<StoreConfig>({
    defaults: {
        lang: 'zh_CN',
        name: '',
        browserOption: { },
        webStore: {},
        env: 'dev',  // 网页端使用
        debug: true,
        envConfig: {
          // domain: 'http://192.168.0.81:3004',
        },
        windowBounds: {}
    },
});

export const memoryCache:IMemoryCache = {
  tabViews: {},
  windowMode: {},
  displayCursorPosition: undefined
};

export default store;
