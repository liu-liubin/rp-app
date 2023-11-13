import { MessageBoxOptions, dialog } from "electron";
import { autoUpdater } from "electron-updater";
import type {AppUpdater as ElectronAppUpdater, UpdateDownloadedEvent} from 'electron-updater';
import { Log } from "./logger";

interface IInitOptions{
  url?:string;
  headers?:ElectronAppUpdater['requestHeaders'];
  auth?: string;
}

export default class AppUpdater {
  private onAvailable: (bool:boolean)=>void;

  constructor() {
    this.onAvailable = ()=>{
      // 
    };
  }

  init(opts:IInitOptions = {}){
    autoUpdater.logger = Log;
    autoUpdater.channel = 'beta';
    autoUpdater.autoDownload = true; // 是否自动检测更新平且下载最新版本
    // autoUpdater.forceDevUpdateConfig = true;  // 仅开发使用 - 强制使用开发环境配置文件检测 - 生产环境请务必删除

    opts.url && autoUpdater.setFeedURL(opts.url);  // 配置了开发更新文件，则此设置无效
    opts.auth && autoUpdater.addAuthHeader(opts.auth);
    autoUpdater.requestHeaders = opts?.headers ?? {};
    // autoUpdater.updateConfigPath = './dev-app-update.yml'; // 仅开发使用 - 开发环境检测更新 - 生产环境请务必删除


    /** 检测更新 */
    autoUpdater.on('checking-for-update',()=>{
      // 
    })

    /** 检测到更新错误 */
    autoUpdater.on('error', () => {
      // 
    })

    /** 检测到有新的版本更新 */
    autoUpdater.on('update-available', async ()=>{
      // this.canUpdate(info).then(()=>{
      //   this.onAvailable(true);
      // });
    });

    /** 检测到没有新的版本更新 */
    autoUpdater.on('update-not-available', () => {
      this.onAvailable(false);
    });

    /** 更新下载进度监听 */
    autoUpdater.on('download-progress', (progressObj) => {
      let log_message = "Download speed: " + progressObj.bytesPerSecond;
      log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
      log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
      console.log(log_message);
    })

    /** 检测到更新下载完成 */
    autoUpdater.on('update-downloaded', (info: UpdateDownloadedEvent)=>{
      this.canRestart(info)
    });
  }

  async canRestart(info: UpdateDownloadedEvent){ 
    const dialogOpts: MessageBoxOptions = {
      type: 'info',
      buttons: ['#重启', '#稍后重启'],
      title: '#版本更新',
      message: process.platform === 'win32' ? info.releaseNotes?.toString() ?? '' : info.releaseName || '',
      detail: '#有新的版本，请重启',
    }
    const returnValue = await dialog.showMessageBox(dialogOpts);
    // returnValue.response === 0 表示按下了buttons[0]   returnValue.response === 1 表示按下了buttons[1]
    if (returnValue.response === 0) autoUpdater.quitAndInstall(false, true);
  }

  /** 调用检测服务器更新状态 - 调用后autoUpdater相关事件才会触发 */
  async checkUpdate(opts: IInitOptions,fn?: (bool:boolean)=>void){
    this.init(opts);
    try {
      if(fn instanceof Function){
        this.onAvailable = fn;
      }
      const result = await autoUpdater.checkForUpdatesAndNotify();
      return result;
    } catch (error) {
      fn instanceof Function && fn(false);
      return undefined;
    }
  }
}