const test = require('node:test');
const assert = require('node:assert');

process.env.SUPABASE_URL = 'https://demo.supabase.co';
process.env.SUPABASE_KEY = 'dummy-key';

const realFetch = global.fetch;
const calls = [];
let mode = 'ok';
global.fetch = async (url, opts = {}) => {
  calls.push({ url: String(url), method: opts.method || 'GET', body: opts.body ? JSON.parse(opts.body) : null });
  if (mode === 'fail') return { ok: false, status: 500, statusText: 'boom', text: async () => 'Supabase error' };
  const row = mode === 'empty' ? null : { id: 1, member_name: 'Budi', status: 'Dipinjam', ...(opts.body ? JSON.parse(opts.body) : {}) };
  return { ok: true, status: 200, text: async () => JSON.stringify(row ? [row] : []) };
};

const app = require('./server');
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
const hit = (path, opts) => realFetch(base + path, opts);
const json = (path, opts) => hit(path, opts).then(r => r.json().then(body => ({ status: r.status, body })));
const last = () => calls[calls.length - 1];

test('filter status=Terlambat memakai or= (status Terlambat ATAU Dipinjam lewat due_date)', async () => {
  const res = await hit('/loans?status=Terlambat&q=budi');
  assert.equal(res.status, 200);
  const url = decodeURIComponent(last().url);
  assert.match(url, /,\(status\.eq\.Terlambat,and\(status\.eq\.Dipinjam,due_date\.lt\.\d{4}-\d{2}-\d{2}\)\)/);
  assert.match(url, /member_name\.ilike\.\*budi\*/);
  assert.match(url, /order=loan_date\.desc/);
});

test('filter status biasa tidak memakai or=', async () => {
  await hit('/loans?status=Dikembalikan&member_name=budi');
  assert.match(last().url, /status=eq\.Dikembalikan/);
  assert.match(last().url, /member_name=eq\.budi/);
  assert.doesNotMatch(last().url, /or=/);
});

test('POST menolak field wajib yang kosong', async () => {
  const res = await json('/loans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ member_name: 'Budi' }) });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /book_title/);
});

test('POST hanya mengirim field yang dikenal dan default status Dipinjam', async () => {
  const res = await json('/loans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ member_name: 'Budi', book_title: 'Laskar', loan_date: '2026-10-01', due_date: '2026-10-08', is_admin: true }),
  });
  assert.equal(res.status, 201);
  assert.deepEqual(last().body, {
    member_name: 'Budi', book_title: 'Laskar', loan_date: '2026-10-01', due_date: '2026-10-08', status: 'Dipinjam',
  });
});

test('PATCH dengan return_date otomatis set status Dikembalikan', async () => {
  const res = await json('/loans/1', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ return_date: '2026-10-05' }) });
  assert.equal(res.status, 200);
  assert.equal(last().method, 'PATCH');
  assert.equal(last().body.return_date, '2026-10-05');
  assert.equal(last().body.status, 'Dikembalikan');
});

test('PATCH status Dikembalikan tanpa tanggal mengisi return_date hari ini', async () => {
  await json('/loans/1', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Dikembalikan' }) });
  assert.match(last().body.return_date, /^\d{4}-\d{2}-\d{2}$/);
});

test('PATCH tanpa field valid ditolak 400', async () => {
  const res = await json('/loans/1', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_admin: true }) });
  assert.equal(res.status, 400);
});

test('DELETE mengembalikan baris yang dihapus', async () => {
  const res = await json('/loans/1', { method: 'DELETE' });
  assert.equal(res.status, 200);
  assert.equal(last().method, 'DELETE');
  assert.match(last().url, /id=eq\.1$/);
});

test('GET /loans/:id yang tidak ada balas 404', async () => {
  mode = 'empty';
  const res = await json('/loans/99');
  assert.equal(res.status, 404);
  mode = 'ok';
});

test('error dari Supabase diteruskan sebagai 500 JSON', async () => {
  mode = 'fail';
  const res = await json('/loans');
  assert.equal(res.status, 500);
  assert.match(res.body.error, /Supabase error/);
  mode = 'ok';
});

test('env dengan spasi/newline di ujung tetap dibersihkan', async () => {
  process.env.SUPABASE_URL = '  https://demo.supabase.co\r\n';
  process.env.SUPABASE_KEY = '  key-abc\r\n';
  delete require.cache[require.resolve('./server')];
  const appBersih = require('./server');
  const srv = appBersih.listen(0);
  await realFetch(`http://127.0.0.1:${srv.address().port}/loans`);
  assert.equal(last().url, 'https://demo.supabase.co/rest/v1/loans?select=*&order=loan_date.desc');
  srv.close();
});

test.after(() => server.close());
