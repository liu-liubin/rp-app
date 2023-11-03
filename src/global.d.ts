declare const MAIN_APP_PRELOAD_WEBPACK_ENTRY: string;
declare const MAIN_APP_WEBPACK_ENTRY: string;

declare const HTML_ERROR_WEBPACK_ENTRY: string;
declare const HTML_ERROR_CRASH_WEBPACK_ENTRY: string;

declare const HTML_LOADING_WEBPACK_ENTRY: string;

declare namespace NodeJS {
  interface Process {
    env: {
      moduleName: string;
      version: string;
      windowId: string;
    }
  }
}

declare interface RPBridge {
  /** 程序启动 - 请确保在入口页面中调用, 通知页面加载成功并可以正常启动程序 */
  startup: () => Promise<unknown>;

  /** 
   * 跳转到RP首页, 设置url， url为空则加载上一次所设置的url窗口 
   * Promise返回将发生在ready-to-show事件里
   */
  toHome: (url?: string) => Promise<unknown>;
  toEditor: (url: string, appID?: string) => Promise<unknown>; // 跳转到RP编辑页
  toPreview: (url: string, appID?: string) => Promise<unknown>; // 跳转到RP预览页

  setWebStore: (k: string, value: unknown, fn?: (res: { [k: string]: unknown }) => void) => void; // 设置本地缓存数据
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
  /** 接收来自任意渲染进程的消息 */
  onMessage: <T>(fn: (...args: T[]) => void) => void;
  /** 向所有使用了onMessage的事件的渲染进程发送消息 */
  postMessage: (...args: unknown[]) => void;
  /** 接收网页日志并记录到本机缓存中 */
  log: () => void;
  /** 获取程序安装信息 */
  getInfo: () => { config: string; log: string; };
  /** 获取页面加载失败或崩溃的信息 */
  getFailedInfo: ()=> unknown[];

  setEnv: (val:string) => void;
  /** 当前配置环境 */
  env: string;
  /** url查询参数 */
  query: { [k: string]: string };

  relaunch: ()=> void;
  delStore: (k: string) => void; // 删除某一个配置缓存，生产环境不可用
}


declare module '*.png';