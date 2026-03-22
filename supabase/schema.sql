-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Plans table
create table if not exists public.plans (
  id text primary key,
  name text not null,
  price integer,
  daily_limit integer not null
);

-- Profiles table
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  plan_id text references public.plans(id) default 'basic',
  usage_count integer default 0,
  last_usage_date date default CURRENT_DATE
);

-- Insert default plans
insert into public.plans (id, name, price, daily_limit) values
  ('basic', 'Basic (Free)', 0, 2),
  ('starter', 'Starter', 100, 5),
  ('advanced', 'Advanced', 399, 20),
  ('enterprise', 'Enterprise', null, 999999)
on conflict (id) do update set 
  name = excluded.name, 
  price = excluded.price, 
  daily_limit = excluded.daily_limit;

-- Function to handle new users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

-- Trigger for new users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RPC Function to safely check and increment content usage
create or replace function public.increment_usage()
returns json
language plpgsql
security definer
as $$
declare
  user_profile record;
  user_plan record;
  today date := CURRENT_DATE;
begin
  select * into user_profile from public.profiles where id = auth.uid();
  if not found then
    return json_build_object('success', false, 'error', 'Profile not found');
  end if;

  select * into user_plan from public.plans where id = user_profile.plan_id;

  if user_profile.last_usage_date != today then
    update public.profiles 
    set usage_count = 0, last_usage_date = today 
    where id = auth.uid();
    
    user_profile.usage_count := 0;
    user_profile.last_usage_date := today;
  end if;

  if user_profile.usage_count >= user_plan.daily_limit then
    return json_build_object('success', false, 'error', 'Daily limit reached', 'limit', user_plan.daily_limit);
  end if;

  update public.profiles 
  set usage_count = usage_count + 1 
  where id = auth.uid();

  return json_build_object('success', true, 'usage_count', user_profile.usage_count + 1, 'limit', user_plan.daily_limit);
end;
$$;

-- Row Level Security (RLS) policies
alter table public.profiles enable row level security;
alter table public.plans enable row level security;

-- Profiles: Users can read their own profile
create policy "Users can read own profile" on public.profiles
  for select using (auth.uid() = id);

-- Plans: Everyone can read plans
create policy "Everyone can read plans" on public.plans
  for select using (true);
