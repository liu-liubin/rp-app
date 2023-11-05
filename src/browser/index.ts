import { BrowserView, BrowserWindow, BrowserWindowConstructorOptions as Options, app, shell } from 'electron';
import {
  BROWSER_DEFAULT_HEIGHT,
  BROWSER_DEFAULT_WIDTH,
  HOME_BROWSER_MIN_HEIGHT,
  HOME_BROWSER_MIN_WIDTH,
  isPrivate,
  LOADING_WINDOW_HEIGHT,
  LOADING_WINDOW_WIDTH,
  MAC_OS_CHROME_USER_AGENT,
  WINDOW_CHROME_USER_AGENT,
} from '../constants';
import Logger from '../logger';
import { ChannelTypes } from '../constants/enum';
import store from '../store';

export enum WindowModule {
  Normal = 'normal',
  App = 'app',
  Login = 'login',
  Editor = 'editor',
  Home = 'home',
  Preview = 'preview',
  Loading = 'loading',
}

export enum BrowserWindowEvent {
  ReadyToShow = 'ready-to-show'
}

const MAIN_TAG_NAME = '__main__';

class CommonBrowser extends BrowserWindow {
  protected initEvent: { [k: string]: () => void } = {};
  protected viewMap = new Map<string, BrowserView>();
  protected bounds: Electron.Rectangle;
  protected modalLoadingWindow: BrowserWindow;
  protected failedInfo: unknown[] = [];

  public moduleName: WindowModule = WindowModule.Normal;
  public tag = MAIN_TAG_NAME;
  public url = '';
  /** view是否加载了url；加载过则不再重新加载； 需要重新加载使用reload */
  public isLoaded = false;

  constructor(options: Options = {}) {
    super({
      ...options,
      frame: false,
      show: false,
      titleBarStyle: 'customButtonsOnHover',
      webPreferences: {
        ...(options.webPreferences || {}),
        nodeIntegration: true,
        preload: MAIN_APP_PRELOAD_WEBPACK_ENTRY,
      },
    });

    //注入变量
    process.env.version = app.getVersion();
    process.env.store = JSON.stringify(store.store);
    process.env.windowId = `${this.id}`;
    process.env.web_env = store.get('env');
    process.env.windowMode = this.isMaximized()
      ? 'maximize'
      : this.isMinimized()
      ? 'minimized'
      : this.isFullScreen()
      ? 'fullscreen'
      : 'normal',

    this.modalLoadingWindow = new LoadingBrowser({
      parent: this,
      show: false,
    });

    this.initBrowserEvent();
    this.initContentsEvent(this);
    this.bounds = this.getBounds();
  }

  // loading(){
  //     Logger.info('[CommonBrowser -> loading]', this.loadingView, `窗口是否显示：${this.isVisible()}`);
  //     if(this.loadingView){
  //         this.setTopBrowserView(this.loadingView);
  //         return;
  //     }
  //     this.loadingView = new BrowserView();
  //     this.loadingView.setAutoResize({
  //         width: true,
  //         height: true,
  //         vertical: true,
  //         horizontal: true,
  //     });
  //     this.addBrowserView(this.loadingView);
  //     this.loadingView.webContents.loadURL(HTML_LOADING_WEBPACK_ENTRY);
  // }

  view(url: string, opts: LoadContentOptions = {}):boolean {
    if(this.isLoaded){
      Logger.info('[CommonBrowser -> view|load]', `【${this.moduleName}】模块窗口已经载入过！！！`, );
      return false;
    }
    this.url = url;
    const [urlSite, urlSearch = ''] = url.split('?');

    const query: { [k: string]: string } = {};
    for (const [key, value] of new URLSearchParams(urlSearch).entries()) {
      query[key] = encodeURIComponent(value);
    }

    Object.keys(opts).forEach(k=>{
      query[`__rp_${k}`] = encodeURIComponent(opts[k]);
    });

    const newQuery = Object.entries(query).map( ([k ,v])=> `${k}=${v}` ).join('&');
    const newUrl = [urlSite].concat(newQuery?[newQuery]:[]).join('?');
    const hasUrl = this.webContents.getURL() === newUrl;
    Logger.info('[CommonBrowser -> view]', `【${this.moduleName}】`, `地址已存在：${hasUrl}`,newUrl, newQuery);

    if(hasUrl){
      return false;
    }

    if (newUrl.startsWith('http:') || newUrl.startsWith('file:')) {
      this.webContents.loadURL(newUrl, {
        httpReferrer: url,
      });
    } else {
      this.webContents.loadFile(newUrl);
    }
    this.isLoaded = true;
    return true;
  }

