import path from 'path';
import { app, ipcMain, nativeImage, Tray, Menu, session } from 'electron';
import store from './store';
import { ChannelTypes } from './constants/enum';
import WindowManager, { StartupBrowser, WindowModule } from './browser';
import Logger from './logger';
import { APP_TYPE, PRODUCT_AUTHOR, PRODUCT_NAME } from './constants';
import AppUpdater from './AppUpdater';

if (require('electron-squirrel-startup')) {
  app.quit();
}

Logger.logPath = path.resolve(app.getPath("userData"), 'Logs');

Logger.info('******************************************************');
Logger.info(`******************应用启动中*${APP_TYPE}*********************`);
Logger.info('******************************************************');
Logger.info(`安装目录：${app.getAppPath()} `);
Logger.info(`用户目录：${app.getPath('userData')}`);

process.traceProcessWarnings = false;

// 清空旧版数据，使用新版数据结构
if(store.get('name')!=='mockplus-rp'){
  store.clear();
  store.set('name', 'mockplus-rp');
}

// ？ 可能被命令行启动理工学改变？
if(APP_TYPE === 'prod'){
  process.env.node_env = 'prod';
  store.set('env', 'prod');
  if(process.env.DEBUG === 'true'){
    store.set('debug', true);
  }else{
    store.set('debug', false);
  }
}else{
  process.env.node_env = 'test';
  process.env.DEBUG = 'true';
}

let startupBrowser: StartupBrowser;

