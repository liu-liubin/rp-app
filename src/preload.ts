// 在上下文隔离启用的情况下使用预加载
import { contextBridge, ipcRenderer } from 'electron';
// import { WindowModule } from './browser';
import { ChannelTypes } from './constants/enum';
import store, { IStore } from './store';
import { PROGRAM_AUTHOR } from './constants';
import Logger from './logger';

console.info('⚠️当前环境变量为：' + store.get('env'), process.env);
const [, paramsStr] = window.location.href.split('?');
const query: { [k: string]: string } = {};
for (const [key, value] of new window.URLSearchParams(paramsStr).entries()) {
  query[key] = decodeURIComponent(value);
}

let windowMode = 'normal';
const failedInfo:unknown[] = [];

ipcRenderer.on(ChannelTypes.UpdateWindowMode, (e, mode) => {
  windowMode = mode;
});

ipcRenderer.on(ChannelTypes.SetPageFailed, (e, info)=>{
  try {
    failedInfo.concat(info);
  } catch (error) {
    //
  }
});

const Bridge: RPBridge = {
  startup: () => ipcRenderer.invoke(ChannelTypes.Startup),

  /**
   * 打开编辑器
   * @param url
   * @param appID
   * @returns
   */
  toEditor: (url: string, appID?: string) => ipcRenderer.invoke(ChannelTypes.ToEditor, url, appID),
  /**
   * 打开演示
   * @param url
   * @param appID
   * @returns
   */
  toPreview: (url: string, appID?: string) => ipcRenderer.invoke(ChannelTypes.ToPreview, url, appID),
  /**
   * 打开项目管理页
   * @param url
   * @returns
   */
  toHome: (url?: string) => ipcRenderer.invoke(ChannelTypes.ToHome, url),
  setWebStore: (k: string, value: unknown, fn?: (res:{[k:string]:unknown})=>void) => {
    store.set('webStore', {
      ...store.get('webStore'),
      [k]: value,
    });
    if(fn instanceof Function){
      fn(store.get('webStore'));
    }
  },
  getWebStore: (k?: string) => (k ? store.get('webStore')[k] : store.get('webStore')),
  getTabViews: (fn) => {
    ipcRenderer.on(ChannelTypes.GetTabViews, (e, tab: string[]) => {
      fn && fn(tab);
    });
  },

  resetStore: () => ipcRenderer.send(ChannelTypes.ResetStore),
  getStore: () => store.store,
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
      console.log('ChannelTypes.UpdateWindowMode', e, mode);
      fn instanceof Function &&
        fn({
          isMaximize: windowMode === 'maximize',
          isFullscreen: windowMode === 'fullscreen',
          isMinimize: windowMode === 'minimize',
        });
    });
  },

  showAbout: () => ipcRenderer.send(ChannelTypes.ShowAbout),
  getVersion: () => process.env.version,
  getAuthor: () => PROGRAM_AUTHOR,

  onMessage: <T>(fn:(...args:Array<T>)=>void)=> {
    ipcRenderer.on(ChannelTypes.Message, (e, ...items:T[])=>{
      fn instanceof Function && fn(...items);
    });
  },
  postMessage: (...args:unknown[])=> ipcRenderer.send(ChannelTypes.Message, ...args),

  log:(...args:unknown[]) => ipcRenderer.send(ChannelTypes.ConsoleLogger, ...args),
  getInfo: () => { return { 
    config: `${store.path}/config.json`,
    log: Logger.getFile(),
  } },

  query,
  env: store.get('env'),
  setEnv(val: string) {
    // console.warn('⚠️注意：环境变量已发生改变，请重新启动程序');
    store.set('env', val);
  },

  getViewMode() {
    return windowMode;
  },

  getFailedInfo(){
    return failedInfo;
  },

  relaunch: ()=> ipcRenderer.send(ChannelTypes.Relaunch),

  delStore: (k: string) => store.delete(k as keyof IStore),
};

contextBridge.exposeInMainWorld('RPBridge', Bridge);