  /** 
   * 覆盖原始方法 
   * @return boolean 返回false表示窗口存在并载入了url
   */
  reload(url?:string, query: LoadContentOptions = {}): void {
    if(!url){
      this.webContents.reload()
    }else{
      this.isLoaded = false;
      this.view(url, query);
    }
  }

  tabView(url?: string, { referrer }:LoadContentOptions = {}) {
    if (!url) {
      Logger.info('[CommonBrowser -> tabView]', 'url为空, 无法加载');
      return;
    }

    const [urlSite, urlSearch = ''] = url.split('?');

    const newQuery = referrer ? `rp_referrer=${encodeURIComponent(referrer)}&` : '' + `${urlSearch}`;
    const newUrl = [urlSite].concat(newQuery ? [newQuery] : []).join('?');

    let viewWindow = this.viewMap.get(newUrl);

    Logger.info('[CommonBrowser -> view]', newUrl, { referrer }, `视图窗口是否存在：${!!viewWindow}`);

    if (viewWindow) {
      this.setTopBrowserView(viewWindow as BrowserView);
    } else {
      this.createViewWindow(newUrl);
      viewWindow = this.viewMap.get(newUrl) as BrowserView;
    }
    if (newUrl.startsWith('http')) {
      viewWindow.webContents.loadURL(newUrl);
    } else {
      viewWindow.webContents.loadFile(newUrl);
    }
  }

  showLoading() {
    const { x, y, width, height } = this.getBounds();
    const { width: loadingWidth, height: loadingHeight } = this.modalLoadingWindow.getBounds();
    this.modalLoadingWindow.setBounds({
      x: x + Math.round((width - loadingWidth) / 2),
      y: y + Math.round((height - loadingHeight) / 2),
      width: loadingWidth,
      height: loadingHeight,
    });
    
    this.modalLoadingWindow.show();
  }

  closeLoading() {
    this.modalLoadingWindow.hide();
  }

  initContentsEvent(viewWindow: BrowserView | BrowserWindow) {
    const webContents = viewWindow.webContents;

    // 主要用于监听browserView的初始事件
    webContents.on('dom-ready', () => {
      Logger.info(
        `[CommonBrowser -> initContentsEvent] 【${this.moduleName}】 on:dom-ready  show->URL:${webContents.getURL()}`,
      );

      // this.show();
    });

    webContents.on('before-input-event', (event, input) => {
      if (input.key.toLocaleLowerCase() === 'f12') {
        Logger.info(
          '[CommonBrowser -> initContentsEvent] on:before-input-event',
          `【${this.moduleName}】`,
          '按下并拦截了F12',
        );
        if (!webContents.isDevToolsOpened()) {
          webContents.openDevTools();
        } else {
          webContents.closeDevTools();
        }
        event.preventDefault();
      }

      if (input.key.toLocaleLowerCase() === 'f5') {
        Logger.info(
          '[CommonBrowser -> initContentsEvent] on:before-input-event',
          `【${this.moduleName}】`,
          '按下并拦截了F5',
        );
        webContents.reload();
        event.preventDefault();
      }
    });

    webContents.on('did-fail-load', (e, ...args: unknown[]) => {
      const [, , url] = args;
      Logger.info(
        '[CommonBrowser -> initContentsEvent] did-fail-load',
        `【${this.moduleName}】`,
        `页面错误/崩溃地址：${url}`
      );
      if (HTML_ERROR_CRASH_WEBPACK_ENTRY === url || !url) {
        return;
      }
      // 如果是发生在启动页面，则需关闭启动Loading
      if(this.moduleName === WindowModule.Login){
        webContents.executeJavaScript(`window.RPBridge && window.RPBridge.startup()`,true).then(()=>{
          Logger.info(
            '[CommonBrowser -> initContentsEvent] did-fail-load',
            `【${this.moduleName}】`,
            `执行了脚本`
          );
        })
      }
      this.show();
      if(!this.view(HTML_ERROR_CRASH_WEBPACK_ENTRY, {referrer: url as string })){
        this.reload(HTML_ERROR_CRASH_WEBPACK_ENTRY, {referrer: url as string });
      }
      this.failedInfo.push(args);
      webContents.send(ChannelTypes.SetPageFailed, this.failedInfo);
    });

    webContents.on('console-message', (e, level, ...args: unknown[]) => {
      store.get('debug') && (level===2||level==3) && Logger.info(
          '[CommonBrowser -> initContentsEvent]',
          `【${this.moduleName}】console-message`,
          webContents.getURL(),
          args
        );
    });

    // 在渲染进程中由 window.open 成功创建窗口之后 触发
    webContents.on('did-create-window', (win, details) => {
      Logger.info(
        '[CommonBrowser -> initContentsEvent] did-create-window',
        `【${this.moduleName}】`,
        `url:${details.url}`,
      );
    });

    // 访问的网站证书的链接验证失败时
    webContents.on('certificate-error', (e, ...args: unknown[]) => {
      const [url, error, certificate] = args;
      Logger.info(
        '[CommonBrowser -> initContentsEvent] did-create-window',
        `【${this.moduleName}】`,
        `url:${url} errorCode: ${error} certificate: ${certificate}`,
      );
    });

    const defaultUserAgent =  process.platform === 'darwin' ? MAC_OS_CHROME_USER_AGENT : WINDOW_CHROME_USER_AGENT;
    const userAgent = webContents.getUserAgent() || defaultUserAgent;
    webContents.setUserAgent(`${userAgent} mockRPD mockplusrp/${isPrivate ? 'ENT' : 'PUB'} bate`);

    // 拦截window.open，并使用`系统默认浏览器跳转
    webContents.setWindowOpenHandler(({ url, referrer }) => {
      Logger.info('[CommonBrowser -> initContentsEvent] setWindowOpenHandler', url, referrer);
      shell.openExternal(url).catch(() => {
        Logger.info('[CommonBrowser -> initContentsEvent] setWindowOpenHandler', url, '打开失败');
      });
      return { action: 'deny' }; //{ action: 'deny' }
    });
  }

