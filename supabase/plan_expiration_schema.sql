-- Step 1: Add plan expiration timestamp securely to profiles table
alter table public.profiles 
add column if not exists plan_expires_at timestamp with time zone;

-- Step 2: Override the usage tracking function to forcefully handle downgrades mathematically
create or replace function public.increment_usage()
returns json
language plpgsql
security definer
as $$
declare
  user_profile record;
  user_plan record;
  today date := CURRENT_DATE;
  was_downgraded boolean := false;
begin
  -- Fetch secure user state
  select * into user_profile from public.profiles where id = auth.uid();
  if not found then
    return json_build_object('success', false, 'error', 'Profile not found');
  end if;

  -- CORE DOWNGRADE LOGIC: Check if the subscription fundamentally expired
  if user_profile.plan_id != 'basic' and user_profile.plan_expires_at is not null and user_profile.plan_expires_at < now() then
    
    -- Securely strip permissions and downgrade to free layer
    update public.profiles
    set plan_id = 'basic', plan_expires_at = null
    where id = auth.uid();
    
    -- Sync local variables for limit checking this request
    user_profile.plan_id := 'basic';
    user_profile.plan_expires_at := null;
    was_downgraded := true;
  end if;

  -- Check new constraints
  select * into user_plan from public.plans where id = user_profile.plan_id;

  -- Flush daily counter if it's technically a new UTC day
  if user_profile.last_usage_date != today then
    update public.profiles 
    set usage_count = 0, last_usage_date = today 
    where id = auth.uid();
    
    user_profile.usage_count := 0;
    user_profile.last_usage_date := today;
  end if;

  -- Lockout Evaluation
  if user_profile.usage_count >= user_plan.daily_limit then
    if was_downgraded then
       return json_build_object('success', false, 'error', 'Your Premium Plan has expired! You have been switched to Basic. Please upgrade to continue generating.');
    end if;
    return json_build_object('success', false, 'error', 'Daily limit reached', 'limit', user_plan.daily_limit);
  end if;

  -- Safely approve transaction
  update public.profiles 
  set usage_count = usage_count + 1 
  where id = auth.uid();

  return json_build_object('success', true, 'usage_count', user_profile.usage_count + 1, 'limit', user_plan.daily_limit);
end;
$$;
