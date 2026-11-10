import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';

const read = path => readFile(new URL('../'+path,import.meta.url),'utf8');
const worker = await read('worker.js');
const assets = {};
for (const [path,file,type] of [
  ['/','index.html','text/html'], ['/style.css','style.css','text/css'],
  ['/app.js','app.js','text/javascript'], ['/sample.js','sample.js','text/javascript']
]) assets[path] = {body:await read('web/'+file),type};
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
