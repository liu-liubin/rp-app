import type { ForgeConfig } from '@electron-forge/shared-types';
// import { MakerSquirrel } from '@electron-forge/maker-squirrel';
// import { MakerWix } from '@electron-forge/maker-wix';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
// import { MakerDMG } from '@electron-forge/maker-dmg';
// import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import {Configuration, build } from "electron-builder"; // 由于使用fore打包mac window存在异常，因此使用此方案

import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';
import {APPID, APP_NAME, PRODUCT_NAME, APP_VERSION} from './src/constants';

import { notarize } from 'electron-notarize';

const builderOptions: Configuration = {
  "appId": APPID,
  "productName": PRODUCT_NAME,
  "executableName": APP_NAME,
  "generateUpdatesFilesForAllChannels": true,
  "artifactName": '${name}_${arch}_${version}.${ext}', // 生成的包名 - 不可带路径
  "electronDownload": {
    "mirror": "https://npm.taobao.org/mirrors/electron/"
  },
  "files": [".webpack/**/*"],
  "directories":{
    "output": `out/builder/${process.platform}/${APP_VERSION}`,
    "buildResources": "installer/resources"
  },
  afterSign: async (context) => {
    const { electronPlatformName, appOutDir } = context; 
    if (electronPlatformName !== 'darwin') {
      return;
    }

    console.log('notarizing...');
  
    const appName = context.packager.appInfo.productFilename;
  
    return await notarize({
      appBundleId: APPID,
      appPath: `${appOutDir}/${appName}.app`,
      appleId: 'jongde.com@gmail.com',
      appleIdPassword: 'rggl-xqaj-dpti-xzwa',
    }).catch(e => {
      console.log(e);
      throw e;
    });
  },
  "win": {
    "icon": "./src/assets/icons/icon.ico",
    "signingHashAlgorithms": ["sha256"], // 签名文件需指定
    // "certificateFile": "./cert/mockplus.pfx",  // 当 CSC_LINK (WIN_CSC_LINK) 变量无法使用时用它
    // "certificatePassword": "Jongde@61367719",
    // "verifyUpdateCodeSignature": true,
    "target": [
      {
        "target": "nsis",
        "arch": [
          "x64",
          "ia32"
        ]
      }
    ]
  },
  "nsis": {
    "oneClick": false,
    "perMachine": false,
    "allowElevation": true,
    "allowToChangeInstallationDirectory": true,
    "installerIcon": "./src/assets/icons/icon.ico",
    "uninstallerIcon": "./src/assets/icons/icon.ico",
    "installerHeaderIcon": "./src/assets/icons/icon.ico",
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true,
    // "shortcutName": "rp"
  },
  "mac": {
    "icon": "./src/assets/icons/icon.png",
    "category": "public.app-category.graphics-design",
    "identity": "Liu Song (7PZMT8T5KL)",
    "hardenedRuntime": true,
    "target": [
      {
        "target": "dmg",
        "arch": ["arm64", "x64"],
      },
      {
        "target": "zip",
        "arch": ["arm64", "x64"],
      }
    ],
    "notarize" : {
      "appBundleId": APPID,
      "teamId": "7PZMT8T5KL"
    }
  },
  "dmg": {
    "backgroundColor": "#f2f2f2", // 安装窗口背景色
    "contents": [
      {
        x: 20,
        y: 90,
        type: "file"
      },
      {
        x: 220,
        y: 90,
        type: "link",
        path: "/Applications"
      }
    ],
    "window": {  // 安装窗口尺寸，以及文件显示的位置
      "width": 420,
      "height": 260
    },
    "icon": "./src/assets/icons/icon.png",
    "format": "ULFO", // 硬盘图片格式
    "sign": true
  },
  "linux": {
    "icon": '',
    "desktop": {
      "StartupNotify": "false",
      "Encoding": "UTF-8",
      "MimeType": "x-scheme-handler/deeplink"
    },
    "target": ["deb"] 
  },
  "deb": {
    "priority": "optional",
    "icon": "./src/assets/icons/icon.png"
  },
  "publish": {
    "provider": 'generic',
    "url": "",
    // "provider": 'github',
    // "repo": "rp-app",
    // "owner": "liu-liubin"
  }
}

const config: ForgeConfig = {
  buildIdentifier: 'forge',
  packagerConfig: {
    executableName: APP_NAME,  // 注意：linux打包与package.json name保持一致
    appBundleId: APPID,
    name: PRODUCT_NAME,
    asar: true,
    icon: './src/assets/icons',
    osxSign: {
      // identity: 'Liu Song (7PZMT8T5KL)',
      // optionsForFile: ()=>{
      //   return {
      //     entitlements: './cert/entitlements.mac.plist'
      //   }
      // },
      // export CSC_LINK=cert/mockplus.p12
      // export CSC_KEY_PASSWORD="123456"
    },
    // osxNotarize: {
    //   tool: 'notarytool',
    //   appleId: 'jongde.com@gmail.com',
    //   appleIdPassword: 'rggl-xqaj-dpti-xzwa',
    //   teamId: '7PZMT8T5KL'
    // },
  },
  hooks: {
    preMake: async () => {
      if(process.platform !== 'linux'){
        build({
          config: builderOptions
        });
      }
    }
  },
  rebuildConfig: {},
  makers: [
    // new MakerSquirrel({
    //   authors: PRODUCT_AUTHOR,
    //   noMsi: false,
    //   description: 'mockplus rp',
    //   certificateFile: './cert/mockplus.pfx',
    //   certificatePassword: "Jongde@61367719",
    //   setupIcon: './src/assets/icons/icon.ico',
    // }), 
    // new MakerDMG({
    //   icon: './src/assets/icons/icon.icns',
    //   format: 'ULFO'
    // }),
    new MakerZIP({ }), 
    new MakerRpm({
      options: {
        icon: './src/assets/icons/icon.png',
      }
    }), 
    new MakerDeb({
      options: {
        icon: './src/assets/icons/icon.png',
      }
    })
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config:{
        repository: {
          owner: 'liu-liubin',
          name: 'rp-app'
        },
        prerelease: true
      }
    }
  ],
  plugins: [
    // new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      mainConfig,
      renderer: {
        config: rendererConfig,
        // nodeIntegration: true,
        entryPoints: [
          {
            html: './src/views/main/index.html',
            js: './src/views/main/index.ts',
            name: 'main_app',
            preload: {
              js: './src/preload.ts',
            },
          },
          {
            html: './src/views/error/index.html',
            js: './src/views/error/index.ts',
            name: 'html_error',
            preload: {
              js: './src/preload.ts',
            },
          },
          {
            html: './src/views/error/crash/index.html',
            js: './src/views/error/crash/index.ts',
            name: 'html_error_crash',
            preload: {
              js: './src/preload.ts',
            },
          },
          {
            html: './src/views/loading/index.html',
            js: './src/views/loading/index.ts',
            name: 'html_loading',
            preload: {
              js: './src/preload.ts',
            },
          },
          {
            name: 'static_login', // 占位 - 注入静态文件
            preload: {
              js: './src/preload.ts',
            },
          }
        ],
      },
    }),
  ],
};



export default config;
