/* eslint-disable @typescript-eslint/no-var-requires */
// console.log(process.argv)
const fs = require('fs-extra');
const path  = require('path');
const packJson = require('./package.json');

if(process.argv.find(v=>v==='prod')){
    packJson['appType'] = 'prod';
}else{
    packJson['appType'] = 'test';
}

// if(process.platform === 'darwin'){

// }

fs.writeFileSync(path.join('./package.json'), JSON.stringify(packJson, '', "  "), { encoding: 'utf-8'});