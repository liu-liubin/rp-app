import { BrowserView, BrowserWindow, BrowserWindowConstructorOptions as Options, shell } from 'electron';
import {memoryCache} from '../store';
import { BROWSER_DEFAULT_HEIGHT, BROWSER_DEFAULT_WIDTH, HOME_BROWSER_MIN_HEIGHT, HOME_BROWSER_MIN_WIDTH, isPrivate } from '../constants';
import Logger from '../logger';
import { ChannelTypes } from '../constants/enum';

export enum WindowModule {
    Normal = 'normal',
    App = 'app',
    Login = 'login',
    Editor = 'editor',
    Home = 'home',
    Preview = 'preview'
}

class CommonBrowser extends BrowserWindow {
    protected moduleName = WindowModule.Normal;
    protected viewMap = new Map<string, BrowserView>();
    protected loadingView:BrowserView|undefined;

    constructor(options?: Options, moduleName?:WindowModule){
        super({
            ...options,
            frame: false,
            show: false,
            titleBarStyle: 'customButtonsOnHover',
            webPreferences: {
                preload: LOGIN_WINDOW_PRELOAD_WEBPACK_ENTRY
            }
        });
        this.moduleName = moduleName || WindowModule.Normal;
        process.env.moduleName = this.moduleName;
        this.initBrowserEvent();
        this.loading();
    }

    loading(){
        Logger.info('[CommonBrowser -> loading]', this.loadingView);
        if(this.loadingView){
            this.setTopBrowserView(this.loadingView);
            return;
        }
        this.webContents.loadURL(HTML_LOADING_WEBPACK_ENTRY);
        this.loadingView = new BrowserView();
        this.loadingView.setAutoResize({
            width: true,
            height: true,
            vertical: true,
            horizontal: true,
        });
        this.addBrowserView(this.loadingView);
        this.loadingView.webContents.loadURL(HTML_LOADING_WEBPACK_ENTRY);
    }

    load(url?: string){
        Logger.info('[CommonBrowser -> load]', url);
        if(!url){
            return;
        }
        if( url.startsWith('http') ){
            this.webContents.loadURL(url);
        }else{
            this.webContents.loadFile(url);
        }
    }

    view(url?: string){
        Logger.info('[CommonBrowser -> view]', url);
        if (!url){
            return;
        }

        this.loading();

        if(this.viewMap.has(url)){
            this.setTopBrowserView(this.viewMap.get(url) as BrowserView);
            // this.setBrowserView(this.viewMap.get(url) as BrowserView);
            return;
        }

        this.createViewWindow(url);
        const viewWindow = this.viewMap.get(url) as BrowserView;
        
        this.addBrowserView(viewWindow);

        if( url.startsWith('http') ){
            viewWindow.webContents.loadURL(url);
        }else{
            viewWindow.webContents.loadFile(url);
        }
    }

    initContentsEvent(viewWindow:BrowserView){
        const webContents = viewWindow.webContents;
        webContents.on('dom-ready', ()=>{
            Logger.info('[CommonBrowser -> initContentsEvent] on:dom-ready');

            this.viewMap.forEach(view=>view.webContents.send(ChannelTypes.GetTabViews, Array.from(this.viewMap.keys())));

            const [width, height] = this.getSize();
            viewWindow.setBounds({
                x: 0,
                y: 0,
                width,
                height
            });
            // this.show();
        });

        webContents.on('before-input-event', (event, input) => {
            if(input.key.toLocaleLowerCase() === 'f12'){
                if(!webContents.isDevToolsOpened()) {
                    webContents.openDevTools();
                }else{
                    webContents.closeDevTools();
                }
                event.preventDefault();
            }
        });

        webContents.on('did-fail-load', (e, ...args:unknown[])=>{
            const [,,url] = args;
            Logger.info('[CommonBrowser -> initContentsEvent] did-fail-load', args);
            if(HTML_ERROR_CRASH_WEBPACK_ENTRY === url){
                return;
            }
            this.view(HTML_ERROR_CRASH_WEBPACK_ENTRY);
        })

        webContents.on('console-message', (e, level, ...args:unknown[])=>{
            if(level === 3){
                Logger.info('[CommonBrowser -> initContentsEvent] console-message',webContents.getURL(), args);
                // if(webContents.getURL() !== HTML_ERROR_CRASH_WEBPACK_ENTRY){
                //     this.view(HTML_ERROR_CRASH_WEBPACK_ENTRY);
                // }
            }

        })

        // const defUserAgent = isMac ? MAC_OS_CHROME_USER_AGENT : WINDOW_CHROME_USER_AGENT;
        const userAgent = webContents.getUserAgent() //|| defUserAgent;
        webContents.setUserAgent(`${userAgent} mockRPD mockplusrp/${isPrivate?'ENT':'PUB'}`);

        viewWindow.setAutoResize({
            width: true,
            height: true,
            vertical: true,
            horizontal: true,
        });

        // 拦截window.open，并使用系统默认浏览器跳转
        webContents.setWindowOpenHandler(({ url, referrer }) => {
            Logger.info('[CommonBrowser -> initContentsEvent] setWindowOpenHandler', url, referrer);
            shell.openExternal(url).catch(()=>{
                Logger.info('[CommonBrowser -> initContentsEvent] setWindowOpenHandler', url, '打开失败');
            });
            return { action: 'deny' } //{ action: 'deny' }
        })
    }

