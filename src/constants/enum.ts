export enum ChannelTypes {
    /** 程序启动 */
    Startup = 'startup',

    Token = 'token',
    ToPreview = 'toPreview',
    ToEditor = 'toEditor', // 
    ToHome = 'toHome', // 打开项目首页窗口
    ToLogin = 'toLogin',

    Logout = 'logout',
    Close = 'close',
    CloseAll = 'closeAll',
    Show = 'show',
    ShowWindow = 'showWindow',
    ShowLoading = 'showLoading',
    CloseLoading = 'closeLoading',

    SetWebStore = 'setWebStore',
    ResetStore = 'resetStoreAndRelaunch',

    CreateProject = 'createProject',

    Maximize = 'maximize',
    Minimize = 'minimize',
    Fullscreen = 'fullscreen',
    Restore = 'restore',

    ShowAbout = 'showAbout',

    Size = 'size',

    InvokeSubscribe = 'emitSubscribe',
    CapturePage = 'capturePage',
    ConsoleLogger = 'consoleLogger',

    GetTabViews = 'on:getTabViews',
    UpdateWindowMode = 'on:updateWindowMode',
}

export enum MainChannelTypes{

}