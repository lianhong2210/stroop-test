-- Fair-play tools for ranked runs.
--
--   runs.suspicion / runs.flags   how human each checked run looked (see
--                                 reviewRun in functions/_shared/stroop.ts)
--   runs.status = 'held'          a suspicious run that would reach the top of
--                                 the board waits here for your review
--   banned_players                players who may no longer play ranked runs
--   admin schema                  review queue and moderation functions, for
--                                 you in the SQL editor. Not reachable from
--                                 the website or the API.

-------------------------------------------------------------------------------
-- runs: review state
-------------------------------------------------------------------------------

alter table public.runs drop constraint runs_status_check;
alter table public.runs add constraint runs_status_check
  check (status in ('started', 'accepted', 'rejected', 'held'));

alter table public.runs
  add column suspicion int,
  add column flags text[] not null default '{}',
  add column reviewed_at timestamptz;

create index runs_held_idx on public.runs (finished_at) where status = 'held';

-------------------------------------------------------------------------------
-- banned_players (service role only)
-------------------------------------------------------------------------------

create table public.banned_players (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reason text not null default '',
  banned_at timestamptz not null default now()
);

alter table public.banned_players enable row level security;
revoke all on public.banned_players from anon, authenticated;

-------------------------------------------------------------------------------
-- would_place: does a run matter to the top of the board?
-------------------------------------------------------------------------------

-- True when the run would become the player's best AND fewer than p_top
-- other players are ahead of it. Same ordering as the leaderboard.
create function public.would_place(
  p_user uuid,
  p_mode text,
  p_score int,
  p_avg_rt_ms int,
  p_top int
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not exists (
      select 1 from public.best_scores b
      where b.user_id = p_user and b.mode = p_mode
        and (b.score > p_score or (b.score = p_score and b.avg_rt_ms <= p_avg_rt_ms))
    )
    and (
      select count(*) from public.best_scores b
      where b.mode = p_mode and b.user_id <> p_user
        and (b.score > p_score or (b.score = p_score and b.avg_rt_ms <= p_avg_rt_ms))
    ) < p_top;
$$;

revoke execute on function public.would_place(uuid, text, int, int, int) from public, anon, authenticated;
grant execute on function public.would_place(uuid, text, int, int, int) to service_role;

-------------------------------------------------------------------------------
-- admin schema: for you, in the dashboard's SQL editor
-------------------------------------------------------------------------------
-- The API only serves the public schema, and anon / authenticated get no
-- access here, so none of this can be called from the game.

create schema admin;
revoke all on schema admin from public, anon, authenticated;
alter default privileges in schema admin revoke execute on functions from public;

-- Runs waiting for a decision, oldest first.
create view admin.review_queue
with (security_invoker = true)
as
select
  r.id as run_id,
  p.username,
  r.mode,
  r.score,
  r.avg_rt_ms,
  r.suspicion,
  r.flags,
  r.finished_at,
  b.score as current_best_score,
  b.avg_rt_ms as current_best_avg_rt_ms
from public.runs r
join public.profiles p on p.id = r.user_id
left join public.best_scores b on b.user_id = r.user_id and b.mode = r.mode
where r.status = 'held'
order by r.finished_at;

-- Reaction-time spread of accepted runs per mode, to tune FAST_MEDIAN_MS
-- in stroop.ts against real players.
create view admin.mode_stats
with (security_invoker = true)
as
select
  mode,
  count(*) as runs,
  percentile_cont(0.05) within group (order by avg_rt_ms)::int as p5_avg_rt_ms,
  percentile_cont(0.25) within group (order by avg_rt_ms)::int as p25_avg_rt_ms,
  percentile_cont(0.50) within group (order by avg_rt_ms)::int as median_avg_rt_ms,
  round(100.0 * count(*) filter (where cardinality(flags) > 0) / count(*), 1) as pct_with_flags
from public.runs
where status = 'accepted' and score > 0
group by mode
order by mode;

revoke all on admin.review_queue, admin.mode_stats from public, anon, authenticated;

create function admin.user_id_for(p_username text)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  found uuid;
begin
  select id into found from public.profiles where lower(username) = lower(p_username);
  if found is null then
    raise exception 'no player named %', p_username;
  end if;
  return found;
end;
$$;

-- Let a held run onto the board.
create function admin.approve_run(p_run uuid)
returns text
language plpgsql
set search_path = ''
as $$
declare
  r public.runs;
  became_best boolean;
begin
  select * into r from public.runs where id = p_run and status = 'held' for update;
  if not found then
    raise exception 'no held run with id %', p_run;
  end if;
  if exists (select 1 from public.banned_players where user_id = r.user_id) then
    raise exception 'that player is banned; unban them first';
  end if;
  update public.runs set status = 'accepted', reviewed_at = now() where id = p_run;
  became_best := public.submit_best(r.user_id, r.mode, r.score, r.avg_rt_ms, r.id);
  return case
    when became_best then 'approved: now on the leaderboard'
    else 'approved: it did not beat that player''s best, so the board is unchanged'
  end;
end;
$$;

-- Keep a held run off the board.
create function admin.deny_run(p_run uuid, p_reason text default 'not approved on review')
returns text
language plpgsql
set search_path = ''
as $$
begin
  update public.runs
    set status = 'rejected', reject_reason = p_reason, reviewed_at = now()
    where id = p_run and status = 'held';
  if not found then
    raise exception 'no held run with id %', p_run;
  end if;
  return 'denied';
end;
$$;

-- Take a player's score off the board (one mode, or every mode when p_mode
-- is null). Their next accepted run can put them back.
create function admin.remove_score(p_username text, p_mode text default null)
returns text
language plpgsql
set search_path = ''
as $$
declare
  removed int;
begin
  delete from public.best_scores
    where user_id = admin.user_id_for(p_username)
      and (p_mode is null or mode = p_mode);
  get diagnostics removed = row_count;
  return format('removed %s score(s)', removed);
end;
$$;

-- Stop a player from playing ranked runs and clear them off the board.
-- They can still sign in and play unranked.
create function admin.ban(p_username text, p_reason text default '')
returns text
language plpgsql
set search_path = ''
as $$
declare
  target uuid := admin.user_id_for(p_username);
  removed int;
begin
  insert into public.banned_players (user_id, reason)
    values (target, p_reason)
    on conflict (user_id) do update set reason = excluded.reason, banned_at = now();
  delete from public.best_scores where user_id = target;
  get diagnostics removed = row_count;
  update public.runs
    set status = 'rejected', reject_reason = 'player banned', reviewed_at = now()
    where user_id = target and status in ('held', 'started');
  return format('banned; removed %s score(s)', removed);
end;
$$;

create function admin.unban(p_username text)
returns text
language plpgsql
set search_path = ''
as $$
begin
  delete from public.banned_players where user_id = admin.user_id_for(p_username);
  if not found then
    raise exception '% is not banned', p_username;
  end if;
  return 'unbanned (removed scores are not restored)';
end;
$$;