const createIpcChannel = () => {
  ipcMain.on(ChannelTypes.Token, (...args) => {
    const [, token] = args;
    store.set('token', token);
  });

  /** 
   * 程序启动 
   *  - 启动完成需要关闭启动页进程窗口
   * 注意： 请确保在启动页面调用
   */
  ipcMain.handle(ChannelTypes.StartupLoaded, async (e, auth, ...args: unknown[]) => {
    Logger.info('[APP] ipcMain:handle StartupLoaded', `启动页面已完成 - ${auth?'授权成功':'授权失败'}`, args);

    // 配置自动更新检查 - 在网页端注册配置
    // ipcMain.emit(ChannelTypes.StartAutoUpdater, Event, 'http://192.168.0.144:8000', {}, `Bearer`);

    if(auth){
      WindowManager.getWindow(WindowModule.Login)?.close();
    }else{
      WindowManager.getWindow(WindowModule.Login)?.show();
    }
    startupBrowser && !startupBrowser.isDestroyed() && startupBrowser.close();
    return true;
  });

  // 跳转 - 到项目首页
  ipcMain.handle(ChannelTypes.ToHome, async (e, windowId, url?: string|boolean) => {
    if (typeof url === 'string') {
      store.set('envConfig', {
        ...store.get('envConfig'),
        home: url,
      });
    }
    const newUrl = url || store.get('envConfig').home;
    
    Logger.info('[APP] ipcMain:handle ToHome', `跳转到首页:${newUrl}`,);

    if (!newUrl || typeof newUrl !== 'string') {
      Logger.info('[CommonBrowser -> view]', 'url为空, 无法加载');
      return;
    }

    const win = WindowManager.create(WindowModule.Home);

    if(url === true){
      win.reload();
      return;
    }

    const fromWin = WindowManager.fromId(windowId);
    fromWin?.showLoading();
    
    url ? win.reload(url) : win.view(newUrl);

    return await new Promise((resolve) => {
      win.useCompleted((res)=>{
        Logger.info('[APP] ipcMain toHome', 'win:useCompleted', `页面已经完成-[${res}]`, url);
        fromWin?.closeLoading();
        resolve(true);
      });
    });
  });

  // 跳转 - 到RP编辑器界面
  ipcMain.handle(ChannelTypes.ToEditor, async (e, windowId, url: string, appID: string) => {
    if (!url || typeof url !== 'string') {
      Logger.info('[CommonBrowser -> view]', 'url为空, 无法加载');
      return;
    }

    const fromWin = WindowManager.fromId(windowId);
    fromWin?.showLoading();

    const win = WindowManager.create(WindowModule.Editor, appID);
    win.view(url);

    return await new Promise((resolve) => {
      win.useCompleted((res)=>{
        Logger.info('[APP] ipcMain ToEditor', 'win:useCompleted', `页面已经完成-[${res}]`, url);
        fromWin?.closeLoading();
        WindowManager.getWindow(WindowModule.Home)?.hide();
        resolve(true);
      });
    });
  });

  // 跳转 - 到RP预览界面
  ipcMain.handle(ChannelTypes.ToPreview, async (e, windowId, url: string, appId?: string) => {
    if (!url || typeof url !== 'string') {
      Logger.info('[CommonBrowser -> view]', 'url为空, 无法加载');
      return;
    }

    const fromWin = WindowManager.fromId(windowId);
    fromWin?.showLoading();

    const win = WindowManager.create(WindowModule.Preview, appId);
    win.view(url);

    return await new Promise((resolve)=>{
      win.useCompleted((res)=>{
        Logger.info('[APP] ipcMain ToPreview', 'win:useCompleted', `页面已经完成-[${res}]`, url);
        fromWin?.closeLoading();
        resolve(true);
      });
    });
  });

  // 跳转 - 本地跳转location.href作用
  ipcMain.handle(ChannelTypes.ToLink, async (e, windowId, url?: string) => {
    Logger.info('[CommonBrowser -> view] ipcMain:handel ToLink', url);
    const win = WindowManager.fromId(windowId);
    if(url && url.startsWith('http') && win){
      win.reload(url);
      return await new Promise((resolve)=>{
        win.useCompleted(()=>{
          resolve(true);
        });
      });
    }

    return false;
  });

  ipcMain.handle(ChannelTypes.CapturePage, async (e, windowId) => {
    const win = WindowManager.fromId(windowId);
    Logger.info('[APP] ipcMain CapturePage', '捕获页面存为图片', `页面是否存在：${!!win}`);
    if (win) {
      const res = await win.webContents.capturePage();
      return res.toDataURL();
    }
  });

  // 关闭窗口
  ipcMain.handle(ChannelTypes.Close, async (e, windowId: string, bool: boolean) => {
    const win = WindowManager.fromId(windowId);
    Logger.info('[APP] ipcMain:handle Close', bool === false ? `隐藏窗口` : `关闭窗口: `, win?.title, win?.moduleName);

    if (win) {
      bool !== false ? win.close() : win.hide();
    }
    return true;
  });

  ipcMain.handle(ChannelTypes.Show, async (e, windowId: string, hostname:string) => {
    const currWindow = WindowManager.fromId(windowId);
    Logger.info('[APP] ipcMain:handle Show', !currWindow ? `窗口不存在` : `显示当前窗口: ${currWindow?.title}-${currWindow?.moduleName}`, `窗口销毁：${currWindow?.isDestroyed()}`, `host: ${hostname}`);
    if (currWindow?.isDestroyed()) {
      return true;
    }
    if(currWindow){
      currWindow.hostname = hostname;
      currWindow.show();
      currWindow.moveTop();
    }
    return true;
  });

  // 退出登录
  ipcMain.on(ChannelTypes.Logout, () => {
    Logger.info('[APP] ipcMain Logout', '用户退出登录');
    if (startupBrowser && !startupBrowser.isDestroyed()) {
      Logger.info('[APP] ipcMain Logout', '程序正在退出并重新登录');
      return;
    }
    WindowManager.closeAllWindow();
    startupBrowser = new StartupBrowser();
    startupBrowser.on('ready-to-show', () => {
      startupBrowser.show();
      ipcMain.emit(ChannelTypes.ToLogin);
    });
  });

  ipcMain.on(ChannelTypes.StartAutoUpdater, (e, url, headers, auth)=>{
    Logger.info('[APP] ipcMain:on StartAutoUpdater', `启动自动更新检查: 【${url}】- 【${JSON.stringify(headers)}】-${auth}`);
    const updater = new AppUpdater();
    updater.checkUpdate({url, headers, auth});
  })  

  // 关闭所有窗口
  ipcMain.on(ChannelTypes.CloseAll, (e, bool = true) => {
    Logger.info('[APP] ipcMain CloseAll', `关闭/隐藏所有窗口: ${bool}`);
    bool ? WindowManager.closeAllWindow() : WindowManager.hideAllWindow();
  });

  // 程序启动 / 打开登录窗口
  ipcMain.on(ChannelTypes.ToLogin, (e, url: string) => {
    const viewUrl = url || store.get('envConfig').domain || STATIC_LOGIN_WEBPACK_ENTRY.replace('index.js', 'index.html') || HTML_ERROR_WEBPACK_ENTRY;
    Logger.info('[APP] ipcMain ToLogin', '程序启动 / 打开了登录窗口', `URL: ${viewUrl}`, STATIC_LOGIN_WEBPACK_ENTRY);
    // 存在其他窗口则关闭，此时仅可保留一个登录窗口 , 注意： 确保登录页URL唯一
    //WindowManager.getAllWindow().forEach((win) => win.moduleName !== WindowModule.Login && win.close());
    const win = WindowManager.create(WindowModule.Login);
    win?.view(viewUrl);
  });

  // ipcMain.on(ChannelTypes.Size, (e, moduleName: WindowModule, width: number, height: number) => {
  //   Logger.info('[APP] ipcMain size', '窗口改变大小', moduleName, width, height);
  //   const win = WindowManager.getWindow(moduleName);
  //   if (win) {
  //     win.setSize(width, height);
  //   }
  // });

  ipcMain.on(ChannelTypes.Maximize, (e, windowId: string) => {
    const win = WindowManager.fromId(windowId);
    Logger.info('[APP] ipcMain Maximize', '窗口最大化', win?.moduleName);
    if (win) {
      win.maximize();
    }
  });

  ipcMain.on(ChannelTypes.Minimize, (e, windowId: string) => {
    const win = WindowManager.fromId(windowId);
    Logger.info('[APP] ipcMain Minimize', '窗口最小化', `模块：${win?.moduleName}`);
    if (win) {
      win.minimize();
    }
  });

  ipcMain.on(ChannelTypes.Restore, (e, windowId: string) => {
    const win = WindowManager.fromId(windowId);
    Logger.info('[APP] ipcMain Restore', '窗口由最小化恢复', `模块：${win?.moduleName}`);
    if (win) {
      win.isMinimized() && win.restore();
      win.isMaximized() && win.unmaximize();
    }
  });

  ipcMain.on(ChannelTypes.Fullscreen, (e, windowId: string, flag: boolean) => {
    const win = WindowManager.fromId(windowId);
    Logger.info('[APP] ipcMain:on Fullscreen', '窗口全屏', win?.moduleName);
    if (win) {
      win.setFullScreen(flag);
    }
  });

  ipcMain.on(ChannelTypes.ShowAbout, () => {
    Logger.info('[APP] ipcMain:on ShowAbout');
    app.showAboutPanel();
  });

  ipcMain.on(ChannelTypes.ShowLoading, (e, windowId) => {
    Logger.info('[APP] ipcMain:on ShowLoading');
    const win = WindowManager.fromId(windowId);
    win?.showLoading();
  });

  ipcMain.on(ChannelTypes.CloseLoading, (e, windowId) => {
    Logger.info('[APP] ipcMain:on CloseLoading');
    const win = WindowManager.fromId(windowId);
    win?.closeLoading();
  });

  ipcMain.on(ChannelTypes.Message, (e, ...args:unknown[]) => {
    Logger.info('[APP] ipcMain:on Message', args);
    WindowManager.getAllWindow().forEach(win=>win.webContents.send(ChannelTypes.Message, ...args));
  });  

  ipcMain.on(ChannelTypes.ConsoleLogger, (e, ...args: unknown[]) => {
    Logger.info('[APP] 来自网页日志：', ...args);
  });

  ipcMain.on(ChannelTypes.Relaunch, ()=>{
    app.quit();
    app.relaunch();
  });

  // 清空缓存并重启
  ipcMain.on(ChannelTypes.ResetStore, () => {
    Logger.info('[APP] ipcMain:on ResetStore', '清空缓存并重新启动');
    store.clear();
    app.quit();
    app.relaunch();
  });

  ipcMain.on(ChannelTypes.SetStore, (e, k, data)=> {
    Logger.info('[APP] ipcMain:on SetStore', `设置缓存：${k}-${data}`);
    store.set(k, data);
  });

  ipcMain.on(ChannelTypes.SetWebEnv, (e, val, reluanch)=>{
    store.set('env', val);
    if(reluanch){
      store.set('webStore', {});
      app.quit();
      app.relaunch();
      app.exit(0);
    }
  });

  ipcMain.on(ChannelTypes.GetAppMetrics, (e)=>{
    // return app.getAppMetrics();
    e.returnValue = app.getAppMetrics();
  })

};

