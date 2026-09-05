-- Personal task manager: full schema, including columns for later phases.
-- Every synced table carries a client-generated uuid pk, updated_at maintained
-- by a trigger, and a nullable deleted_at. Nothing is hard-deleted.

create extension if not exists pgcrypto;

create type public.task_status as enum ('todo', 'doing', 'done', 'cancelled');
create type public.recurrence_anchor as enum ('due_date', 'completion_date');
create type public.task_source as enum ('manual', 'recurrence');
create type public.reminder_channel as enum ('push', 'email');

-- Maintains updated_at and enforces last-write-wins at the row level.
-- Clients stamp updated_at with the time of their own (possibly offline) edit;
-- a write carrying a timestamp older than the stored row is ignored rather
-- than applied, so a stale device cannot clobber a newer change.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  if tg_op = 'INSERT' then
    new.updated_at := coalesce(new.updated_at, now());
    return new;
  end if;

  if new.updated_at is null then
    new.updated_at := now();
  elsif new.updated_at < old.updated_at then
    return old;
  end if;

  return new;
end;
$fn$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.clients (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.lists (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text,
  icon text,
  parent_list_id uuid references public.lists (id) on delete set null,
  sort_order double precision not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.tags (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.tasks (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  list_id uuid references public.lists (id) on delete set null,
  parent_task_id uuid references public.tasks (id) on delete set null,
  title text not null,
  notes text,
  status public.task_status not null default 'todo',
  priority smallint not null default 0 check (priority between 0 and 3),
  due_date date,
  due_time time,
  start_date date,
  estimate_minutes integer check (estimate_minutes is null or estimate_minutes >= 0),
  completed_at timestamptz,
  sort_order double precision not null default 0,
  rrule text,
  recurrence_anchor public.recurrence_anchor,
  recurrence_series_id uuid,
  client_id uuid references public.clients (id) on delete set null,
  source public.task_source not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- (task_id, tag_id) is the logical key; the uuid pk and soft-delete columns
-- exist so join rows sync through the same last-write-wins path as everything
-- else.
create table public.task_tags (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.reminders (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  offset_minutes integer,
  absolute_at timestamptz,
  channel public.reminder_channel not null default 'push',
  fired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint reminders_when_check
    check (offset_minutes is not null or absolute_at is not null)
);

-- Per-device sync watermark. Device metadata rather than user content, so it
-- is the one table without a soft-delete column.
create table public.sync_state (
  device_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  last_pulled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The pull query is "everything of mine changed since the watermark".
create index profiles_updated_at_idx on public.profiles (updated_at);
create index clients_user_updated_idx on public.clients (user_id, updated_at);
create index lists_user_updated_idx on public.lists (user_id, updated_at);
create index tags_user_updated_idx on public.tags (user_id, updated_at);
create index tasks_user_updated_idx on public.tasks (user_id, updated_at);
create index task_tags_user_updated_idx on public.task_tags (user_id, updated_at);
create index reminders_user_updated_idx on public.reminders (user_id, updated_at);

create index lists_parent_idx on public.lists (parent_list_id) where deleted_at is null;
create index tasks_list_idx on public.tasks (user_id, list_id) where deleted_at is null;
create index tasks_parent_idx on public.tasks (parent_task_id) where deleted_at is null;
create index tasks_due_idx on public.tasks (user_id, due_date) where deleted_at is null;
create index tasks_status_idx on public.tasks (user_id, status) where deleted_at is null;
create index task_tags_task_idx on public.task_tags (task_id) where deleted_at is null;
create index task_tags_tag_idx on public.task_tags (tag_id) where deleted_at is null;
create index reminders_task_idx on public.reminders (task_id) where deleted_at is null;

create unique index tags_user_name_key
  on public.tags (user_id, lower(name)) where deleted_at is null;
create unique index task_tags_pair_key
  on public.task_tags (task_id, tag_id) where deleted_at is null;

create trigger profiles_updated_at before insert or update on public.profiles
  for each row execute function public.set_updated_at();
create trigger clients_updated_at before insert or update on public.clients
  for each row execute function public.set_updated_at();
create trigger lists_updated_at before insert or update on public.lists
  for each row execute function public.set_updated_at();
create trigger tags_updated_at before insert or update on public.tags
  for each row execute function public.set_updated_at();
create trigger tasks_updated_at before insert or update on public.tasks
  for each row execute function public.set_updated_at();
create trigger task_tags_updated_at before insert or update on public.task_tags
  for each row execute function public.set_updated_at();
create trigger reminders_updated_at before insert or update on public.reminders
  for each row execute function public.set_updated_at();
create trigger sync_state_updated_at before insert or update on public.sync_state
  for each row execute function public.set_updated_at();
