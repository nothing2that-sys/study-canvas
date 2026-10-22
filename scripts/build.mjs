import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
import {root} from './bank.mjs';
export function build(){
 const app=path.join(root,'app'),dist=path.join(root,'dist');
 const files=[];
 function walk(base,rel=''){for(const entry of fs.readdirSync(base,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){if(entry.isSymbolicLink())throw Error('Symlinks are not build inputs');const r=rel?rel+'/'+entry.name:entry.name;if(entry.isDirectory())walk(path.join(base,entry.name),r);else files.push(r);}}walk(app);
 const hash=crypto.createHash('sha256');for(const r of files)hash.update(r+'\0').update(fs.readFileSync(path.join(app,r)));
 const sourceSha256=hash.digest('hex'),buildId='public-'+sourceSha256.slice(0,16);
 // A failed copy leaves the last successful dist available until the new tree exists.
 const temp=path.join(root,'.build-'+process.pid);if(fs.existsSync(temp))throw Error('Temporary build exists');
 fs.cpSync(app,temp,{recursive:true});
 try{
  const modules=files.filter(r=>r.startsWith('js/')&&r.endsWith('.js')).sort().map(r=>'./'+r);
  let html=fs.readFileSync(path.join(temp,'index.html'),'utf8');
  html=html.replace(/<script type="importmap">[\s\S]*?<\/script>/,'<script type="importmap">'+JSON.stringify({imports:Object.fromEntries(modules.map(r=>[r,r+'?v='+buildId]))})+'</script>');
  html=html.replace(/(css\/app\.css|js\/app\.js)\?v=[^"']+/g,'$1?v='+buildId);fs.writeFileSync(path.join(temp,'index.html'),html);
  let sw=fs.readFileSync(path.join(temp,'service-worker.js'),'utf8').replace(/const CACHE_NAME = "[^"]+";/,'const CACHE_NAME = "math-canvas-pro-v'+buildId+'";');
  sw=sw.replace(/\/\* MODULES_PRECACHE_START \*\/[\s\S]*?\/\* MODULES_PRECACHE_END \*\//,['/* MODULES_PRECACHE_START */',...modules.filter(r=>r!=='./js/app.js').map(r=>'  "'+r+'?v='+buildId+'",'),'  /* MODULES_PRECACHE_END */'].join('\n'));
  sw=sw.replace(/(\.\/css\/app\.css|\.\/js\/app\.js)\?v=[^"']+/g,'$1?v='+buildId);fs.writeFileSync(path.join(temp,'service-worker.js'),sw);
  const js=path.join(temp,'js/app.js');fs.writeFileSync(js,fs.readFileSync(js,'utf8').replace(/const APP_BUILD_ID = "[^"]+";/,'const APP_BUILD_ID = "'+buildId+'";'));
  fs.writeFileSync(path.join(temp,'build-manifest.json'),JSON.stringify({buildId,sourceSha256,contentVersion:'1.0.0',source:'Public source; no private Git metadata'},null,2)+'\n');
  if(fs.existsSync(dist)){if(fs.lstatSync(dist).isSymbolicLink())throw Error('dist symlink refused');fs.rmSync(dist,{recursive:true});}
  fs.renameSync(temp,dist);console.log(JSON.stringify({buildId,sourceSha256,files:files.length}));return {dist,buildId,sourceSha256,files:files.length};
 }catch(e){if(fs.existsSync(temp))fs.rmSync(temp,{recursive:true});throw e;}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))build();
