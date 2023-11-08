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
  displayCenterPositio: {
    x: number;
    y:number;
  }
}

const store = new Store<StoreConfig>({
    defaults: {
        lang: 'zh_CN',
        browserOption: { },
        webStore: {},
        env: 'dev',
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
  displayCenterPositio: {x:0, y: 0}
};

export default store;
