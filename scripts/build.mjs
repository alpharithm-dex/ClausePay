import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {assetPaths,readAsset} from './assets.mjs';

const read = path => readFile(new URL('../'+path,import.meta.url),'utf8');
const worker = await read('worker.js');
const assets = {};
for (const path of assetPaths) {
  const asset=await readAsset(path);
  if(!asset) throw new Error('Missing asset '+path+'. Run npm ci first.');
  assets[path]={body:asset.body.toString('utf8'),type:asset.type};
}
const entry = worker+'\nconst assets = '+JSON.stringify(assets)+`;
export default { fetch(request,env) {
  const path = new URL(request.url).pathname;
  if (path.startsWith('/api/')) return handleApi(request,env);
  const asset = Object.hasOwn(assets,path) && assets[path];
  if (!asset || request.method !== 'GET') return new Response('Not found',{status:404});
  return new Response(asset.body,{headers:{'Content-Type':asset.type+'; charset=utf-8','X-Content-Type-Options':'nosniff'}});
}};`;
await mkdir('dist/server',{recursive:true});
await mkdir('dist/.openai',{recursive:true});
await writeFile('dist/server/index.js',entry);
await copyFile('.openai/hosting.json','dist/.openai/hosting.json');
