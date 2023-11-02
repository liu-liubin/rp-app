import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';

import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';
import {PROGRAM_AUTHOR} from './src/constants';

const config: ForgeConfig = {
  buildIdentifier: 'bate',
  packagerConfig: {
    appBundleId: 'com.electron.rp-app-electron',
    name: 'rp-app',
    asar: true,
    icon: './src/assets/icons/icon',
    osxSign: {
      identity: 'Liu Song (7PZMT8T5KL)',
      // optionsForFile: ()=>{
      //   return {
      //     entitlements: './cert/entitlements.mac.plist'
      //   }
      // },
    }, // object must exist even if empty
    osxNotarize: {
      tool: 'notarytool',
      appleId: 'jongde.com@gmail.com',
      appleIdPassword: 'rggl-xqaj-dpti-xzwa',
      teamId: '7PZMT8T5KL'
    },
  },
  hooks: {
    
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      authors: PROGRAM_AUTHOR,
      description: 'mockplus rp',
      certificateFile: './cert/mockplus.pfx',
      certificatePassword: "Jongde@61367719",
      setupIcon: './src/assets/icons/icon.ico',
    }), 
    new MakerDMG({
      icon: './src/assets/icons/icon.icns'
    }),
    new MakerZIP({ }, ['darwin', 'linux', 'win32']), 
    new MakerRpm({}), 
    new MakerDeb({})
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
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      mainConfig,
      renderer: {
        config: rendererConfig,
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
            name: 'html_error'
          },
          {
            html: './src/views/error/crash/index.html',
            js: './src/views/error/crash/index.ts',
            name: 'html_error_crash',
            // preload: {
            //   js: './src/views/login/preload.ts',
            // },
          },
          {
            html: './src/views/loading/index.html',
            js: './src/views/loading/index.ts',
            name: 'html_loading',
            // preload: {
            //   js: './src/views/login/preload.ts',
            // },
          }
        ],
      },
    }),
  ],
};



export default config;
