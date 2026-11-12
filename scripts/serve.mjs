import {createServer} from 'node:http';
import {readAsset} from './assets.mjs';
import {handleApi} from '../worker.js';

const port = Number(process.env.PORT || 4173);
createServer(async (req,res) => {
  try {
    const path = new URL(req.url,'http://localhost').pathname;
    let response;
    if (path.startsWith('/api/')) {
      const origin = 'http://'+req.headers.host;
      if (!['localhost:'+port,'127.0.0.1:'+port].includes(req.headers.host)) {
        res.writeHead(403).end(); return;
      }
      const options = {method:req.method,headers:req.headers};
      if (!['GET','HEAD'].includes(req.method)) {options.body=req; options.duplex='half';}
      response = await handleApi(new Request(origin+req.url,options),process.env);
    } else if (req.method === 'GET') {
      const asset=await readAsset(path);
      response=asset?new Response(asset.body,{headers:{'Content-Type':asset.type+'; charset=utf-8',
        'X-Content-Type-Options':'nosniff'}}):new Response('Not found',{status:404});
    } else {
      response = new Response('Not found',{status:404});
    }
    res.writeHead(response.status,Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(500).end('Request failed');
  }
}).listen(port,'127.0.0.1',()=>console.log('ClausePay http://127.0.0.1:'+port));
