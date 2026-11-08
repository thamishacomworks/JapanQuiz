-- Run this once in the Supabase SQL editor.
-- It stores one best score per person for each quiz level.

create table if not exists public.level_scores (
  user_id uuid not null references auth.users (id) on delete cascade,
  quiz_key text not null,
  level_id integer not null check (level_id > 0),
  player_name text not null,
  score integer not null check (score >= 0 and score <= 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, quiz_key, level_id)
);

alter table public.level_scores enable row level security;

grant select on table public.level_scores to anon, authenticated;
grant insert, update on table public.level_scores to authenticated;

drop policy if exists "Anyone can read high scores" on public.level_scores;
create policy "Anyone can read high scores"
  on public.level_scores
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Players insert their own score" on public.level_scores;
create policy "Players insert their own score"
  on public.level_scores
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Players update their own score" on public.level_scores;
create policy "Players update their own score"
  on public.level_scores
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