  initBrowserEvent() {
    // BrowserView的内容加载不会直接触发该事件， browserWindow.load时触发该事件； 请注意electron官方注解
    this.once(BrowserWindowEvent.ReadyToShow, () => {
      Logger.warn('[CommonBrowser -> initBrowserEvent]', `【${this.moduleName}】`, 'once:ready-to-show');
      if (this.moduleName !== WindowModule.Login) {
        this.show();
        [this,...Array.from(this.viewMap.values())].forEach((view) => {
          view.webContents.send(ChannelTypes.GetTabViews, Array.from(this.viewMap.keys()));
          view.webContents.send(
            ChannelTypes.UpdateWindowMode,
            this.isMaximized()
              ? 'maximize'
              : this.isMinimized()
              ? 'minimized'
              : this.isFullScreen()
              ? 'fullscreen'
              : 'normal',
          );
        });

        // this.modalLoadingWindow.show();

        // TODO 待定！
        // WindowManager.handleWindowReadyShow(this.moduleName, this.tag);
      }
    });

    this.on(BrowserWindowEvent.ReadyToShow, () => {
      Logger.info(
        '[CommonBrowser -> initBrowserEvent]',
        `【${this.moduleName}】`,
        'on:ready-to-show',
        `载入的URL地址：${this.webContents.getURL()}`,
      );
    });

    this.on('resize', () => {
      // Logger.info('[CommonBrowser -> initBrowserEvent]', 'on:resize');
      this.bounds = this.getBounds();
    });

    this.on('move', () => {
      // Logger.info('[CommonBrowser -> initBrowserEvent]', 'on:resize');
      this.bounds = this.getBounds();
    });

    /** 系统窗口切换，最小化到恢复，都会触发该事件  */
    this.on('show', () => {
      // Logger.info('[CommonBrowser -> initBrowserEvent]', `【${this.moduleName}】` ,'on:show');
    });

    this.on('unresponsive', ()=>{
      Logger.info('[CommonBrowser -> initBrowserEvent]', `【${this.moduleName}】on:unresponsive`, '网页未响应');
    })

    this.on('maximize', () => {
      Logger.info('[CommonBrowser -> initBrowserEvent]', 'on:maximize', '窗口最大化');
      this.webContents.send(ChannelTypes.UpdateWindowMode, 'maximize');
      this.viewMap.forEach((view) => view.webContents.send(ChannelTypes.UpdateWindowMode, 'maximize'));
    });

    this.on('minimize', () => {
      Logger.info('[CommonBrowser -> initBrowserEvent]', 'on:minimize', '窗口最小化');
      this.webContents.send(ChannelTypes.UpdateWindowMode, 'minimize');
      this.viewMap.forEach((view) => view.webContents.send(ChannelTypes.UpdateWindowMode, 'minimize'));
    });

    this.on('unmaximize', () => {
      Logger.info('[CommonBrowser -> initBrowserEvent]', 'on:unmaximize', '窗口取消最大化');
      this.webContents.send(ChannelTypes.UpdateWindowMode, 'normal');
      this.viewMap.forEach((view) => view.webContents.send(ChannelTypes.UpdateWindowMode, 'normal'));
    });

    // this.on('restore', ()=>{
    //     console.log('restore',this.isFullScreen(), this.isMaximized(), this.isMinimized())
    //     // memoryCache.windowMode[this.moduleName] = 'normal';
    //     this.viewMap.forEach(view=>view.webContents.send(ChannelTypes.UpdateWindowMode, 'normal'));
    // })

    this.on('enter-full-screen', () => {
      Logger.info('[CommonBrowser -> initBrowserEvent]', 'on:enter-full-screen', '窗口进入全屏状态');
      this.webContents.send(ChannelTypes.UpdateWindowMode, 'fullscreen');
      this.viewMap.forEach((view) => view.webContents.send(ChannelTypes.UpdateWindowMode, 'fullscreen'));
    });

    this.on('leave-full-screen', () => {
      Logger.info('[CommonBrowser -> initBrowserEvent]', 'on:leave-full-screen', '窗口退出全屏状态');
      this.webContents.send(ChannelTypes.UpdateWindowMode, 'normal');
      this.viewMap.forEach((view) => view.webContents.send(ChannelTypes.UpdateWindowMode, 'normal'));
    });

    // 监听窗口关闭事件，接收到此事件时，需销毁对象引用关系；否则进程报错
    this.on('closed', () => {
      Logger.warn('[CommonBrowser -> initBrowserEvent]', `【${this.moduleName}】`, 'on:close');

      if (this.moduleName !== WindowModule.Login) {
        store.set('windowBounds', {
          ...store.get('windowBounds'),
          [`${this.moduleName}`]: this.bounds,
        });
      }

      WindowManager.removeWindow(this.moduleName, this.tag);
      this.initEvent['closed']?.();
    });
  }

