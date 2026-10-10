# API Peminjaman Buku Perpustakaan

REST API sederhana untuk mencatat peminjaman & pengembalian buku oleh anggota perpustakaan.
Dibuat dengan **Node.js + Express.js**, database **Supabase** (PostgreSQL), dan siap deploy di **Vercel**.

## Fitur

- CRUD data peminjaman buku (Create, Read, Update, Delete)
- Filter query: `?status=Terlambat`, `?status=Dipinjam`, `?q=kata_kunci` (cari nama anggota / judul buku), atau filter kolom lain, misal `?member_name=budi`
- Status `Terlambat` dihitung otomatis: peminjaman yang masih berstatus `Dipinjam` tetapi sudah melewati `due_date`
- Saat `return_date` diisi, status otomatis menjadi `Dikembalikan`

## Struktur Data

Tabel `public.loans` (lihat [`schema.sql`](schema.sql)):

| Kolom         | Tipe        | Keterangan                                                        |
| ------------- | ----------- | ----------------------------------------------------------------- |
| `id`          | bigint (PK) | Auto increment                                                     |
| `member_name` | text        | Nama anggota peminjam (wajib)                                      |
| `book_title`  | text        | Judul buku (wajib)                                                |
| `loan_date`   | date        | Tanggal pinjam (wajib)                                            |
| `due_date`    | date        | Tanggal jatuh tempo (wajib)                                       |
| `return_date` | date        | Tanggal dikembalikan, `NULL` selama masih dipinjam                 |
| `status`      | text        | `Dipinjam` / `Dikembalikan` / `Terlambat` (default `Dipinjam`)      |
| `created_at`  | timestamptz | Waktu pembuatan record (default `now()`)                            |

## Instalasi & Menjalankan Lokal

Prasyarat: Node.js >= 20.

1. Buat project Supabase, lalu jalankan isi file [`schema.sql`](schema.sql) di **SQL Editor** Supabase.
2. Salin kredensial Supabase (Project Settings → API):
   - `SUPABASE_URL` → Project URL
   - `SUPABASE_KEY` → **service_role key** (khusus server, jangan dipakai di frontend)
3. Siapkan environment:

   ```bash
   cp .env.example .env
   # lalu isi SUPABASE_URL dan SUPABASE_KEY di file .env
   ```

4. Install & jalankan:

   ```bash
   npm install
   npm run dev      # http://localhost:3000
   ```

5. Tes otomatis (tanpa perlu koneksi Supabase):

   ```bash
   npm test
   ```

## Endpoint

Base URL lokal: `http://localhost:3000` &nbsp;|&nbsp; Deployment: `https://responsi-mod-1-ppb-kel-35-shift-5.vercel.app`

| Method   | Endpoint      | Keterangan                        |
| -------- | ------------- | --------------------------------- |
| `GET`    | `/`           | Info API                          |
| `GET`    | `/loans`      | Semua data, bisa difilter         |
| `GET`    | `/loans/:id`  | Detail satu data                  |
| `POST`   | `/loans`      | Tambah peminjaman                 |
| `PATCH`  | `/loans/:id`  | Update (`PUT` juga diterima)      |
| `DELETE` | `/loans/:id`  | Hapus data                        |

### Contoh Request & Response

**Tambah peminjaman**

```bash
curl -X POST http://localhost:3000/loans \
  -H "Content-Type: application/json" \
  -d '{"member_name":"Budi Santoso","book_title":"Laskar Pelangi","loan_date":"2026-10-01","due_date":"2026-10-08"}'
```

```json
{
  "id": 1,
  "member_name": "Budi Santoso",
  "book_title": "Laskar Pelangi",
  "loan_date": "2026-10-01",
  "due_date": "2026-10-08",
  "return_date": null,
  "status": "Dipinjam",
  "created_at": "2026-10-01T04:20:00.123Z"
}
```

**Lihat semua data**

```bash
curl http://localhost:3000/loans
```

```json
[
  {
    "id": 1,
    "member_name": "Budi Santoso",
    "book_title": "Laskar Pelangi",
    "loan_date": "2026-10-01",
    "due_date": "2026-10-08",
    "return_date": null,
    "status": "Dipinjam",
    "created_at": "2026-10-01T04:20:00.123Z"
  }
]
```

**Filter data**

```bash
curl "http://localhost:3000/loans?status=Terlambat"
curl "http://localhost:3000/loans?status=Dikembalikan"
curl "http://localhost:3000/loans?q=budi"
```

**Update / catat pengembalian**

```bash
curl -X PATCH http://localhost:3000/loans/1 \
  -H "Content-Type: application/json" \
  -d '{"return_date":"2026-10-06"}'
```

```json
{
  "id": 1,
  "member_name": "Budi Santoso",
  "book_title": "Laskar Pelangi",
  "loan_date": "2026-10-01",
  "due_date": "2026-10-08",
  "return_date": "2026-10-06",
  "status": "Dikembalikan",
  "created_at": "2026-10-01T04:20:00.123Z"
}
```

**Hapus data**

```bash
curl -X DELETE http://localhost:3000/loans/1
```

```json
{ "deleted": { "id": 1, "member_name": "Budi Santoso", "...": "..." } }
```

Response error selalu berformat `{ "error": "pesan" }` dengan status `400` (validasi), `404` (tidak ditemukan), atau `500` (gagal dari Supabase).

## Deployment ke Vercel

API ini dirancang sebagai satu fungsi serverless: `server.js` men-*export* Express app, dan Vercel mendeteksinya secara otomatis (tanpa konfigurasi tambahan).

1. Push repo ini ke GitHub.
2. Di [vercel.com](https://vercel.com) → **Add New → Project** → import repo, lalu:
   - Framework Preset: **Other**
   - Environment Variables: tambahkan `SUPABASE_URL` dan `SUPABASE_KEY`
3. **Deploy**. Semua endpoint langsung tersedia di domain Vercel tanpa prefix `/api`, misal `https://responsi-mod-1-ppb-kel-35-shift-5.vercel.app/loans`.

Alternatif via CLI:

```bash
npm i -g vercel
vercel login
vercel --prod
# set env var: vercel env add SUPABASE_URL  dan  vercel env add SUPABASE_KEY
```

**Base URL deployment: `https://responsi-mod-1-ppb-kel-35-shift-5.vercel.app`**

> Catatan keamanan: `SUPABASE_KEY` memakai *service_role key* sehingga hanya boleh disimpan di server/env Vercel, tidak pernah diekspos ke klien.

## Struktur Repo

```
server.js       # seluruh route + akses Supabase REST
test.js         # tes otomatis (node:test, tanpa dependency)
schema.sql      # DDL tabel loans
.env.example    # contoh environment variable
```

