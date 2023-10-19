import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';

import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';

const config: ForgeConfig = {
  buildIdentifier: 'bate',
  packagerConfig: {
    appBundleId: 'com.electron.rp-app',
    name: 'rp-app',
    asar: true,
    icon: '/src/assets/icons/icon',
    osxSign: {
      identity: 'Liu Song (7PZMT8T5KL)'
    }, // object must exist even if empty
  },
  hooks: { },
  rebuildConfig: {},
  makers: [new MakerSquirrel({}), new MakerZIP({}, ['darwin']), new MakerRpm({}), new MakerDeb({})],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config:{
        authToken: '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',
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
            // html: './src/views/app/index.html',
            // js: './src/views/app/renderer.ts',
            name: 'login_window',
            preload: {
              js: './src/preload.ts',
            },
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
          },
          // {
          //   html: './src/views/project/child/index.html',
          //   js: './src/views/project/child/renderer.ts',
          //   name: 'project_child_window',
          //   preload: {
          //     js: './src/views/project/child/preload.ts',
          //   },
          // },
        ],
      },
    }),
  ],
};

export default config;