  private createViewWindow(url: string) {
    Logger.warn('[CommonBrowser -> createViewWindow]', `【${this.moduleName}】创建视图窗口: ${url}`);

    const viewWindow = new BrowserView({
      webPreferences: {
        nodeIntegration: true,
        preload: MAIN_APP_PRELOAD_WEBPACK_ENTRY,
      },
    });

    this.viewMap.set(url, viewWindow);
    this.initContentsEvent(viewWindow);
    this.addBrowserView(viewWindow);
    this.setTopBrowserView(viewWindow); // 需先将win添加到browser中

    viewWindow.setAutoResize({
      width: true,
      height: true,
      vertical: true,
      horizontal: true,
    });

    const [width, height] = this.getSize();
    viewWindow.setBounds({
      x: 0,
      y: 0,
      width,
      height,
    });
  }
}

class LoginBrowser extends CommonBrowser {
  moduleName = WindowModule.Login;
  constructor(options: Options = {}) {
    super({
      width: 450,
      height: 600,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      ...options,
    });

    this.initEvent = {};
  }
}

class HomeBrowser extends CommonBrowser {
  moduleName = WindowModule.Home;
  constructor(options: Options = {}) {
    super({
      width: BROWSER_DEFAULT_WIDTH,
      height: BROWSER_DEFAULT_HEIGHT,
      show: false,
      minWidth: HOME_BROWSER_MIN_WIDTH,
      minHeight: HOME_BROWSER_MIN_HEIGHT,
      ...options,
    });
  }
}

class EditorBrowser extends CommonBrowser {
  moduleName = WindowModule.Editor;
  constructor(options: Options = {}) {
    super({
      show: false,
      minWidth: HOME_BROWSER_MIN_WIDTH,
      minHeight: HOME_BROWSER_MIN_HEIGHT,
      ...options,
      ...EditorBrowser.getInitBounds(),
    });

    this.initEvent = this.getEvent();
  }

