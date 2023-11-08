// 在上下文隔离启用的情况下使用预加载
import { contextBridge, ipcRenderer } from 'electron';
import { ChannelTypes } from './constants/enum';
import { PRODUCT_AUTHOR } from './constants';

console.info('⚠️当前环境变量为：' , process.env);
const [, paramsStr] = window.location.href.split('?');
const query: { [k: string]: string } = {};
for (const [key, value] of new window.URLSearchParams(paramsStr).entries()) {
  query[key] = decodeURIComponent(value);
}

const failedInfo:unknown[] = [];

const cacheData: {
  store: Partial<StoreConfig>;
  windowMode: string;
  env: string;
} = {
  store: (()=>{
    try {
      return JSON.parse(process.env.store);
    } catch (error) {
      return {}
    }
  })(),
  windowMode: process.env.windowMode,
  env: process.env.web_env
}


const Bridge: RPBridge = {
  startup: (auth) => ipcRenderer.invoke(ChannelTypes.StartupLoaded, auth),

  startUpdater: (url, headers, auth)=> ipcRenderer.send(ChannelTypes.StartAutoUpdater, url, headers, auth),

  /**
   * 打开编辑器
   * @param url
   * @param appID
   * @returns
   */
  toEditor: (url: string, appID?: string) => ipcRenderer.invoke(ChannelTypes.ToEditor, process.env.windowId, url, appID),
  /**
   * 打开演示
   * @param url
   * @param appID
   * @returns
   */
  toPreview: (url: string, appID?: string) => ipcRenderer.invoke(ChannelTypes.ToPreview,process.env.windowId, url, appID),
  /**
   * 打开项目管理页
   * @param url
   * @returns
   */
  toHome: (url?: string) => ipcRenderer.invoke(ChannelTypes.ToHome,process.env.windowId, url),
  setWebStore: (k: string, value: unknown) => {
    // 临时存储 - web刷新消失
    cacheData.store.webStore = {
      ...(cacheData.store.webStore||{}),
      [k]: value
    }
    // 实际存储 - 永久
    ipcRenderer.send(ChannelTypes.SetStore, 'webStore', cacheData.store.webStore);
    // web共享 - web刷新可用
    process.env.store = JSON.stringify(cacheData.store);
    // if(fn instanceof Function){
    //   fn(store.get('webStore'));
    // }
  },
  getWebStore: (k?: string) => k ? cacheData.store.webStore?.[k] : cacheData.store.webStore,
  getTabViews: (fn) => {
    ipcRenderer.on(ChannelTypes.GetTabViews, (e, tab: string[]) => {
      fn && fn(tab);
    });
  },

  resetStore: () => ipcRenderer.send(ChannelTypes.ResetStore),
  getStore: () => cacheData.store,
  logout: () => ipcRenderer.send(ChannelTypes.Logout),
  close: () => ipcRenderer.invoke(ChannelTypes.Close, process.env.windowId),
  closeAll: () => ipcRenderer.send(ChannelTypes.CloseAll),
  show: () => ipcRenderer.invoke(ChannelTypes.Show, process.env.windowId),

  hide: () => ipcRenderer.send(ChannelTypes.Close, process.env.windowId, false),
  hideAll: () => ipcRenderer.send(ChannelTypes.CloseAll, false),

  capturerImage: ()=> ipcRenderer.invoke(ChannelTypes.CapturePage, process.env.windowId),

  showLoading: () => ipcRenderer.send(ChannelTypes.ShowLoading, process.env.windowId),
  closeLoading: () => ipcRenderer.send(ChannelTypes.CloseLoading, process.env.windowId),

  minimize: () => ipcRenderer.send(ChannelTypes.Minimize, process.env.windowId),
  maximize: () => ipcRenderer.send(ChannelTypes.Maximize, process.env.windowId),
  fullscreen: (flag = true) => ipcRenderer.send(ChannelTypes.Fullscreen, process.env.windowId, flag),
  restore: () => ipcRenderer.send(ChannelTypes.Restore),

  onWindowMode: (fn) => {
    ipcRenderer.on(ChannelTypes.UpdateWindowMode, (e, mode) => {
      cacheData.windowMode = mode;
      process.env.windowMode = mode;
      fn instanceof Function &&
        fn({
          isMaximize: mode === 'maximize',
          isFullscreen: mode === 'fullscreen',
          isMinimize: mode === 'minimize',
        });
    });
  },

  showAbout: () => ipcRenderer.send(ChannelTypes.ShowAbout),
  getVersion: () => process.env.version,
  getAuthor: () => PRODUCT_AUTHOR,

  onMessage: <T>(fn:(...args:Array<T>)=>void)=> {
    ipcRenderer.on(ChannelTypes.Message, (e, ...items:T[])=>{
      fn instanceof Function && fn(...items);
    });
  },
  postMessage: (...args:unknown[])=> ipcRenderer.send(ChannelTypes.Message, ...args),

  log:(...args:unknown[]) => ipcRenderer.send(ChannelTypes.ConsoleLogger, ...args),
  getInfo: () => { return { 
    // config: `${store.path}/config.json`,
    // log: Logger.getFile(),
  } },

  query,
  env:  cacheData.env, // 变更后需刷新
  setEnv(val) {
    if(!val){
      return;
    }
    if(process.env.node_env === 'prod'){
      console.log('当前不支持配置环境')
      return;
    }
    process.env.web_env = val;
    ipcRenderer.send(ChannelTypes.SetWebEnv, val);
  },

  getViewMode: ()=> cacheData.windowMode,

  getFailedInfo(){
    return failedInfo;
  },

  relaunch: ()=> ipcRenderer.send(ChannelTypes.Relaunch),

  delStore: () => { 
    // 
  } // store.delete(k as keyof IStore),
};

contextBridge.exposeInMainWorld('RPBridge', Bridge);
