export enum ChannelTypes {
    /** 程序启动Loading */
    StartupLoaded = 'startupLoaded',

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

    SetStore = 'setStore',
    ResetStore = 'resetStoreAndRelaunch',
    Relaunch = 'relaunch',

    CreateProject = 'createProject',

    Maximize = 'maximize',
    Minimize = 'minimize',
    Fullscreen = 'fullscreen',
    Restore = 'restore',

    ShowAbout = 'showAbout',
    SetWebEnv = 'setWebEnv',

    Size = 'size',

    InvokeSubscribe = 'emitSubscribe',
    CapturePage = 'capturePage',
    ConsoleLogger = 'consoleLogger',
    Message = 'message',

    GetTabViews = 'on:getTabViews',
    UpdateWindowMode = 'on:updateWindowMode',
    SetPageFailed = 'on:SetPageFailed',
}

export enum MainChannelTypes{

}