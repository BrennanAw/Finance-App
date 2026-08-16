-- Run this once in your Supabase project's SQL editor (Database > SQL Editor).
-- It creates one row per user holding their entire app state as JSON, and
-- locks it down so users can only ever read/write their own row.

create table if not exists app_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table app_data enable row level security;

create policy "Users can view own data"
  on app_data for select
  using (auth.uid() = user_id);

create policy "Users can insert own data"
  on app_data for insert
  with check (auth.uid() = user_id);

create policy "Users can update own data"
  on app_data for update
  using (auth.uid() = user_id);
