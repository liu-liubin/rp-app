// import path from 'path';
// import {app} from 'electron';
import Store from 'electron-store';

// import { MockplusEnv, TEnvType, envType, onDev } from '../helper/env';
// import mockplus from '../mockplus';

interface IApi {
  domain: string;
  loginUrl: string;
  signupUrl: string;
  apiCC: string;
  apiRP: string;
}

export interface IStore {
  lang: string;
  browserOption?: Electron.BrowserWindowConstructorOptions;
  version?: string;  // 安装版本，如果版本更新，则此值在安装并启动应用时更新该值
  env: string;
  webStore: {
    [k:string]: unknown;
  };
  envConfig: Partial<IApi>;
  windowBounds:{[k:string]:Electron.Rectangle};
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
}

const store = new Store<IStore>({
    defaults: {
        lang: 'zh_CN',
        browserOption: { },
        webStore: {},
        env: 'dev',
        envConfig: {
          domain: 'http://192.168.0.128:3004',
          // loginUrl: 'http://192.168.0.152:4004/plugin-signin/:code?type=rp',
          // signupUrl: 'http://192.168.0.152:4004/signup',
          // apiCC: `http://192.168.0.152:5006/api/v1`,
          // apiRP: `/rpapi/v1`,
        },
        windowBounds: {}
    },
});

export const memoryCache:IMemoryCache = {
  tabViews: {}
};

export default store;
