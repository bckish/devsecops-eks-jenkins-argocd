import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
process.env.NODE_ENV='test';
const { handler } = await import('./server.mjs');

test('idempotent synthetic notification and invalid input', async () => {
  const server=createServer(handler()); await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try {
    const url=`http://127.0.0.1:${server.address().port}/notifications`;
    const call=body=>fetch(url,{method:'POST',body:JSON.stringify(body)});
    assert.equal((await call({orderId:'demo-one',event:'MOCK_APPROVED'})).status,201);
    assert.equal((await call({orderId:'demo-one',event:'MOCK_APPROVED'})).status,200);
    assert.equal((await call({orderId:'real-one',event:'MOCK_APPROVED'})).status,400);
  } finally { await new Promise(r=>server.close(r)); }
});
