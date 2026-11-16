-- Account progress: unlocked modes and personal bests, so they follow the
-- player to other devices.
--
-- This is the same data the game keeps in the browser, so players may write
-- their own row. It never feeds the leaderboard: that only takes runs the
-- server has replayed and checked (best_scores).

create table public.progress (
  user_id uuid primary key default auth.uid()
    references auth.users (id) on delete cascade,
  -- Modes whose pass mark has been reached.
  cleared text[] not null default '{}'
    check (cleared <@ array['easy', 'normal', 'hard', 'overload']::text[]),
  -- Personal best correct-answer count per mode, e.g. {"easy": 9}.
  best jsonb not null default '{}'::jsonb
    check (jsonb_typeof(best) = 'object' and pg_column_size(best) < 1024),
  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;

create policy "Players read their own progress"
  on public.progress for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Players create their own progress"
  on public.progress for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Players update their own progress"
  on public.progress for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.progress from anon, authenticated;
grant select, insert, update on public.progress to authenticated;
