declare const MAIN_APP_PRELOAD_WEBPACK_ENTRY: string;
declare const MAIN_APP_WEBPACK_ENTRY: string;

declare const HTML_ERROR_WEBPACK_ENTRY: string;
declare const HTML_ERROR_CRASH_WEBPACK_ENTRY: string;

declare const HTML_LOADING_WEBPACK_ENTRY: string;

declare namespace NodeJS {
    interface Process {
        env: {
            moduleName: string;
            npm_package_version: string;
            windowId: string;
        }
    }
}

declare module '*.png';