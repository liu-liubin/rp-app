declare interface Window {
    projectApi: {
        toProject:(callback:(name:string)=>void)=>void;
    };

    RPBridge: {
        toProject:(url, name)=>void;
    }
}