const createTray = ()=>{
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: '选择环境', 
      type: 'submenu', 
      visible: process.env.node_env!=='prod' , 
      submenu: [
      { 
        label: "开发环境",
        type: 'radio',
        checked: store.get('env') === 'dev',
        click(){
          ipcMain.emit(ChannelTypes.SetWebEnv, Event, 'dev', true);
        },
      },
      { 
        label: "测试环境",
        type: 'radio',
        checked: store.get('env') === 'test',
        click(){
          ipcMain.emit(ChannelTypes.SetWebEnv, Event, 'test', true);
        },
      },
      { 
        label: "demo环境",
        type: 'radio',
        checked: store.get('env') === 'demo',
        click(){
          ipcMain.emit(ChannelTypes.SetWebEnv, Event, 'demo', true);
        },
      },
      { 
        label: "生产环境",
        type: 'radio',
        checked: store.get('env') === 'prod',
        click(){
          ipcMain.emit(ChannelTypes.SetWebEnv, Event, 'prod', true);
        },
      }
    ] },
    { 
      label: '强清缓存', 
      type: 'normal', 
      toolTip: '清除缓存后应用数据将恢复到初始状态且重启应用',
      click(){
      ipcMain.emit(ChannelTypes.ResetStore);
    } },
    { label: '', type: 'separator' },
    { label: '退出', type: 'normal', click(){ app.exit(0); app.quit(); } },
  ])
  const iconFile = process.platform==='darwin' ? 'images/icons/tray-iconMac.png' :  'images/icons/tray-icon.png';
  const icon = nativeImage.createFromPath(path.resolve(__dirname,  iconFile));
  const iconTray = new Tray(icon);
  iconTray.setToolTip(PRODUCT_NAME);
  iconTray.setImage(icon);
  // iconTray.setContextMenu(contextMenu);
  
  iconTray.on('right-click', ()=>{
    const bounds = iconTray.getBounds();
    iconTray.popUpContextMenu(contextMenu, {x: bounds.x, y: bounds.y - 30});
  })

  iconTray.on('click', ()=>{
    if (process.platform==='darwin'){
      Array.from(WindowManager.getModuleWindow(WindowModule.Home)?.values() ?? [] )[0]?.show();
    }else{
      // app.focus在不同的系统上有差异
      app.focus();
    }
  });
}

