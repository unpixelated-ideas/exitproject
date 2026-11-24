// Local QA only. Serves a copy of the production build with URLs redirected to
// this in-memory Worker/database. Never contacts or writes the deployed API.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from './worker.mjs';
const RealDate = Date;
let clock = '2027-01-02T12:00:00Z';
globalThis.Date = class extends RealDate { constructor(...args) {super(...(args.length ? args : [clock]));} static now(){return RealDate.parse(clock);} };
const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
const wrap=(sql,args=[])=>({bind:(...values)=>wrap(sql,values),first:async()=>db.prepare(sql).get(...args)??null,run:async()=>({meta:{changes:Number(db.prepare(sql.replaceAll("julianday('now')",`julianday('${clock}')`)).run(...args).changes)}})});
const env={DB:{prepare:sql=>wrap(sql)}};
const root=fileURLToPath(new URL('../../application/dist',import.meta.url));
createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1:5175');
 if(url.pathname==='/qa-control') {
  const state=JSON.parse(await readFile('/tmp/mta-ui-clock.json','utf8'));
  clock=state.clock; res.end(JSON.stringify({clock,count:db.prepare('SELECT COUNT(*) n FROM submissions').get().n}));return;
 }
 if(url.pathname.startsWith('/qa-api/')) {
  const state=JSON.parse(await readFile('/tmp/mta-ui-clock.json','utf8'));clock=state.clock;
  if(state.fail){res.writeHead(503,{'Content-Type':'application/json'});res.end('{}');return;}
  const chunks=[]; for await(const c of req)chunks.push(c);
  const response=await worker.fetch(new Request('https://mta-exit-voting.cloaks-chimps-6e.workers.dev'+url.pathname.slice(7),{method:req.method,headers:{'Content-Type':'application/json',Origin:'https://unpixelated-ideas.github.io'},...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})}),env);
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
 }
 const path=resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
 if(!path.startsWith(root+'/')){res.writeHead(403);res.end();return;}
 let body=await readFile(path);const ext=extname(path);
 if(ext==='.js')body=Buffer.from(body.toString().replaceAll('https://mta-exit-voting.cloaks-chimps-6e.workers.dev','http://127.0.0.1:5175/qa-api').replaceAll('https://unpixelated-ideas.github.io','http://127.0.0.1:5175'));
 res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[ext]||'application/octet-stream'});res.end(body);
 }catch(error){res.writeHead(500);res.end(String(error));}
}).listen(5175,'127.0.0.1',()=>console.log('Local isolated production UI QA: http://127.0.0.1:5175'));
