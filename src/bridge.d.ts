declare interface Window {
  RPBridge?: {
    /** 程序启动 - 请确保在入口页面中调用, 通知页面加载成功并可以正常启动程序 */
  startup: () => Promise<unknown>;

  /**跳转到RP首页, 设置url， url为空则加载上一次所设置的url窗口 */
  toHome: (url?: string) => Promise<unknown>;
  toEditor: (url: string, appID: string) => Promise<unknown>; // 跳转到RP编辑页
  toPreview: (url: string, appID: string) => Promise<unknown>; // 跳转到RP预览页

  setWebStore: (k: string, value: unknown) => void; // 设置本地缓存数据
  getWebStore: (k: string) => unknown; // 获取本地缓存数据
  getTabViews: (fn: (res: string[]) => void) => void; // 获取当前窗口标签页URL
  resetStore: () => void; // 重置所有配置数据，会重启软件
  getStore: () => void; // 获取所有配置数据
  logout: () => void; // 退出登录

  show: () => void; // 显示当前窗口
  capturerImage: () => Promise<unknown>; // 截屏窗口
  showLoading: () => void; // 使用客户端Loading，需调用closeLoading关闭，或者页面URL或窗口发生变化时自动关闭

  /** 关闭当前窗口, true 时窗口进程将被销毁， 默认为true */
  close: () => void;
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

  env: string; // 当前配置环境
  query: { [k: string]: string }; // url查询参数

  delStore: (k: keyof IStore) => void; // 删除某一个配置缓存，生产环境不可用
  }
}

interface LoadContentOptions {
  referrer: string;
}