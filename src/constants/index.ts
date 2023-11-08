import packageJson from '../../package.json';

export const ENT_RELEASE = process.argv.findIndex(v=>v==='ent')!==-1; // 是否为企业级应用

export const HOME_BROWSER_MIN_WIDTH = 500;
export const HOME_BROWSER_MIN_HEIGHT = 350;

export const BROWSER_DEFAULT_WIDTH = 1180;
export const BROWSER_DEFAULT_HEIGHT = 750;

export const LOADING_WINDOW_WIDTH = 96;
export const LOADING_WINDOW_HEIGHT = 96;

export const MAC_OS_CHROME_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome';
export const WINDOW_CHROME_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome';

export const PRODUCT_AUTHOR = 'Mockplus Technology Co.,Ltd.';
export const PRODUCT_NAME = packageJson.productName;
export const APPID = packageJson.appId;
export const APP_NAME = packageJson.name;