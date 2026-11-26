import { createServer } from 'node:http';

export function handler() {
  const records = new Map();
  return async (req, res) => {
    const send = (status, body) => { res.writeHead(status, {'content-type':'application/json'}); res.end(JSON.stringify(body)); };
    if (req.method === 'GET' && req.url === '/healthz') return send(200, {status:'ok'});
    if (req.method !== 'POST' || req.url !== '/notifications') return send(404, {error:'not found'});
    try {
      let size = 0; const chunks = [];
      for await (const chunk of req) { size += chunk.length; if (size > 4096) return send(413, {error:'body too large'}); chunks.push(chunk); }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (typeof body?.orderId !== 'string' || !/^demo-[a-zA-Z0-9-]{1,48}$/.test(body.orderId) || body.event !== 'MOCK_APPROVED') return send(400, {error:'invalid synthetic event'});
      if (records.has(body.orderId)) return send(200, records.get(body.orderId));
      if (records.size >= 1000) return send(503, {error:'demo capacity reached'});
      const value = {orderId:body.orderId, status:'MOCK_RECORDED', synthetic:true};
      records.set(body.orderId, value);
      return send(201, value);
    } catch { return send(400, {error:'invalid JSON'}); }
  };
}

if (process.env.NODE_ENV !== 'test') createServer(handler()).listen(8080, '0.0.0.0');
