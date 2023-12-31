/* eslint-disable @typescript-eslint/no-explicit-any */
import type IForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import fs from 'fs-extra';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ForkTsCheckerWebpackPlugin: typeof IForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

class CopyStatic {
  // 在插件函数的 prototype 上定义一个 `apply` 方法，以 compiler 为参数。
  apply(compiler:any) {
    // 指定一个挂载到 webpack 自身的事件钩子。
    compiler.hooks.emit.tapAsync(
      'CopyStatic',
      (compilation:any, callback:any) => {
        // if(!fs.existsSync('./.webpack/renderer/')){
          fs.copySync('./src/static/renderer/', './.webpack/renderer/', {recursive: true});
        // }
        // if(!fs.existsSync('./.webpack/main/')){
          fs.copySync('./src/static/main/', './.webpack/main/', {recursive: true});
        // }
        callback();
      }
    );
  }
}

export const plugins = [
  new ForkTsCheckerWebpackPlugin({
    logger: 'webpack-infrastructure',
  }),
  new CopyStatic()
];


