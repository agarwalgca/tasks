-- Saved filters. The criteria live in a jsonb blob rather than columns: the
-- shape is read and written only by the client, and adding a criterion should
-- not mean a migration every time.

create table public.saved_filters (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  criteria jsonb not null default '{}'::jsonb,
  sort_order double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index saved_filters_user_updated_idx
  on public.saved_filters (user_id, updated_at);

create trigger saved_filters_updated_at
  before insert or update on public.saved_filters
  for each row execute function public.set_updated_at();

alter table public.saved_filters enable row level security;

create policy saved_filters_own on public.saved_filters
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter publication supabase_realtime add table public.saved_filters;
