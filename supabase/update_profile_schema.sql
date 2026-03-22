-- Safely add full_name and email columns without dropping existing data
alter table public.profiles 
add column if not exists full_name text,
add column if not exists email text;

-- Update the existing trigger function to explicitly extract these details
-- Supabase stores custom `options.data` from the frontend directly inside 'raw_user_meta_data'
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email
  );
  return new;
end;
$$;

-- Note: Because this updates the trigger, any future signups will now automatically populate their full_name in your customized profiles table!
