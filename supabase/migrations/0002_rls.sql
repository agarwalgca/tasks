-- Row Level Security: a row is visible and writable only to the user it
-- belongs to. Single-user app, but the policies are what keep the anon key
-- safe to ship in the client.

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.lists enable row level security;
alter table public.tags enable row level security;
alter table public.tasks enable row level security;
alter table public.task_tags enable row level security;
alter table public.reminders enable row level security;
alter table public.sync_state enable row level security;

create policy profiles_own on public.profiles
  for all to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy clients_own on public.clients
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy lists_own on public.lists
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy tags_own on public.tags
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy tasks_own on public.tasks
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy task_tags_own on public.task_tags
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy reminders_own on public.reminders
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy sync_state_own on public.sync_state
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
