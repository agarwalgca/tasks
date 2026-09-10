-- Web push delivery for reminders. The `reminders` rows already exist; this
-- adds somewhere to keep the browser's push subscription, and one function that
-- works out which reminders are due.

create table public.push_subscriptions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id uuid,
  label text,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index push_subscriptions_endpoint_key
  on public.push_subscriptions (endpoint) where deleted_at is null;
create index push_subscriptions_user_idx
  on public.push_subscriptions (user_id) where deleted_at is null;

create trigger push_subscriptions_updated_at
  before insert or update on public.push_subscriptions
  for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_own on public.push_subscriptions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- When a reminder should fire. A task's due_date and due_time are Asia/Kolkata
-- wall-clock values, so they are converted here rather than in the client; a
-- reminder with no time of its own is treated as 09:00 on the due day.
create or replace function public.reminder_fire_at(
  absolute_at timestamptz,
  offset_minutes integer,
  due_date date,
  due_time time
)
returns timestamptz
language sql
immutable
as $fn$
  select coalesce(
    absolute_at,
    case
      when due_date is null then null
      else ((due_date + coalesce(due_time, time '09:00')) at time zone 'Asia/Kolkata')
             - make_interval(mins => coalesce(offset_minutes, 0))
    end
  );
$fn$;

-- Reminders that are due and have not been sent. The one-day floor stops a
-- backlog firing all at once after the sender has been down.
create or replace function public.due_reminders()
returns table (
  reminder_id uuid,
  user_id uuid,
  task_id uuid,
  title text,
  channel public.reminder_channel,
  fire_at timestamptz
)
language sql
stable
as $fn$
  select
    r.id,
    r.user_id,
    r.task_id,
    t.title,
    r.channel,
    public.reminder_fire_at(r.absolute_at, r.offset_minutes, t.due_date, t.due_time)
  from public.reminders r
  join public.tasks t on t.id = r.task_id
  where r.deleted_at is null
    and t.deleted_at is null
    and r.fired_at is null
    and t.status in ('todo', 'doing')
    and public.reminder_fire_at(r.absolute_at, r.offset_minutes, t.due_date, t.due_time)
        between now() - interval '1 day' and now();
$fn$;

create index reminders_unfired_idx
  on public.reminders (user_id) where deleted_at is null and fired_at is null;

alter publication supabase_realtime add table public.push_subscriptions;
