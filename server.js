const express = require('express');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_KEY = (process.env.SUPABASE_KEY || '').trim();
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('SUPABASE_URL dan SUPABASE_KEY wajib diisi (lihat .env.example)');
  process.exit(1);
}

const TABLE = 'loans';
const FIELDS = ['member_name', 'book_title', 'loan_date', 'due_date', 'return_date', 'status'];
const today = () => new Date().toISOString().slice(0, 10);

async function supa(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      ...(SUPABASE_KEY.startsWith('eyJ') ? { Authorization: `Bearer ${SUPABASE_KEY}` } : {}),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw Object.assign(new Error(text || res.statusText), { status: res.status });
  return text ? JSON.parse(text) : null;
}

const pick = body =>
  Object.fromEntries(Object.entries(body).filter(([k, v]) => FIELDS.includes(k) && v !== undefined));

const app = express();
app.use(express.json());

app.get('/', (req, res) => res.json({ name: 'API Peminjaman Buku', base_url: '/loans' }));

app.get('/loans', async (req, res) => {
  const params = new URLSearchParams({ select: '*', order: 'loan_date.desc' });
  const { status, q: cari, ...sisa } = req.query;
  const or = [];
  if (cari) or.push(`(member_name.ilike.*${cari}*,book_title.ilike.*${cari}*)`);
  if (status === 'Terlambat') {
    or.push(`(status.eq.Terlambat,and(status.eq.Dipinjam,due_date.lt.${today()}))`);
  } else if (status) {
    params.set('status', `eq.${status}`);
  }
  if (or.length) params.set('or', or.join(','));
  for (const [k, v] of Object.entries(sisa)) if (v) params.set(k, `eq.${v}`);
  res.json(await supa(`${TABLE}?${params}`));
});

app.get('/loans/:id', async (req, res) => {
  const rows = await supa(`${TABLE}?id=eq.${req.params.id}&select=*`);
  if (!rows.length) return res.status(404).json({ error: 'Data peminjaman tidak ditemukan' });
  res.json(rows[0]);
});

app.post('/loans', async (req, res) => {
  const wajib = ['member_name', 'book_title', 'loan_date', 'due_date'].filter(f => !req.body[f]);
  if (wajib.length) return res.status(400).json({ error: `Field wajib kosong: ${wajib.join(', ')}` });
  const row = { ...pick(req.body), status: req.body.status || 'Dipinjam' };
  res.status(201).json((await supa(TABLE, { method: 'POST', body: row }))[0]);
});

const update = async (req, res) => {
  const patch = pick(req.body);
  if (!Object.keys(patch).length) return res.status(400).json({ error: 'Tidak ada field yang diubah' });
  if (patch.return_date) patch.status = 'Dikembalikan';
  else if (patch.status === 'Dikembalikan') patch.return_date = today();
  const rows = await supa(`${TABLE}?id=eq.${req.params.id}`, { method: 'PATCH', body: patch });
  if (!rows.length) return res.status(404).json({ error: 'Data peminjaman tidak ditemukan' });
  res.json(rows[0]);
};
app.patch('/loans/:id', update);
app.put('/loans/:id', update);

app.delete('/loans/:id', async (req, res) => {
  const rows = await supa(`${TABLE}?id=eq.${req.params.id}`, { method: 'DELETE' });
  if (!rows.length) return res.status(404).json({ error: 'Data peminjaman tidak ditemukan' });
  res.json({ deleted: rows[0] });
});

app.use((err, req, res, next) =>
  res.status(err.status || 500).json({ error: String(err.message).slice(0, 500) })
);

if (require.main === module) {
  app.listen(process.env.PORT || 3000, () => console.log(`Jalan di http://localhost:${process.env.PORT || 3000}`));
}
module.exports = app;
