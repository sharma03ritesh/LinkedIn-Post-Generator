-- 1. Add is_admin flag for easy frontend UI checks
alter table public.profiles add column if not exists is_admin boolean default false;

-- 2. Create an RPC to safely pull all users (Bypasses RLS strictly for admins)
drop function if exists public.admin_get_all_users() cascade;
create or replace function public.admin_get_all_users()
returns table (
  id uuid,
  full_name text,
  email text,
  plan_id text,
  usage_count integer,
  last_usage_date date,
  is_admin boolean,
  plan_name text
)
language plpgsql
security definer
as $$
begin
  -- Enforce strictly that only admins can invoke this
  if not exists (select 1 from public.profiles p2 where p2.id = auth.uid() and p2.is_admin = true) then
    raise exception 'Unauthorized Server Request: Only admins can view all users';
  end if;

  return query
  select 
    p.id, 
    p.full_name, 
    p.email, 
    p.plan_id, 
    p.usage_count, 
    cast(p.last_usage_date as date), 
    p.is_admin, 
    pl.name as plan_name
  from public.profiles p
  left join public.plans pl on p.plan_id = pl.id
  order by p.last_usage_date desc;
end;
$$;

-- 3. Create an RPC to safely edit any user's subscription
create or replace function public.admin_update_user_plan(target_user_id uuid, new_plan_id text)
returns json
language plpgsql 
security definer
as $$
begin
  if not exists (select 1 from public.profiles p2 where p2.id = auth.uid() and p2.is_admin = true) then
    raise exception 'Unauthorized Server Request';
  end if;

  update public.profiles 
  set plan_id = new_plan_id 
  where id = target_user_id;

  return json_build_object('success', true);
end;
$$;


-- 4. RPC to get pending UPI transactions
create or replace function public.admin_get_pending_transactions()
returns table (
  id uuid,
  user_id uuid,
  full_name text,
  email text,
  plan_id text,
  amount integer,
  reference_id text,
  created_at timestamp with time zone,
  plan_name text
)
language plpgsql security definer
as $$
begin
  if not exists (select 1 from public.profiles p2 where p2.id = auth.uid() and p2.is_admin = true) then
    raise exception 'Unauthorized';
  end if;

  return query
  select 
    t.id as transaction_id, 
    p.id as user_id,
    p.full_name, 
    p.email, 
    t.plan_id, 
    t.amount, 
    t.reference_id, 
    t.created_at,
    pl.name as plan_name
  from public.transactions t
  join public.profiles p on t.user_id = p.id
  join public.plans pl on t.plan_id = pl.id
  where t.status = 'pending'
  order by t.created_at asc;
end;
$$;


-- 5. RPC to resolve pending UPI transactions
create or replace function public.admin_resolve_transaction(tx_id uuid, resolution_status text)
returns json
language plpgsql security definer
as $$
declare
  tx record;
begin
  if not exists (select 1 from public.profiles p2 where p2.id = auth.uid() and p2.is_admin = true) then
    raise exception 'Unauthorized';
  end if;

  select * into tx from public.transactions where id = tx_id and status = 'pending';
  if not found then
    raise exception 'Pending transaction not found';
  end if;

  -- Update transaction
  update public.transactions 
  set status = resolution_status 
  where id = tx_id;

  -- If approved, update user's profile plan
  if resolution_status = 'completed' then
    update public.profiles
    set plan_id = tx.plan_id
    where id = tx.user_id;
  end if;

  return json_build_object('success', true);
end;
$$;
