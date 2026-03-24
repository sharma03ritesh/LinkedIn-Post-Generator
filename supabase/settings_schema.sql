-- Settings table for global application configurations
create table if not exists public.settings (
  id text primary key,
  value text not null,
  category text default 'general',
  is_public boolean default false,
  description text,
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.settings enable row level security;

-- Allow Public to View marked public settings
create policy "Public settings access" 
  on public.settings 
  for select 
  using (is_public = true);

-- Only Allow Admins to View/Edit all Settings
create policy "Admin only settings access" 
  on public.settings 
  for all 
  using (
    exists (
      select 1 from public.profiles 
      where id = auth.uid() and is_admin = true
    )
  );

-- Function to safely fetch a setting (Bypasses RLS strictly for internal/edge use)
create or replace function public.get_setting(setting_id text)
returns text
language plpgsql
security definer
as $$
declare
  setting_val text;
begin
  select value into setting_val from public.settings where id = setting_id;
  return setting_val;
end;
$$;