  // 创建新窗口时，偏移处理
  static getInitBounds(){
    const bounds = store.get('windowBounds')[`${WindowModule.Editor}`] || {};
    const newBounds:Partial<Electron.Rectangle> =  {
      width: bounds.width ?? BROWSER_DEFAULT_WIDTH, 
      height: bounds.height ?? BROWSER_DEFAULT_HEIGHT
    }
    if(bounds.x){
      newBounds.x =  bounds.x  + (WindowManager.getModuleWindow(WindowModule.Editor)?.size ?? 0) * 10
    }
    if(bounds.y){
      newBounds.y =  bounds.y  + (WindowManager.getModuleWindow(WindowModule.Editor)?.size ?? 0) * 10
    }
    return newBounds;
  }

  getEvent() {
    return {
      ['closed']: () => {
        Logger.warn('[EditorBrowser -> getEvent]', `【${this.moduleName}】`, 'on:closed');

        if(WindowManager.getModuleWindow(WindowModule.Editor)?.size === 0){
          WindowManager.getWindow(WindowModule.Home)?.show();
        }
      },
    };
  }
}

class PreviewBrowser extends CommonBrowser {
  moduleName = WindowModule.Preview;
  constructor(options: Options = {}) {
    super({
      width: BROWSER_DEFAULT_WIDTH,
      height: BROWSER_DEFAULT_HEIGHT,
      show: false,
      minWidth: HOME_BROWSER_MIN_WIDTH,
      minHeight: HOME_BROWSER_MIN_HEIGHT,
      fullscreenable: true,
      fullscreen: true,
      ...options,
    });

    // this.once('ready-to-show', () => {
    //   this.maximize();
    // });
  }
}

/**
 * 注意： 作为模态窗口，显示/隐藏需要与父窗口同时设置
 */
class LoadingBrowser extends BrowserWindow {
  constructor(options: Options = {}) {
    super({
      width: LOADING_WINDOW_WIDTH,
      height: LOADING_WINDOW_HEIGHT,
      minWidth: LOADING_WINDOW_WIDTH,
      minHeight: LOADING_WINDOW_HEIGHT,
      resizable: false,
      transparent: true,
      alwaysOnTop: true,
      frame: false,
      show: false,
      titleBarStyle: 'customButtonsOnHover',
      trafficLightPosition: { x: -20, y: -20 },
      webPreferences: {
        nodeIntegration: true,
        preload: MAIN_APP_PRELOAD_WEBPACK_ENTRY,
      },
      ...options,
    });

    Logger.info('[LoadingBrowser -> constructor] ', `Loading窗口：${HTML_LOADING_WEBPACK_ENTRY}`);

    this.webContents.loadURL(HTML_LOADING_WEBPACK_ENTRY);

    /** 针对mac的显示隐藏待优化 ===  */
    this.on('show', async ()=>{
      const parentContents =  this.getParentWindow()?.webContents;
      const k = await (parentContents||this.webContents)?.insertCSS(`body,html{pointer-events:none;}`);
      this.once('hide', ()=>{
        const parentContents =  this.getParentWindow()?.webContents;
        k && (parentContents||this.webContents)?.removeInsertedCSS(k);
      })
    })
  }
}


class StartupBrowser extends BrowserWindow {
  protected moduleName = WindowModule.Loading;
  constructor(options: Options = {}) {
    super({
      width: LOADING_WINDOW_WIDTH,
      height: LOADING_WINDOW_HEIGHT,
      minWidth: LOADING_WINDOW_WIDTH,
      minHeight: LOADING_WINDOW_HEIGHT,
      resizable: false,
      transparent: true,
      alwaysOnTop: true,
      frame: false,
      show: false,
      titleBarStyle: 'customButtonsOnHover',
      webPreferences: {
        nodeIntegration: true,
        preload: MAIN_APP_PRELOAD_WEBPACK_ENTRY,
      },
      trafficLightPosition: { x: -20, y: -20 },
      ...options,
    });

    this.webContents.loadURL(HTML_LOADING_WEBPACK_ENTRY);
    
  }
}

class WindowManager {
  private static windowMap = new Map<string, CommonBrowser>();
  private static windowTagMap = new Map<WindowModule, Map<string, CommonBrowser>>();

  private static _homeBrowser: CommonBrowser | null = null;
  private static _loginBrowser: CommonBrowser | null = null;

