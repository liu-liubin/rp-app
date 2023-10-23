// 在上下文隔离启用的情况下使用预加载
import { contextBridge, ipcRenderer } from 'electron';
// import { WindowModule } from './browser';
import { ChannelTypes } from './constants/enum';
import store, { IStore } from './store';

console.log(store);

console.info('⚠️当前环境变量为：' + store.get('env'));

interface IRPBridge {
  toHome: (url:string) => void;  // 跳转到RP首页
  toEditor: (url?: string) => void;  // 跳转到RP编辑页
  toPreview: (url?:string) => void;  // 跳转到RP预览页
  setWebStore: (k: string, value: unknown) => void;  // 设置本地缓存数据
  getWebStore: (k: string) => unknown;  // 获取本地缓存数据
  getTabViews: (fn:(res:string[])=>void) => void;  // 获取当前窗口标签页URL
  resetStore: ()=>void;  // 重置所有配置数据，会重启软件
  getStore: ()=>void;  // 获取所有配置数据
  logout: ()=>void;  // 退出登录
  close: ()=> void;  // 关闭当前窗口
  closeAll: ()=> void; // 关闭所有窗口
  show: ()=> void;  // 显示当前窗口
  capturerImage: () => Promise<unknown>;  // 截屏窗口
  env: string;  // 当前配置环境

  delStore: (k: keyof IStore)=>void;  // 删除某一个配置缓存，生产环境不可用
}

const Bridge:IRPBridge = {
  toEditor: (url?:string)=> ipcRenderer.send(ChannelTypes.ToEditor, url),
  toPreview: (url?:string)=> ipcRenderer.send(ChannelTypes.ToPreview, url),
  toHome: (url:string)=> ipcRenderer.send(ChannelTypes.ToHome, url),
  // setSize: (width:number, height: number) => ipcRenderer.send(ChannelTypes.Size, process.env.moduleName, width, height),
  setWebStore: (k: string, value: unknown) => {
    store.set('webStore', {
      ...store.get('webStore'),
      [k]: value,
    })
  },
  getWebStore: (k?: string) => k ? store.get('webStore')[k] : store.get('webStore'),
  getTabViews: (fn) => {
    ipcRenderer.on(ChannelTypes.GetTabViews, (e, tab:string[])=>{
      fn && fn(tab)
    })
  },
  delStore: (k:keyof IStore)=> store.delete(k),
  resetStore: ()=> ipcRenderer.send(ChannelTypes.ResetStore),
  getStore: ()=> store.store,
  logout: ()=> ipcRenderer.send(ChannelTypes.Logout),
  close: ()=> ipcRenderer.send(ChannelTypes.Close, process.env.moduleName),
  closeAll: () => ipcRenderer.send(ChannelTypes.CloseAll),
  show: ()=> ipcRenderer.send(ChannelTypes.Show, process.env.moduleName),
  capturerImage: async () => {
    return '';
  },

  get env(){
    return store.get('env');
  },
  set env(val:string){
    console.warn('⚠️注意：环境变量已发生改变，请重新启动程序');
    store.set('env', val);
  }
}

contextBridge.exposeInMainWorld('RPBridge', Bridge);