    initBrowserEvent(){
        // BrowserView的内容加载不会触发该事件
        this.once('ready-to-show', ()=>{
            Logger.warn('[CommonBrowser -> initBrowserEvent]', 'once:ready-to-show', this.moduleName);
            this.show();
        })

        this.on('ready-to-show', ()=>{
            const [width, height] = this.getSize();
            Logger.info('[CommonBrowser -> initBrowserEvent]', 'on:ready-to-show', `width: ${width};height: ${height}`);
            this.moveTop();
        })

        this.on('resize', ()=>{
            // Logger.info('[CommonBrowser -> initBrowserEvent]', 'on resize');
        })

        // 监听窗口关闭事件，接收到此事件时，需销毁对象引用关系；否则进程报错
        this.on('closed', ()=>{
            Logger.warn('[CommonBrowser -> initBrowserEvent]', 'on:close', this.moduleName);
            WindowManager.removeWindow(this.moduleName);
        })
    }

    private createViewWindow(url: string){
        Logger.warn('[CommonBrowser -> createViewWindow]', `创建视图窗口: ${url}`);
        const viewWindow =  new BrowserView({
            webPreferences: {
                nodeIntegration: true,
                preload: LOGIN_WINDOW_PRELOAD_WEBPACK_ENTRY 
            }
        });

        this.viewMap.set(url, viewWindow);
        memoryCache.tabViews[this.moduleName] =  Array.from(this.viewMap.keys());

        this.initContentsEvent(viewWindow);
    }
}

class LoginBrowser extends CommonBrowser{
    constructor(options: Options = {}){
        Logger.info('[LoginBrowser -> constructor]', options);
        super({
            width: 450,
            height: 600,
            resizable: false,
            minimizable: false,
            maximizable: false,
            fullscreenable: false,
            ...options
        }, WindowModule.Login);
    }
}

class HomeBrowser extends CommonBrowser{
    constructor(options: Options = {}){
        super({
            width: BROWSER_DEFAULT_WIDTH,
            height: BROWSER_DEFAULT_HEIGHT,
            show: false,
            minWidth: HOME_BROWSER_MIN_WIDTH,
            minHeight: HOME_BROWSER_MIN_HEIGHT,
            ...options
        }, WindowModule.Home);
    }
}

class EditorBrowser extends CommonBrowser{
    constructor(options: Options = {}){
        super({
            width: BROWSER_DEFAULT_WIDTH,
            height: BROWSER_DEFAULT_HEIGHT,
            show: false,
            minWidth: HOME_BROWSER_MIN_WIDTH,
            minHeight: HOME_BROWSER_MIN_HEIGHT,
            ...options
        }, WindowModule.Editor);
    }
}

class PreviewBrowser extends CommonBrowser{
    constructor(options: Options = {}){
        super({
            width: BROWSER_DEFAULT_WIDTH,
            height: BROWSER_DEFAULT_HEIGHT,
            show: false,
            minWidth: HOME_BROWSER_MIN_WIDTH,
            minHeight: HOME_BROWSER_MIN_HEIGHT,
            fullscreenable: false,
            fullscreen: true,
            ...options
        }, WindowModule.Preview);

        this.once('ready-to-show', ()=>{
            this.maximize();
        })
    }
}

class WindowManager {
    private static windowMap = new Map<WindowModule, CommonBrowser>();
    private static windowIDS = new Map<string, number>();

    static create(module:WindowModule, options: Options = {}){
        if (this.windowMap.has(module)){
            this.windowMap.get(module)?.show();
            return;
        }
        if( module === WindowModule.Login ){
            const loginWindow = new LoginBrowser(options);
            this.windowMap.set(WindowModule.Login, loginWindow);
        }else if(module === WindowModule.Home){
            const homeWindow = new HomeBrowser(options);
            this.windowMap.set(WindowModule.Home, homeWindow);
        }else if(module === WindowModule.Editor){
            const editorWindow = new EditorBrowser(options);
            this.windowMap.set(WindowModule.Editor, editorWindow);
        }else if(module === WindowModule.Preview){
            const previewWindow = new PreviewBrowser(options);
            this.windowMap.set(WindowModule.Preview, previewWindow);
        }else{
            this.windowMap.set(module, new CommonBrowser(options));
        }
    }

    static getWindow(module:WindowModule){
        return this.windowMap.get(module);
    }

    static removeWindow(module:WindowModule){
        this.windowMap.delete(module);
    }

    static getAllWindow():CommonBrowser[]{
        return Array.from(this.windowMap.values()).filter(win=>!win.isDestroyed());
    }

    static getShowWindow(): BrowserWindow[]{
        return Array.from(this.windowMap.values()).filter(win=>win.isVisible());
    }

    // static window(name:Views, flag=''): (options?:Options)=> BrowserWindow {
    //     const winName = `${name}${flag}`;
    //     const winID = this.windowIDS.get(winName);
    //     const isAlive = BrowserWindow.getAllWindows().find( w=> w.id ===  winID); // 相关进程还存在
    //     if(!isAlive){
    //         // 保证使用渲染窗口不会出现错误
    //         this.windowIDS.delete(winName);
    //         this.windowMap.delete(winName);
    //     }

    //     let browser:BrowserWindow;

    //     if(this.windowMap.has(winName)){
    //         browser = this.windowMap.get(winName);
    //     }

    //     return (options:Options={})=>{
    //         return browser || this.create(name, flag, options);
    //     }
    // }
}

export default WindowManager;