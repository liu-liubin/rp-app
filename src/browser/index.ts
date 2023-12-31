import { BrowserView, BrowserWindow, BrowserWindowConstructorOptions as Options, app, shell, screen } from 'electron';
import {
  BROWSER_DEFAULT_HEIGHT,
  BROWSER_DEFAULT_WIDTH,
  HOME_BROWSER_MIN_HEIGHT,
  HOME_BROWSER_MIN_WIDTH,
  ENT_RELEASE,
  LOADING_WINDOW_HEIGHT,
  LOADING_WINDOW_WIDTH,
  MAC_OS_CHROME_USER_AGENT,
  WINDOW_CHROME_USER_AGENT,
} from '../constants';
import Logger from '../logger';
import { ChannelTypes } from '../constants/enum';
import store, { memoryCache } from '../store';

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
  protected failedInfo: unknown[] = [];
  protected loadingBrowserView: LoadingBrowserView | undefined; // 实验性功能

  private _hide;
  private _minimize;

  public moduleName: WindowModule = WindowModule.Normal;
  public windowMode:'maximize'|'fullscreen'|'minimize'|'normal' = 'normal';
  public tag = MAIN_TAG_NAME;
  public url = '';
  /** 标记 - 当窗口为隐藏状态时作为标记是否再次显示 ; 使用后请消除标记  */
  public showAgain = false; 
  /** 状态转变事件为webContents.dom-ready view是否加载了url；加载过则不再重新加载； 需要重新加载使用reload */
  public isLoaded = false;
  /** 调用 ChannelTypes.Show 时设置当前窗口的主机名称 */
  public hostname = '';

  constructor(options: Options = {}) {
    super({
      title: '摹客RP',
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: {x: 8, y: 5},
      ...options,
      frame: false,
      show: false,
      webPreferences: {
        ...(options.webPreferences || {}),
        nodeIntegration: true,
        preload: MAIN_APP_PRELOAD_WEBPACK_ENTRY,
      },
      paintWhenInitiallyHidden: false,  // 设置为false页面可见不再触发ready-to-sho，只有手动调用win.show时触发ready-to-show
    });

    this._hide = super.hide;
    this._minimize = super.minimize;

    this.windowMode = this.isMaximized()
      ? 'maximize'
      : this.isMinimized()
      ? 'minimize'
      : this.isFullScreen()
      ? 'fullscreen'
      : 'normal';

    //注入变量
    process.env.version = app.getVersion();
    process.env.store = JSON.stringify(store.store);
    process.env.windowId = `${this.id}`;
    process.env.web_env = store.get('env');
    process.env.windowMode = this.windowMode;

    this.initBrowserEvent();
    this.initContentsEvent(this);
    this.bounds = this.getNormalBounds();
  }

  view(url: string, opts: LoadContentOptions = {}):boolean {
    if(this.isLoaded){
      Logger.info('[CommonBrowser -> view|load]', `【${this.moduleName}】模块窗口已经载入过！！！`);
      if(this.webContents.getURL().indexOf(url) === -1){
        this.reload(url, opts);
      }
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
    Logger.info('[CommonBrowser -> view]', `【${this.moduleName}】`, `${newUrl}加载的${hasUrl?'是':'不是'}同一个地址`, newQuery);

    if(hasUrl){
      return false;
    }

    if (newUrl.startsWith('http') || newUrl.startsWith('file:')) {
      this.webContents.loadURL(newUrl, {
        httpReferrer: url,
      });
    } else {
      this.webContents.loadFile(newUrl);
    }
    return true;
  }

  /** 
   * 覆盖原始方法 
   * @return boolean 返回false表示窗口存在并载入了url
   */
  reload(url?:string, query: LoadContentOptions = {}): void {
    Logger.info('[CommonBrowser -> reload', `【${this.moduleName}】重载页面`, url, this.isLoaded);
    this.isLoaded = false;
    if(!url){
      this.webContents.reload()
    }else{
      this.view(url, query);
    }
  }

  hide(): void {
    // Mac 系统全屏模式不能隐藏或最小化
    if(this.isFullScreen() && process.platform === 'darwin'){
      return;
    }
    this._hide();
  }

  minimize(): void {
    // Mac 系统全屏模式不能隐藏或最小化
    if(this.isFullScreen() && process.platform === 'darwin'){
      return;
    }
    this._minimize();
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

  async showLoading() {
    if(!this.isVisible()){
      return;
    }

    Logger.info('[CommonBrowser -> showLoading', `【${this.moduleName}】显示loading`);

    if(!this.loadingBrowserView){
      this.loadingBrowserView  = new LoadingBrowserView();
    }
    this.setBrowserView(this.loadingBrowserView );
    this.setTopBrowserView(this.loadingBrowserView );
    this.loadingBrowserView .setAutoResize({
      width: true,
      height: true,
      vertical: true,
      horizontal: true,
    });
    const [width, height] = this.getSize();
    this.loadingBrowserView .setBounds({
      x: 0,
      y: 0,
      width,
      height,
    });

    // this.webContents.executeJavaScript(`
    // var wrapper = document.createElement('div');
    // wrapper.style.cssText = 'box-shadow:0 0 6px #333;border-radius: 6px;position:fixed;z-index:9999999999;left:50%;top:50%;transform:translate(-50%,-50%)';
    // wrapper.setAttribute('id', '__rp_inject_wrapper')
    // wrapper.innerHTML = \`
    //   <style>
    //   body,html{ pointer-events:none; }
    //   .loading-img{
    //       width: 96px;
    //       height: 96px;
    //       border-radius: 6px;
    //       background-color: #202735;
    //       background-image: url('${gifImg.toDataURL()}');
    //       background-size: 50%;
    //       background-position: center;
    //       background-repeat: no-repeat;
    //   }
    //   </style>
    //   <div class="loading-img"></div>
    //   \`;
    // document.body.appendChild(wrapper);
    // `, true).catch(()=>{
    //   // Logger.info('[CommonBrowser -> showLoading', `发生错误：${err}`);
    // })
  }

  async closeLoading() {
    if(!this.isVisible()){
      return;
    }
    Logger.info('[CommonBrowser -> closeLoading', `【${this.moduleName}】关闭loading`);
    this.loadingBrowserView  && this.loadingBrowserView.setBounds({x:0, y: 0, width:0, height: 0});
    // this.webContents.executeJavaScript(`
    // document.body.removeChild(document.getElementById('__rp_inject_wrapper'));
    // `, true).catch(()=>{
    //   // Logger.info('[CommonBrowser -> closeLoading', `发生错误：${err}`);
    // });
  }

  initContentsEvent(viewWindow: BrowserView | BrowserWindow) {
    const webContents = viewWindow.webContents;

    // 主要用于监听browserView的初始事件
    webContents.on('dom-ready', () => {
      Logger.info(
        `[CommonBrowser -> initContentsEvent] 【${this.moduleName}】 on:dom-ready  show->URL:${webContents.getURL()}`,
      );
      this.isLoaded = true;
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

    /** 载入地址失败触发 （包含所有iframe的加载） */
    webContents.on('did-fail-load', (e, ...args: unknown[]) => {
      const [, , url, isMainFrame] = args;
      Logger.info(
        '[CommonBrowser -> initContentsEvent] did-fail-load',
        `【${this.moduleName}】`,
        `页面错误/崩溃地址：${url}`,
        `是否为主框架：${isMainFrame}`
      );
      if (HTML_ERROR_CRASH_WEBPACK_ENTRY === url || !url) {
        return;
      }
      if(url && (url as string).indexOf(HTML_ERROR_CRASH_WEBPACK_ENTRY) !== -1){
        return;
      }
      if(!isMainFrame){
        return;
      }
      // 如果是发生在启动页面，则需关闭启动Loading
      if(this.moduleName === WindowModule.Login){
        webContents.executeJavaScript(`window.MRPBridge && window.MRPBridge.startup()`,true).then(()=>{
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
    });

    webContents.on('console-message', (e, level, ...args: unknown[]) => {
      (level===2||level==3) && Logger.debug(
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

    webContents.on('will-navigate', (details)=>{
      Logger.info('[CommonBrowser -> initContentsEvent] will-navigate', this.hostname, details.url);
      if(details.isMainFrame && details.url.startsWith('http') && details.url.indexOf(this.hostname)===-1){
        details.preventDefault();
      }
    })

    const defaultUserAgent =  process.platform === 'darwin' ? MAC_OS_CHROME_USER_AGENT : WINDOW_CHROME_USER_AGENT;
    const userAgent = webContents.getUserAgent() || defaultUserAgent;
    webContents.setUserAgent(`${userAgent} mockRPD mockplusrp/${ENT_RELEASE ? 'ENT' : 'PUB'} bate`);

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
      
        // this.show();
        [this,...Array.from(this.viewMap.values())].forEach((view) => {
          view.webContents.send(ChannelTypes.GetTabViews, Array.from(this.viewMap.keys()));
          view.webContents.send(
            ChannelTypes.UpdateWindowMode,
            this.isMaximized()
              ? 'maximize'
              : this.isMinimized()
              ? 'minimize'
              : this.isFullScreen()
              ? 'fullscreen'
              : 'normal',
          );
        });
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
      this.bounds = this.getNormalBounds();
    });

    this.on('move', () => {
      // Logger.info('[CommonBrowser -> initBrowserEvent]', 'on:resize');
      this.bounds = this.getNormalBounds();
      memoryCache.displayCursorPosition = screen.getCursorScreenPoint();
    });

    /** 系统窗口切换，最小化到恢复，都会触发该事件  */
    this.on('show', () => {
      // Logger.info('[CommonBrowser -> initBrowserEvent]', `【${this.moduleName}】` ,'on:show');
    });

    this.on('hide', () => {
      // 
    });

    /** 窗口获得焦点，创建窗口显示时也会触发 */
    this.on('focus', () => {
      memoryCache.displayCursorPosition = screen.getCursorScreenPoint(),
      Logger.info('[CommonBrowser -> initBrowserEvent]', `【${this.moduleName}】` ,'on:focus', memoryCache.displayCursorPosition);
    });

    this.on('unresponsive', ()=>{
      Logger.info('[CommonBrowser -> initBrowserEvent]', `【${this.moduleName}】on:unresponsive`, '网页未响应');
    })

    this.on('maximize', () => {
      Logger.info('[CommonBrowser -> initBrowserEvent]', 'on:maximize', '窗口最大化');
      this.windowMode = 'maximize';
      this.webContents.send(ChannelTypes.UpdateWindowMode, 'maximize');
      this.viewMap.forEach((view) => view.webContents.send(ChannelTypes.UpdateWindowMode, 'maximize'));
    });

    this.on('minimize', () => {
      Logger.info('[CommonBrowser -> initBrowserEvent]', 'on:minimize', '窗口最小化');
      this.windowMode = 'minimize';
      this.webContents.send(ChannelTypes.UpdateWindowMode, 'minimize');
      this.viewMap.forEach((view) => view.webContents.send(ChannelTypes.UpdateWindowMode, 'minimize'));
    });

    this.on('unmaximize', () => {
      Logger.info('[CommonBrowser -> initBrowserEvent]', 'on:unmaximize', '窗口取消最大化');
      this.windowMode = 'normal';
      this.webContents.send(ChannelTypes.UpdateWindowMode, 'normal');
      this.viewMap.forEach((view) => view.webContents.send(ChannelTypes.UpdateWindowMode, 'normal'));
    });

    // this.on('restore', ()=>{
    //     // memoryCache.windowMode[this.moduleName] = 'normal';
    //     this.viewMap.forEach(view=>view.webContents.send(ChannelTypes.UpdateWindowMode, 'normal'));
    // })

    this.on('enter-full-screen', () => {
      Logger.info('[CommonBrowser -> initBrowserEvent]', 'on:enter-full-screen', `【${this.moduleName}】窗口进入全屏状态`);
      if(this.showAgain && this.windowMode !== 'fullscreen'){
        this.showAgain = false;
        this.setFullScreen(false);
        return;
      }
      this.windowMode = 'fullscreen';
      this.webContents.send(ChannelTypes.UpdateWindowMode, 'fullscreen');
      this.viewMap.forEach((view) => view.webContents.send(ChannelTypes.UpdateWindowMode, 'fullscreen'));
    });

    this.on('leave-full-screen', () => {
      Logger.info('[CommonBrowser -> initBrowserEvent]', 'on:leave-full-screen', `【${this.moduleName}】窗口退出全屏状态`);
      this.windowMode = 'normal';
      this.webContents.send(ChannelTypes.UpdateWindowMode, 'normal');
      this.viewMap.forEach((view) => view.webContents.send(ChannelTypes.UpdateWindowMode, 'normal'));
    });

    // 监听窗口关闭事件，接收到此事件时，需销毁对象引用关系；否则进程报错
    this.on('close', () => {
      Logger.warn('[CommonBrowser -> initBrowserEvent]', `【${this.moduleName}】`, 'on:close');

      if (this.moduleName !== WindowModule.Login) {
        this.windowMode!=='fullscreen' && store.set('windowBounds', {
          ...store.get('windowBounds'),
          [`${this.moduleName}`]: this.bounds,
        });
        memoryCache.displayCursorPosition = {x:0, y:0}
      }

      WindowManager.removeWindow(this.moduleName, this.tag);
      this.initEvent['closed']?.();
    });
  }

  /**暂未启用 */
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

  /**
   * 钩子 **
   * 当前窗口已经准备就绪，或者窗口渲染后被关闭等
   */
  public readonly useCompleted = (fn?:(res?:string)=>void)=>{
    let _fn = fn;
    if(this.isLoaded){
      _fn instanceof Function && _fn('loaded');
      _fn = undefined;
    }
    this.once('ready-to-show', ()=>{
      _fn instanceof Function && _fn('show');
      _fn = undefined;
    });
    this.once('close', ()=>{
      _fn instanceof Function && _fn('close');
      _fn = undefined;
    })
  }
}

class LoginBrowser extends CommonBrowser {
  moduleName = WindowModule.Login;
  constructor(options: Options = {}) {
    super({
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      ...options,
      width: 450,
      height: 600,
      show: false,
      trafficLightPosition: { x: -20, y: -20 },
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
      ...EditorBrowser.getInitBounds(options),
    });

    this.initEvent = this.getEvent();
  }

  // 创建新窗口时，偏移处理
  static getInitBounds(options:Options){
    const bounds = Object.assign({}, store.get('windowBounds')[`${WindowModule.Editor}`] || {}, options);
    const newBounds:Partial<Electron.Rectangle> =  {
      width: bounds.width ?? BROWSER_DEFAULT_WIDTH, 
      height: bounds.height ?? BROWSER_DEFAULT_HEIGHT
    }
    if(bounds.x){
      newBounds.x =  bounds.x  + (WindowManager.getModuleWindow(WindowModule.Editor)?.size ?? 0) * 10 // x偏移量
    }
    if(bounds.y){
      newBounds.y =  bounds.y  + (WindowManager.getModuleWindow(WindowModule.Editor)?.size ?? 0) * 10 // y偏移量
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
      ...options,
    });
    // this.maximize();
    // process.env.windowMode = 'maximize';
    // this.once('ready-to-show', () => {
    //   this.maximize();
    // });
  }
}

/**
 * 注意： 作为模态窗口，显示/隐藏需要与父窗口同时设置
 */
class LoadingBrowserView extends BrowserView {
  constructor(options: Options = {}) {
    super({
      // width: LOADING_WINDOW_WIDTH,
      // height: LOADING_WINDOW_HEIGHT,
      // minWidth: LOADING_WINDOW_WIDTH,
      // minHeight: LOADING_WINDOW_HEIGHT,
      // resizable: false,
      // transparent: true,
      // frame: false,
      // show: false,
      // titleBarStyle: 'hidden',
      // trafficLightPosition: { x: -20, y: -20 },
      // webPreferences: {
      //   nodeIntegration: true,
      //   preload: MAIN_APP_PRELOAD_WEBPACK_ENTRY,
      // },
      ...options,
    });

    Logger.info('[LoadingBrowser -> constructor] ', `Loading窗口：${HTML_LOADING_WEBPACK_ENTRY}`);

    this.webContents.loadURL(HTML_LOADING_WEBPACK_ENTRY);
    // this.setBackgroundColor('rgba(0,0,0,0)');
  

  }

  async parentInsertCSS(){
    // const parentContents =  this.getParentWindow()?.webContents;
    // await (parentContents||this.webContents)?.executeJavaScript(`document.documentElement.style.cssText = 'pointer-events:none';`);
  }

  async parentRemoveCSS(){
    // const parentContents =  this.getParentWindow()?.webContents;
    // await (parentContents||this.webContents)?.executeJavaScript(`document.documentElement.style.cssText = '';`);
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
    
    // 可能重复窗口的BUG - 登录为特殊窗口，必须在登录窗口一次性完成； 
    if (win && module!==WindowModule.Login) {
      Logger.info(
        '[WindowManager -> create]',
        `【${module}-[${tag}]】`,
        `窗口已被创建`,
        win?.windowMode
      );
      // 针对mac全屏切换窗口显示的优化处理
      if(process.platform === 'darwin' && !win.isVisible()){
        win.showAgain = true; 
      }
      win.show();
      win.moveTop();
      win.focus();
      return win;
    }

    const extraDisplay = WindowManager.getExtraWindow();
    const primaryDisplayBounds =  screen.getPrimaryDisplay().bounds;
    const winBounds = store.get('windowBounds')[module];
   
    if(winBounds){
      Object.assign(options, winBounds);
    }else{
      Object.assign(options, {
        width: BROWSER_DEFAULT_WIDTH,  //Math.round(primaryDisplayBounds.width * 0.8),
        height: BROWSER_DEFAULT_HEIGHT //Math.round(primaryDisplayBounds.height * 0.8)
      })
    }

    // 首次启用软件 或者单个屏幕 使用记忆位置 
    if (!extraDisplay){
      // 窗口的屏幕外，强制设置为0 - 通常由于外接显示导致
      const xOverflow = options.x && options.x > screen.getPrimaryDisplay().bounds.width - 50;
      const yOverflow = options.y && options.y > screen.getPrimaryDisplay().bounds.height - 50;
      if(xOverflow || yOverflow){
        options.x = 30;
        options.y = 30;
      }
    }else{ // 双屏
        const xIsExtraFocus = memoryCache.displayCursorPosition && memoryCache.displayCursorPosition.x > extraDisplay.bounds.x;
        const yIsExtraFocus = memoryCache.displayCursorPosition && memoryCache.displayCursorPosition.y > extraDisplay.bounds.y;

        // 判断记忆位置既不在主屏也不在副屏范围内
        if( options.x && options.x < primaryDisplayBounds.width && options.y && options.y < primaryDisplayBounds.height){
          /** */
        }else if(options.x && options.x < (extraDisplay.bounds.x+extraDisplay.bounds.width) && options.y && options.y < (extraDisplay.bounds.y+extraDisplay.bounds.height)){
          /** */
        }else{
          if(xIsExtraFocus && yIsExtraFocus){    
              Object.assign(options, {
                x: extraDisplay.bounds.x + 30,
                y: extraDisplay.bounds.y + 30,
              });
          }else{
            delete options.x;
            delete options.y;
          }
        }
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

    Logger.info(
      '[WindowManager -> create]',
      `【${module}-[${tag}]】`,
      `新建窗口:`,win.getBounds(),
      `主屏大小: width: ${primaryDisplayBounds.width};height: ${primaryDisplayBounds.height}`,
      `焦点位置: x: ${memoryCache.displayCursorPosition?.x}; y: ${memoryCache.displayCursorPosition?.y}`,
      `窗口记忆: x: ${options.x};y: ${options.y}`,
      extraDisplay? `外接：x: ${extraDisplay.bounds.x}; y: ${extraDisplay.bounds.y}` : ''
    );
    return win;
  }

  static getExtraWindow(){
    const displays = screen.getAllDisplays();
    // 获取外接屏幕，当前只支持双屏
    const externalDisplay = displays.find((display) => {
      return display.bounds.x !== 0 || display.bounds.y !== 0
    });
    return externalDisplay;
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
