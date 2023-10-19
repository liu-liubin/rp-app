// 在上下文隔离启用的情况下使用预加载
import { contextBridge, ipcRenderer } from 'electron';
import { ChannelTypes } from './constants/enum';
import store, { IStore } from './store';

console.log(process.env);

console.log(store);

interface IRPBridge {
  toHome: (url?:string) => void;
  toEditor: (url?: string) => void;
  toPreview: (url?:string) => void;
  setWebStore: (k: string, value: unknown) => void;
  getWebStore: (k: string, value: unknown) => void;
  getTabViews: (fn:(res:string[])=>void) => void;
  delStore: (k: string)=>void;
  resetStore: ()=>void;
  getStore: ()=>void;
  logout: ()=>void;
  close: ()=> void;
  closeAll: ()=> void;
  token: string;
}

contextBridge.exposeInMainWorld('RPBridge', {
  setToken: (token:string)=> ipcRenderer.send(ChannelTypes.Token, token),
  toEditor: (url?:string)=> ipcRenderer.send(ChannelTypes.ToEditor, url),
  toPreview: (url?:string)=> ipcRenderer.send(ChannelTypes.ToPreview, url),
  toHome: (url?:string)=> ipcRenderer.send(ChannelTypes.ToHome, url),
  setSize: (width:number, height: number) => ipcRenderer.send(ChannelTypes.Size, process.env.moduleName, width, height),
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
  resetStore: ()=>  store.clear(),
  getStore: ()=> store.store,
  logout: ()=> ipcRenderer.send(ChannelTypes.Logout),
  close: ()=> ipcRenderer.send(ChannelTypes.Close, process.env.moduleName),
  closeAll: () => ipcRenderer.send(ChannelTypes.CloseAll),
  env: '',
  envOrigin: '',
  version: '',
  token: '',
  upgradeOrigin: '',
} as IRPBridge);

contextBridge.exposeInMainWorld('TOKEN', {
  doAThing: () => {
    console.log('')
  },
});