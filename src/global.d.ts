declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

declare const LOGIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const LOGIN_WINDOW_WEBPACK_ENTRY: string;

declare const PROJECT_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const PROJECT_WINDOW_WEBPACK_ENTRY: string;

declare const PROJECT_CHILD_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const PROJECT_CHILD_WINDOW_WEBPACK_ENTRY: string;

declare const HTML_ERROR_CRASH_WEBPACK_ENTRY: string;

declare const HTML_LOADING_WEBPACK_ENTRY: string;

declare namespace NodeJS {
    interface Process {
        env: {
            moduleName: string;
        }
    }
}