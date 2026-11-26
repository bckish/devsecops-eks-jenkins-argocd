import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const defaults = { payment: 'http://payment:8080', notification: 'http://notification:8080', ledger: 'http://ledger:8080', fraud: 'http://fraud:8080' };
const routes = new Map([['/', ['index.html','text/html; charset=utf-8']], ['/app.js',['app.js','text/javascript; charset=utf-8']], ['/style.css',['style.css','text/css; charset=utf-8']]]);

export function handler(upstreams = defaults) {
  async function call(service, path, body) {
    const response = await fetch(upstreams[service]+path, {method:body?'POST':'GET',headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(5000)});
    if (!response.ok) { const error = new Error('upstream rejected request'); error.status = response.status; throw error; }
    return response.json();
  }
  return async (req,res) => {
    const send=(status,body)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(body));};
    if(req.method==='GET' && req.url==='/healthz') return send(200,{status:'ok'});
    if(req.method==='GET' && routes.has(req.url)) {
      const [file,type]=routes.get(req.url);
      try {const content=await readFile(new URL(file,import.meta.url));res.writeHead(200,{'content-type':type,'content-security-policy':"default-src 'self'; object-src 'none'; base-uri 'none'",'x-content-type-options':'nosniff'});return res.end(content);}
      catch {return send(500,{error:'asset unavailable'});}
    }
    if(req.method!=='POST'||req.url!=='/api/checkout') return send(404,{error:'not found'});
    let input;
    try {
      let size=0; const chunks=[]; for await(const chunk of req){size+=chunk.length;if(size>4096)return send(413,{error:'body too large'});chunks.push(chunk);}
      input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {return send(400,{error:'invalid JSON'});}
    if(typeof input?.orderId!=='string'||!/^demo-[a-zA-Z0-9-]{1,48}$/.test(input.orderId)||!Number.isSafeInteger(input.amountCents)||input.amountCents<1||input.amountCents>100000||!Array.isArray(input.features)||input.features.length!==3||!input.features.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1))return send(400,{error:'invalid synthetic checkout'});
    try {
      const [fraud,ledger]=await Promise.all([call('fraud','/predict',{features:input.features}),call('ledger','/api/ledger')]);
      const payment=await call('payment','/payments',{orderId:input.orderId,amountCents:input.amountCents});
      const notification=await call('notification','/notifications',{orderId:input.orderId,event:payment.status});
      return send(200,{synthetic:true,payment,notification,fraud,ledger});
    } catch(error){return send(error.status===409?409:502,{error:'synthetic checkout dependency failed; retry using the same order ID'});}
  };
}

if(process.env.NODE_ENV!=='test')createServer(handler()).listen(8080,'0.0.0.0');
