// import path from 'path';
// import {app} from 'electron';
import Store from 'electron-store';

// import { MockplusEnv, TEnvType, envType, onDev } from '../helper/env';
// import mockplus from '../mockplus';

interface IEnvConfig {
  /** 配置程序入口页面地址 */
  domain: string; 
  /** 记录程序首页 */
  home: string;
}

export interface IStore {
  lang: string;
  browserOption?: Electron.BrowserWindowConstructorOptions;
  version?: string;  // 安装版本，如果版本更新，则此值在安装并启动应用时更新该值
  env: string;
  debug: boolean;
  webStore: {
    [k:string]: unknown;
  };
  envConfig: Partial<IEnvConfig>;
  windowBounds:{[k:string]:Partial<Electron.Rectangle> |undefined};
  //   env: any; // 当前环境 - 生产包仅读
  //   envConfig?: any, // 环境配置 - 生产包仅读
  //   envOrigin?:string; // 开发测试配置的地址 - 生产包无效
  //   config?: {
  //     dtDomain?: string;
  //     iDocDomain?: string;
  //     rpDomain?: string;
  //   },
  //   autoUpdateOrigin?: string; // 自动更新软件地址
  //   publicOrigin?: string; // 企业发布地址源
  //   publicPath?: string;  // 企业发布目录
  //   installedUse?: boolean; // 是否第一次安裝并登錄使用過
  //   webStore:Record<string,any>;
}

export interface IMemoryCache{
  tabViews: {
    [k:string]: string[]
  };
  windowMode: {
    [k: string]: 'minimize'|'maximize'|'fullscreen'|'normal'
  };
}

const store = new Store<IStore>({
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
};

export default store;
