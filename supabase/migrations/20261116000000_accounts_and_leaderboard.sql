-- Accounts and leaderboard for Stroop.
--
--   profiles      one row per signed-in player: the public username
--   runs          every ranked run: issued by start-run, checked by finish-run
--   best_scores   each player's best checked run per mode
--
-- Players never write runs or scores directly. The start-run and finish-run
-- Edge Functions do that with the service role after checking Turnstile and
-- replaying the run from its seed. Players can only read the leaderboard (via
-- functions below) and edit their own username.

-------------------------------------------------------------------------------
-- profiles
-------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now(),
  username_changed_at timestamptz,
  constraint profiles_username_format check (username ~ '^[A-Za-z0-9_-]{3,16}$')
);

-- Unique regardless of case: "Ghost" and "ghost" can't both exist.
create unique index profiles_username_lower_key on public.profiles (lower(username));

alter table public.profiles enable row level security;

create policy "Usernames are public"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "Players edit their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Only the username column may be changed by players.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (username) on public.profiles to authenticated;

create function public.touch_username_changed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.username is distinct from old.username then
    new.username_changed_at := now();
  end if;
  return new;
end;
$$;

create trigger profiles_touch_username
  before update on public.profiles
  for each row execute function public.touch_username_changed_at();

-- New account → profile with a random public name. Never the Google name:
-- the leaderboard is public.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt int := 0;
begin
  loop
    begin
      insert into public.profiles (id, username)
      values (new.id, 'Subject-' || lpad(floor(random() * 100000)::int::text, 5, '0'));
      exit;
    exception when unique_violation then
      attempt := attempt + 1;
      if attempt >= 25 then
        raise;
      end if;
    end;
  end loop;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Players who signed in before this migration ran get a profile too.
do $$
declare
  u record;
  attempt int;
begin
  for u in
    select a.id from auth.users a
    where not exists (select 1 from public.profiles p where p.id = a.id)
  loop
    attempt := 0;
    loop
      begin
        insert into public.profiles (id, username)
        values (u.id, 'Subject-' || lpad(floor(random() * 100000)::int::text, 5, '0'));
        exit;
      exception when unique_violation then
        attempt := attempt + 1;
        if attempt >= 25 then
          raise;
        end if;
      end;
    end loop;
  end loop;
end;
$$;

-------------------------------------------------------------------------------
-- runs (service role only)
-------------------------------------------------------------------------------

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null check (mode in ('easy', 'normal', 'hard', 'overload')),
  seed bigint not null check (seed between 0 and 4294967295),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'started'
    check (status in ('started', 'accepted', 'rejected')),
  score int,
  avg_rt_ms int,
  answers jsonb,
  reject_reason text
);

create index runs_user_started_idx on public.runs (user_id, started_at desc);

-- RLS on with no policies: only the service role (Edge Functions) can touch it.
alter table public.runs enable row level security;
revoke all on public.runs from anon, authenticated;

-------------------------------------------------------------------------------
-- best_scores (read through functions, written by the service role)
-------------------------------------------------------------------------------

create table public.best_scores (
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null check (mode in ('easy', 'normal', 'hard', 'overload')),
  score int not null check (score > 0),
  avg_rt_ms int not null check (avg_rt_ms >= 0),
  run_id uuid not null references public.runs (id) on delete cascade,
  achieved_at timestamptz not null default now(),
  primary key (user_id, mode)
);

-- Leaderboard order: higher score, then faster average, then whoever got there first.
create index best_scores_rank_idx
  on public.best_scores (mode, score desc, avg_rt_ms asc, achieved_at asc);

alter table public.best_scores enable row level security;
revoke all on public.best_scores from anon, authenticated;

-------------------------------------------------------------------------------
-- functions
-------------------------------------------------------------------------------

-- A player's position in a mode (1 = top), or null if they have no score.
create function public.player_rank(p_user uuid, p_mode text)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select r.rank
  from (
    select
      b.user_id,
      row_number() over (
        order by b.score desc, b.avg_rt_ms asc, b.achieved_at asc
      )::int as rank
    from public.best_scores b
    where b.mode = p_mode
  ) r
  where r.user_id = p_user;
$$;

-- Top N for a mode, plus the caller's own row if they're signed in and
-- outside the top N. Exposes only usernames and scores.
create function public.get_leaderboard(p_mode text, p_limit int default 5)
returns table (
  rank int,
  username text,
  score int,
  avg_rt_ms int,
  is_me boolean,
  total int
)
language sql
stable
security definer
set search_path = ''
as $$
  with ranked as (
    select
      row_number() over (
        order by b.score desc, b.avg_rt_ms asc, b.achieved_at asc
      )::int as rank,
      p.username,
      b.score,
      b.avg_rt_ms,
      b.user_id = auth.uid() as is_me,
      count(*) over ()::int as total
    from public.best_scores b
    join public.profiles p on p.id = b.user_id
    where b.mode = p_mode
  )
  select rank, username, score, avg_rt_ms, is_me, total
  from ranked
  where rank <= least(greatest(p_limit, 1), 50) or is_me
  order by rank;
$$;

-- Save a checked run as the player's best if it beats their current best.
-- Returns true when it became the new best.
create function public.submit_best(
  p_user uuid,
  p_mode text,
  p_score int,
  p_avg_rt_ms int,
  p_run uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed int;
begin
  insert into public.best_scores (user_id, mode, score, avg_rt_ms, run_id)
  values (p_user, p_mode, p_score, p_avg_rt_ms, p_run)
  on conflict (user_id, mode) do update
    set score = excluded.score,
        avg_rt_ms = excluded.avg_rt_ms,
        run_id = excluded.run_id,
        achieved_at = now()
    where excluded.score > public.best_scores.score
       or (excluded.score = public.best_scores.score
           and excluded.avg_rt_ms < public.best_scores.avg_rt_ms);
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

-- Players delete their own account. Profile, runs and scores go with it
-- (on delete cascade).
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- Functions are executable by everyone by default. Lock each one down to
-- exactly who needs it.
revoke execute on function public.player_rank(uuid, text) from public, anon, authenticated;
revoke execute on function public.submit_best(uuid, text, int, int, uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_username_changed_at() from public, anon, authenticated;
revoke execute on function public.get_leaderboard(text, int) from public;
revoke execute on function public.delete_my_account() from public, anon;

grant execute on function public.player_rank(uuid, text) to service_role;
grant execute on function public.submit_best(uuid, text, int, int, uuid) to service_role;
grant execute on function public.get_leaderboard(text, int) to anon, authenticated, service_role;
grant execute on function public.delete_my_account() to authenticated;
