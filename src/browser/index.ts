import { BrowserView, BrowserWindow, BrowserWindowConstructorOptions as Options, shell } from 'electron';
import { BROWSER_DEFAULT_HEIGHT, BROWSER_DEFAULT_WIDTH, HOME_BROWSER_MIN_HEIGHT, HOME_BROWSER_MIN_WIDTH, isPrivate, LOADING_WINDOW_HEIGHT, LOADING_WINDOW_WIDTH } from '../constants';
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
    Loading = 'loading'
}

class CommonBrowser extends BrowserWindow {
    protected initEvent: {[k:string]: ()=>void;} = {};
    protected moduleName = WindowModule.Normal;
    protected viewMap = new Map<string, BrowserView>();
    protected bounds: Electron.Rectangle;

    constructor(options?: Options, moduleName?:WindowModule){
        
        super({
            ...options,
            ...(store.get('windowBounds')[moduleName as string] || {}),
            frame: false,
            show: false,
            titleBarStyle: 'customButtonsOnHover',
            webPreferences: {
                preload: MAIN_APP_PRELOAD_WEBPACK_ENTRY
            }
        });

        this.moduleName = moduleName || WindowModule.Normal;
        process.env.moduleName = this.moduleName;
        this.initBrowserEvent();
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

        if(this.viewMap.has(url)){
            this.setTopBrowserView(this.viewMap.get(url) as BrowserView);
            // this.setBrowserView(this.viewMap.get(url) as BrowserView);
            return;
        }

        this.createViewWindow(url);
        const viewWindow = this.viewMap.get(url) as BrowserView;

        if( url.startsWith('http') ){
            viewWindow.webContents.loadURL(url);
        }else{
            viewWindow.webContents.loadFile(url);
        }
    }

    initContentsEvent(viewWindow:BrowserView){
        const webContents = viewWindow.webContents;
        webContents.on('dom-ready', ()=>{
            Logger.info(`[CommonBrowser -> initContentsEvent] 【${this.moduleName}】 on:dom-ready`);

            this.viewMap.forEach(view=>view.webContents.send(ChannelTypes.GetTabViews, Array.from(this.viewMap.keys())));
            if(this.moduleName !== WindowModule.Login){
                this.show();
            }
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
                Logger.info('[CommonBrowser -> initContentsEvent]',`【${this.moduleName}】console-message`,webContents.getURL(), args);
                // if(webContents.getURL() !== HTML_ERROR_CRASH_WEBPACK_ENTRY){
                //     this.view(HTML_ERROR_CRASH_WEBPACK_ENTRY);
                // }
            }

        })

        // const defUserAgent = isMac ? MAC_OS_CHROME_USER_AGENT : WINDOW_CHROME_USER_AGENT;
        const userAgent = webContents.getUserAgent() //|| defUserAgent;
        webContents.setUserAgent(`${userAgent} mockRPD mockplusrp/${isPrivate?'ENT':'PUB'}`);

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
        // BrowserView的内容加载不会触发该事件， browserWindow.load时触发该事件
        this.once('ready-to-show', ()=>{
            Logger.warn('[CommonBrowser -> initBrowserEvent]', `【${this.moduleName}】`, 'once:ready-to-show');
            if(this.moduleName !== WindowModule.Login){
                this.show();
            }
        })
        // BrowserView的内容加载不会触发该事件， browserWindow.load时触发该事件
        this.on('ready-to-show', ()=>{
            WindowManager.loadingWindow?.hide();
            const [width, height] = this.getSize();
            Logger.info('[CommonBrowser -> initBrowserEvent]', `【${this.moduleName}】`, 'on:ready-to-show', `width: ${width};height: ${height}`);
            this.moveTop();
            this.initEvent['ready-to-show']?.();
        })

        this.on('resize', ()=>{
            // Logger.info('[CommonBrowser -> initBrowserEvent]', 'on:resize');
            this.bounds = this.getBounds();
        })

        this.on('move', ()=>{
            // Logger.info('[CommonBrowser -> initBrowserEvent]', 'on:resize');
            this.bounds = this.getBounds();
        })

        this.on('show', ()=>{
            // Logger.info('[CommonBrowser -> initBrowserEvent]', 'on:show');
        })

        // 监听窗口关闭事件，接收到此事件时，需销毁对象引用关系；否则进程报错
        this.on('closed', ()=>{
            Logger.warn('[CommonBrowser -> initBrowserEvent]', `【${this.moduleName}】`, 'on:close');
            this.initEvent['closed']?.();
            WindowManager.removeWindow(this.moduleName);
            this.viewMap.clear();
            
            this.moduleName !== WindowModule.Login && store.set('windowBounds', {
                ...store.get('windowBounds'),
                [this.moduleName]: this.bounds
            });
        })
    }

    private createViewWindow(url: string){
        Logger.warn('[CommonBrowser -> createViewWindow]', `【${this.moduleName}】创建视图窗口: ${url}`);
        WindowManager.loadingWindow?.show();

        const viewWindow =  new BrowserView({
            webPreferences: {
                nodeIntegration: true,
                preload: MAIN_APP_PRELOAD_WEBPACK_ENTRY 
            }
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
            height
        });
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

        this.initEvent = {}
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

        this.initEvent = this.getEvent();
    }
    
    getEvent(){
        return {
            ['closed']: ()=>{
                Logger.warn('[EditorBrowser -> getEvent]', `【${this.moduleName}】`, 'on:closed');
                WindowManager.getWindow(WindowModule.Home)?.moveTop(); 
            }
        }
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

class LoadingBrowser extends CommonBrowser{
    constructor(options: Options = {}){
        super({
            width: LOADING_WINDOW_WIDTH,
            height: LOADING_WINDOW_HEIGHT,
            minWidth: LOADING_WINDOW_WIDTH,
            minHeight: LOADING_WINDOW_HEIGHT,
            transparent: true,
            alwaysOnTop: true,
            ...options
        }, WindowModule.Loading);

        this.webContents.loadURL(HTML_LOADING_WEBPACK_ENTRY);

        this.initEvent = this.getEvent();
    }
    
    getEvent(){
        return {
        }
    }
}

class WindowManager {
    private static windowMap = new Map<WindowModule, CommonBrowser>();
    public static loadingWindow:BrowserWindow|undefined = undefined;

    static create(module:WindowModule, options: Options = {}){
        Logger.warn('[WindowManager -> create]', `【${module}】`, `窗口是否存在：${this.windowMap.has(module)}`);
        if (this.windowMap.has(module)){
            this.windowMap.get(module)?.show();
            return;
        }
        if(!this.loadingWindow){
            this.loadingWindow = new LoadingBrowser({
                trafficLightPosition: { x: -10, y: -10 }
            });
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

    static closeAllWindow():void {
        this.getAllWindow().forEach(item=>item.close());
    }

    static hideAllWindow():void {
        this.getAllWindow().forEach(item=>item.hide());
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