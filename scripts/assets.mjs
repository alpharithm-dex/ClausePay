import {readFile} from 'node:fs/promises';

const appFiles = {'/':'index.html','/style.css':'style.css','/app.js':'app.js','/sample.js':'sample.js',
  '/schedule.js':'schedule.js','/workflow.js':'workflow.js'};
const vendorFiles = {
  'scheduler.module.js':'scheduler.module.js',
  'scheduler.css':'scheduler.css',
  'stockholm-light.css':'stockholm-light.css'
};
const prefix='/vendor/bryntum/';
export const assetPaths=[...Object.keys(appFiles),...Object.keys(vendorFiles).map(path=>prefix+path)];

function mime(file) {
  if(file.endsWith('.css')) return 'text/css';
  if(file.endsWith('.js')) return 'text/javascript';
  if(file.endsWith('.woff2')) return 'font/woff2';
  if(file.endsWith('.woff')) return 'font/woff';
  return 'text/html';
}

export async function readAsset(path) {
  const vendor = path.startsWith(prefix);
  const files = vendor ? vendorFiles : appFiles;
  const key = vendor ? path.slice(prefix.length) : path;
  if(!Object.hasOwn(files,key)) return null;
  const file=files[key];
  const root=vendor?'../node_modules/@bryntum/scheduler/':'../web/';
  try {
    return {body:await readFile(new URL(root+file,import.meta.url)),type:mime(file)};
  } catch(error) {
    if(error.code==='ENOENT') return null;
    throw error;
  }
}
