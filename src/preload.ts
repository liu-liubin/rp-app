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

interface IRPBridge {

  /** 程序启动 - 请确保在入口页面中调用, 通知页面加载成功并可以正常启动程序 */
  startup: () => Promise<unknown>;

  /** 跳转到RP首页, 设置url， url为空则加载上一次所设置的url窗口 */
  toHome: (url?: string) => Promise<unknown>;
  toEditor: (url: string, appID?: string) => Promise<unknown>; // 跳转到RP编辑页
  toPreview: (url: string, appID?: string) => Promise<unknown>; // 跳转到RP预览页

  setWebStore: (k: string, value: unknown, fn?:(res:{[k:string]:unknown})=>void) => void; // 设置本地缓存数据
  getWebStore: (k: string) => unknown; // 获取本地缓存数据
  getTabViews: (fn: (res: string[]) => void) => void; // 获取当前窗口标签页URL
  resetStore: () => void; // 重置所有配置数据，会重启软件
  getStore: () => void; // 获取所有配置数据
  logout: () => void; // 退出登录

  show: () => Promise<unknown>; // 显示当前窗口
  capturerImage: () => Promise<unknown>; // 截屏窗口
  showLoading: () => void; // 使用客户端Loading，需调用closeLoading关闭，或者页面URL或窗口发生变化时自动关闭

  /** 关闭当前窗口, true 时窗口进程将被销毁， 默认为true */
  close: () => Promise<unknown>;
  /** 关闭所有窗口,  窗口进程将被销毁，  true 时窗口进程将被销毁， 默认为true */
  closeAll: () => void;
  /** 隐藏当前窗口, 不销毁进程 */
  hide: () => void;
  /** 隐藏窗口所有, 不销毁进程 */
  hideAll: () => void;

  closeLoading: () => void; // 关闭loading

  maximize: () => void; // 窗口最大化
  minimize: () => void; // 窗口最小化
  fullscreen: (flag: boolean) => void; // true全屏 false退出全屏 -  flag默认为true
  restore: () => void; // 恢复窗口到普通大小状态

  onWindowMode: (fn: (res: { isMinimize: boolean; isMaximize: boolean; isFullscreen: boolean }) => void) => void; // 监听window显示模式变化
  getViewMode: () => string;

  /** 显示软件信息 */
  showAbout: () => void;
  /** 获取软件版本信息 */
  getVersion: () => string;
  /** 获取软件作者 */
  getAuthor: () => string;

  log: ()=>void;
  /** 获取程序安装信息 */
  getInfo: ()=> { config: string; log: string; },

  env: string; // 当前配置环境
  query: { [k: string]: string }; // url查询参数

  delStore: (k: keyof IStore) => void; // 删除某一个配置缓存，生产环境不可用
}

let windowMode = 'normal';

ipcRenderer.on(ChannelTypes.UpdateWindowMode, (e, mode) => {
  console.log('ChannelTypes.UpdateWindowMode', e, mode);
  windowMode = mode;
});

const Bridge: IRPBridge = {
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

  delStore: (k: keyof IStore) => store.delete(k),
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
  getVersion: () => process.env.npm_package_version,
  getAuthor: () => PROGRAM_AUTHOR,

  log:(...args:unknown[]) => ipcRenderer.send(ChannelTypes.ConsoleLogger, ...args),
  getInfo: () => { return { 
    config: `${store.path}/config.json`,
    log: Logger.getFile(),
  } },

  query,

  get env() {
    return store.get('env');
  },
  set env(val: string) {
    console.warn('⚠️注意：环境变量已发生改变，请重新启动程序');
    store.set('env', val);
  },

  getViewMode() {
    return windowMode;
  },
};

contextBridge.exposeInMainWorld('RPBridge', Bridge);
