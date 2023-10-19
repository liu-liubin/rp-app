import { app, ipcMain, } from 'electron';
import store from './store';
import { ChannelTypes } from './constants/enum';
import WindowManager, { WindowModule } from './browser';
import Logger from './logger';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const startBrowserWindow = ()=>{
  if(store.get('webStore')?.token){
    ipcMain.emit(ChannelTypes.ToHome, Event, store.get('envConfig').domain);
  }else{
    ipcMain.emit(ChannelTypes.ToLogin);
  }
}
 
const createIpcChannel = ()=>{
  ipcMain.on(ChannelTypes.Token, (...args)=>{
    const [, token] = args;
    store.set('token', token);
    // WindowManager.window(Views.App)().show();
  });

  // 跳转到RP编辑器界面
  ipcMain.on(ChannelTypes.ToEditor, (e, url: string)=>{
    WindowManager.create(WindowModule.Editor);
    WindowManager.getWindow(WindowModule.Editor)?.view(url);
  });

  // 跳转到RP预览界面
  ipcMain.on(ChannelTypes.ToPreview, (e, url: string)=>{
    WindowManager.create(WindowModule.Preview);
    WindowManager.getWindow(WindowModule.Preview)?.view(url);
  });

  // 退出登录
  ipcMain.on(ChannelTypes.Logout, ()=>{
    Logger.info('[APP] ipcMain Logout', '用户退出登录');
    const webStore = store.get('webStore');
    webStore.token = undefined;
    store.set('webStore', webStore);
    ipcMain.emit(ChannelTypes.ToLogin, Event);
  })

  // 跳转到项目首页
  ipcMain.on(ChannelTypes.ToHome, (e, url?:string)=>{
    Logger.info('[APP] ipcMain ToHome', '跳转到首页', url);
    WindowManager.create(WindowModule.Home);
    WindowManager.getWindow(WindowModule.Home)?.view(url);

    WindowManager.getWindow(WindowModule.Login)?.close();
  });

  // 关闭当前窗口
  ipcMain.on(ChannelTypes.Close, (e, moduleName: WindowModule)=> {
    const win = WindowManager.getWindow(moduleName);
    Logger.info('[APP] ipcMain Close', '关闭窗口', win?.title, moduleName);
    win && win.close();
  })

  // 打开登录窗口
  ipcMain.on(ChannelTypes.ToLogin, (e, url:string) => {
    Logger.info('[APP] ipcMain ToLogin', '打开了登录窗口', url);

    // 存在其他窗口则关闭，此时仅可保留一个登录窗口
    WindowManager.getAllWindow().forEach(win=>win.close());

    WindowManager.create(WindowModule.Login);
    WindowManager.getWindow(WindowModule.Login)?.view('http://localhost:3004');
  })

  // 获取渲染视图数
  // ipcMain.handle(ChannelTypes.GetTabViews, (e, moduleName: WindowModule)=>{
  //   return memoryCache.tabViews[moduleName] || [];
  // })

  ipcMain.on(ChannelTypes.Size, (e, moduleName:WindowModule, width:number, height:number)=>{
    Logger.info('[APP] ipcMain size', moduleName, width, height);
    const win = WindowManager.getWindow(moduleName);
    if(win){
      win.setSize(width, height);
    }
  })

}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', ()=>{
  createIpcChannel();
  startBrowserWindow();
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
  Logger.info('[APP] on activate', `当前窗口实例个数：${WindowManager.getAllWindow().length}`);
  if(WindowManager.getShowWindow().length === 0){
    startBrowserWindow();
  }
});

app.on('quit', ()=>{
  // BrowserWindow.getAllWindows().forEach(w=> w.destroy());
  Logger.info('[APP] on quit', '收到应用程序退出的事件');
})


// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
