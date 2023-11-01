import { app, ipcMain } from 'electron';
import store from './store';
import { ChannelTypes } from './constants/enum';
import WindowManager, { StartupBrowser, WindowModule } from './browser';
import Logger from './logger';
import { PROGRAM_AUTHOR } from './constants';
// import logoImg from './assets/images/logo.png';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

Logger.info('*********************应用启动中************************');
Logger.info(`安装目录：${app.getAppPath()} `);
store.get('debug') && Logger.info(`配置文件：${store.path}`);
store.get('debug') && Logger.info(`日志文件：${Logger.getFile()}`);

let startupBrowser: StartupBrowser;

const createIpcChannel = () => {
  ipcMain.on(ChannelTypes.Token, (...args) => {
    const [, token] = args;
    store.set('token', token);
  });

  // 跳转到项目首页
  ipcMain.handle(ChannelTypes.ToHome, async (e, url?: string) => {
    if (url) {
      store.set('envConfig', {
        ...store.get('envConfig'),
        home: url,
      });
    }
    const newUrl = url || store.get('envConfig').home;

    Logger.info('[APP] ipcMain ToHome', '跳转到首页', newUrl);

    if (!newUrl || typeof newUrl !== 'string') {
      Logger.info('[CommonBrowser -> view]', 'url为空, 无法加载');
      return;
    }

    const win = WindowManager.create(WindowModule.Home);
    if (win.url !== newUrl) {
      win.view(newUrl);
    }

    return await new Promise((resolve) => {
      win?.on('ready-to-show', () => {
        WindowManager.getWindow(WindowModule.Login)?.close();
        resolve(true);
      });
    });
  });

  // 跳转到RP编辑器界面
  ipcMain.handle(ChannelTypes.ToEditor, async (e, url: string, appID: string) => {
    if (!url || typeof url !== 'string') {
      Logger.info('[CommonBrowser -> view]', 'url为空, 无法加载');
      return;
    }

    const focusWindow = WindowManager.getFocusWindow();
    focusWindow?.showLoading();

    const win = WindowManager.create(WindowModule.Editor, appID);
    if (win.isLoaded) {
      focusWindow?.closeLoading();
      WindowManager.getWindow(WindowModule.Home)?.hide();
      return true;
    }
    win.view(url);

    return await new Promise((resolve) => {
      win?.on('ready-to-show', () => {
        Logger.info('[APP] ipcMain ToEditor', 'on:ready-to-show', '编辑页面已准备就绪', url);
        focusWindow?.closeLoading();
        WindowManager.getWindow(WindowModule.Home)?.hide();
        resolve(true);
      });
    });
  });

  // 跳转到RP预览界面
  ipcMain.handle(ChannelTypes.ToPreview, async (e, url: string, appId?: string) => {
    if (!url || typeof url !== 'string') {
      Logger.info('[CommonBrowser -> view]', 'url为空, 无法加载');
      return;
    }

    // const focusWindow = WindowManager.getFocusWindow();
    // focusWindow?.showLoading();
    const win = WindowManager.create(WindowModule.Preview, appId);
    // if(win.isLoaded){
    //   focusWindow?.closeLoading();
    //   WindowManager.getWindow(WindowModule.Home)?.hide();
    //   return true;
    // }
    win.view(url);

    return await new Promise((resolve)=>{
      win?.on('ready-to-show', ()=>{
        // focusWindow?.closeLoading();
        // WindowManager.getWindow(WindowModule.Home)?.hide();
        resolve(true);
      });
    });
  });

  ipcMain.handle(ChannelTypes.CapturePage, async (e, windowId) => {
    const win = WindowManager.fromId(windowId);
    Logger.info('[APP] ipcMain CapturePage', '捕获页面存为图片', `页面是否存在：${!!win}`);
    if (win) {
      const res = await win.webContents.capturePage();
      return res.toDataURL();
    }
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

  // 关闭窗口
  ipcMain.handle(ChannelTypes.Close, async (e, windowId: string, bool: boolean) => {
    const win = WindowManager.fromId(windowId);
    Logger.info('[APP] ipcMain.handle Close', bool === false ? `隐藏窗口` : `关闭窗口: `, win?.title, win?.moduleName);

    if (win) {
      bool !== false ? win.close() : win.hide();
    }
    return true;
  });

  ipcMain.handle(ChannelTypes.Show, async (e, windowId: string) => {
    const currWindow = WindowManager.fromId(windowId);
    // console.log('======show', BrowserWindow.fromId(Number(windowId)) ,windowId)
    Logger.info('[APP] ipcMain.handle Show', !currWindow ? `窗口不存在` : `显示当前窗口: ${currWindow?.moduleName}`);
    if (currWindow?.isDestroyed()) {
      return true;
    }
    currWindow?.show();
    currWindow?.moveTop();
    return true;
  });

  // 关闭所有窗口
  ipcMain.on(ChannelTypes.CloseAll, (e, bool = true) => {
    Logger.info('[APP] ipcMain CloseAll', `关闭/隐藏所有窗口: ${bool}`);
    bool ? WindowManager.closeAllWindow() : WindowManager.hideAllWindow();
  });

  // 程序启动 / 打开登录窗口
  ipcMain.on(ChannelTypes.ToLogin, (e, url: string) => {
    const viewUrl = url || store.get('envConfig').domain || MAIN_APP_WEBPACK_ENTRY.replace('main_app', 'static/index.html') || HTML_ERROR_WEBPACK_ENTRY;
    Logger.info('[APP] ipcMain ToLogin', '程序启动 / 打开了登录窗口', `URL: ${viewUrl}`);
    // 存在其他窗口则关闭，此时仅可保留一个登录窗口 , 注意： 确保登录页URL唯一
    //WindowManager.getAllWindow().forEach((win) => win.moduleName !== WindowModule.Login && win.close());
    const win = WindowManager.create(WindowModule.Login);
    win?.view(viewUrl);
  });

  // 清空缓存并重启
  ipcMain.on(ChannelTypes.ResetStore, () => {
    Logger.info('[APP] ipcMain ResetStore', '清空缓存并重新启动');
    store.clear();
    app.quit();
    app.relaunch();
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
    Logger.info('[APP] ipcMain Fullscreen', '窗口全屏', win?.moduleName);
    if (win) {
      win.setFullScreen(flag);
    }
  });

  ipcMain.on(ChannelTypes.ShowAbout, () => {
    Logger.info('[APP] ipcMain ShowAbout');
    app.showAboutPanel();
  });

  ipcMain.on(ChannelTypes.ShowLoading, (e, windowId) => {
    Logger.info('[APP] ipcMain ShowLoading');
    const win = WindowManager.fromId(windowId);
    win?.showLoading();
  });

  ipcMain.on(ChannelTypes.CloseLoading, (e, windowId) => {
    Logger.info('[APP] ipcMain CloseLoading');
    const win = WindowManager.fromId(windowId);
    win?.closeLoading();
  });

  ipcMain.on(ChannelTypes.ConsoleLogger, (e, ...args: unknown[]) => {
    Logger.info('[APP] 来自网页日志：', ...args);
  });
};

app.setAboutPanelOptions({
  applicationName: app.getName(),
  applicationVersion: app.getVersion(),
  version: app.getVersion(),
  copyright: PROGRAM_AUTHOR,
  iconPath: './assets/images/logo.png',
});

app.on('ready', () => {
  createIpcChannel();

  startupBrowser = new StartupBrowser();

  startupBrowser.on('ready-to-show', () => {
    startupBrowser.show();
    ipcMain.emit(ChannelTypes.ToLogin);
  });

  ipcMain.handle(ChannelTypes.Startup, (e, ...args: unknown[]) => {
    Logger.info('[APP] ipcMain Startup', '启动页面已完成', args);
    startupBrowser && !startupBrowser.isDestroyed() && startupBrowser.close();
    return true;
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