const singleRunApp = ()=>{
  if(!app.isPackaged){
    return  false;
  }
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
  } else {
    app.on('second-instance', (event, commandLine, workingDirectory, additionalData) => {
      // 输出从第二个实例中接收到的数据
      Logger.info('[APP] 有第二个实例正在尝试创建', additionalData);
      // 有人试图运行第二个实例，我们应该关注我们的窗口
      const win = WindowManager.getFocusWindow();
      if (win) {
        if (win.isMinimized()){ 
          win.restore();
        }
        win.focus()
      }
    })
  }
}

app.setAboutPanelOptions({
  applicationName: app.getName(),
  applicationVersion: app.getVersion(),
  version: app.getVersion(),
  copyright: PRODUCT_AUTHOR,
  iconPath: './assets/images/logo.png',
});


app.on('render-process-gone', (e, webContents, details)=>{
  Logger.info('[APP] 渲染进程发生意外', webContents.getURL(), details);
});

app.on('child-process-gone', (e, details)=>{
  Logger.info('[APP] 子进程发生意外', details);
  app.quit();
});

singleRunApp();

app.on('ready', () => {  
  // session.defaultSession.webRequest.onBeforeSendHeaders(
  //   (
  //     details: Electron.OnBeforeSendHeadersListenerDetails,
  //     cb
  //   ) => {
  //     cb({ requestHeaders: details.requestHeaders });
  //   }
  // );

  session.defaultSession.webRequest.onCompleted({urls:[]}, (details)=>{
    if(details.resourceType === 'xhr'){
      process.env.CATCH_NET && Logger.network(details);
    }
  })

  createIpcChannel();

  createTray();

  startupBrowser = new StartupBrowser();
  startupBrowser.on('ready-to-show', () => {
    startupBrowser.show();
    ipcMain.emit(ChannelTypes.ToLogin);
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  Logger.info('[APP] on window-all-closed', '收到所有窗口关闭的事件');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  Logger.info('[APP] on activate', `当前窗口实例个数：${WindowManager.getSize()}`);
  if (WindowManager.getSize() === 0) {
    ipcMain.emit(ChannelTypes.ToLogin);
  }
});

app.on('quit', () => {
  // BrowserWindow.getAllWindows().forEach(w=> w.destroy());
  Logger.info('[APP] on quit', '收到应用程序退出的事件');
});
