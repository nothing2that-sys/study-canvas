import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {root} from './bank.mjs';
const args=process.argv.slice(2),portIndex=args.indexOf('--port'),port=portIndex<0?4173:Number(args[portIndex+1]);
if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid port');
const base=path.join(root,args.includes('--dist')?'dist':'app');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.webmanifest':'application/manifest+json'};
http.createServer((req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
  const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''),target=path.resolve(base,relative);
  if(target!==base&&!target.startsWith(base+path.sep)){res.writeHead(403);return res.end();}
  let file=target;if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  if(!fs.existsSync(file)){if(path.extname(relative)){res.writeHead(404);return res.end('Not found');}file=path.join(base,'index.html');}
  const real=fs.realpathSync(file),realBase=fs.realpathSync(base);if(!real.startsWith(realBase+path.sep)){res.writeHead(403);return res.end();}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
 }catch{res.writeHead(400);res.end('Bad request');}
}).listen(port,'127.0.0.1',()=>console.log('Study Canvas: http://localhost:'+port));