  /**
   * 创建一个窗口
   * @param module 模块名称
   * @param tag 模块标识
   * @param options 窗口配置
   * @returns
   */
  static create(module: WindowModule, tag = MAIN_TAG_NAME, options: Options = {}): CommonBrowser {
    let win: CommonBrowser | undefined = undefined;
    win = this.getWindow(module, tag);
    Logger.warn(
      '[WindowManager -> create]',
      `【${module}-${tag}】`,
      `窗口是否存在: ${!!win}`,
    );
    if (win) {
      win.show();
      return win;
    }

    if (module === WindowModule.Login) {
      win = new LoginBrowser(options);
      this._loginBrowser = win;
    } else if (module === WindowModule.Home) {
      win = new HomeBrowser(options);
      this._homeBrowser = win;
    } else if (module === WindowModule.Editor) {
      win = new EditorBrowser(options);
    } else if (module === WindowModule.Preview) {
      win = new PreviewBrowser(options);
    } else {
      win = new CommonBrowser(options);
    }
    win.tag = tag;

    if(!this.windowTagMap.has(module)){
      this.windowTagMap.set(module, new Map() );
    }
    this.windowTagMap.get(module)?.set(tag, win);
    this.windowMap.set(`${win.id}`, win);
    return win;
  }

  static getWindow(module: WindowModule, tag: string = MAIN_TAG_NAME) {
    // if (!tag) {
    //   const win = Array.from(this.windowMap.keys())
    //     .filter((key) => key.startsWith(module))
    //     .map((key) => this.windowMap.get(key))
    //     // .find((win) => win?.isFocused());
    //   return win;
    // }
    return this.windowTagMap.get(module)?.get(tag);
  }

  static get homeBrowser() {
    return this._homeBrowser;
  }

  static get loginBrowser() {
    return this._loginBrowser;
  }

  static removeWindow(module: WindowModule, tag = MAIN_TAG_NAME) {
    this.windowTagMap.get(module)?.delete(tag);
    const hasWindow = !!this.getSize();
    if (!hasWindow) {
      app.emit('window-all-closed');
    }
  }

  static getSize() {
    return Array.from(this.windowTagMap.values()).filter(winMap=>winMap.size>0).length;
  }

  /** 获取所有可用窗口 */
  static getAllWindow(): CommonBrowser[] {
    return Array.from(this.windowTagMap.values()).reduce((res, curr)=>res.concat(Array.from(curr.values())), [] as CommonBrowser[]);
  }

  /** 关闭渲染进程窗口并同步删除管理器引用 */
  static closeAllWindow(): void {
    this.getAllWindow().forEach((item) => {
      this.removeWindow(item.moduleName, item.tag);
      item.close();
    });
  }

  /** 获取当前焦点窗口或者可见窗口 */
  static getFocusWindow(): CommonBrowser |undefined {
    return this.getAllWindow().find(win=> win.isFocused() || win.isVisible());
  }

  /** 隐藏所有窗口，窗口进程不销毁，且引用存在 */
  static hideAllWindow(): void {
    this.getAllWindow().forEach((item) => item.hide());
  }

  /** 每个窗口都有id，根据id获取窗口 */
  static fromId(id: string): CommonBrowser | undefined {
    return this.getAllWindow().find(win => `${win.id}`===id);
  }

  /** 获取相关模块所关联的窗口 */
  static getModuleWindow(module:WindowModule){
    return this.windowTagMap.get(module);
  }

  static handleWindowReadyShow = (moduleName: string) => {
    // 首页显示的时候，关闭登录页面
    // if (moduleName === WindowModule.Home) {
    //   this._loginBrowser?.close();
    //   this._loginBrowser = null;
    //   return;
    // }
    if (this.windowMap.size > 1 && !this._homeBrowser?.isDestroyed()) {
      this._homeBrowser?.hide();
    }
    if (moduleName === WindowModule.Login) {
      Array.from(this.windowMap.values()).forEach((win) => {
        if (win.moduleName !== moduleName) {
          win.close();
        }
      });
      this._homeBrowser = null;
    }
    if (moduleName === WindowModule.Home) {
      this._loginBrowser?.close();
    }
  };

  static handleWindowClosed = (moduleName: string) => {
    if (moduleName !== WindowModule.Home) {
      if (this._homeBrowser && !this._homeBrowser.isDestroyed() && !this._homeBrowser.isVisible()) {
        this._homeBrowser?.show();
      }
    }
  };
}

export { StartupBrowser }

export default WindowManager;
