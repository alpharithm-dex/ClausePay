import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {handleApi} from '../worker.js';

const mime = {'/':'text/html','/style.css':'text/css','/app.js':'text/javascript','/sample.js':'text/javascript'};
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
    } else if (req.method === 'GET' && Object.hasOwn(mime,path)) {
      const file = path === '/' ? 'index.html' : path.slice(1);
      response = new Response(await readFile(new URL('../web/'+file,import.meta.url)),{
        headers:{'Content-Type':mime[path]+'; charset=utf-8'}
      });
    } else {
      response = new Response('Not found',{status:404});
    }
    res.writeHead(response.status,Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(500).end('Request failed');
  }
}).listen(port,'127.0.0.1',()=>console.log('ClausePay http://127.0.0.1:'+port));
