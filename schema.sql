create table if not exists public.loans (
  id bigint generated always as identity primary key,
  member_name text not null,
  book_title text not null,
  loan_date date not null,
  due_date date not null,
  return_date date,
  status text not null default 'Dipinjam'
    check (status in ('Dipinjam', 'Dikembalikan', 'Terlambat')),
  created_at timestamptz not null default now()
);
