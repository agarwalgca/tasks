-- Publish the synced tables so a change on one device lands on the other
-- within seconds. Soft deletes travel as UPDATEs, so the default replica
-- identity (primary key) is enough.

alter publication supabase_realtime add table public.clients;
alter publication supabase_realtime add table public.lists;
alter publication supabase_realtime add table public.tags;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.task_tags;
alter publication supabase_realtime add table public.reminders;
