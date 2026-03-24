-- 1. Create the table if it doesn't exist
create table if not exists public.settings (
  id text primary key,
  value text not null,
  category text default 'general',
  is_public boolean default false,
  description text,
  updated_at timestamp with time zone default now()
);

-- 2. Add is_public column if it's missing (in case table was created with an old schema)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'settings' and column_name = 'is_public') then
    alter table public.settings add column is_public boolean default false;
  end if;
end $$;

-- 3. Enable RLS and setup policies
alter table public.settings enable row level security;

drop policy if exists "Public settings access" on public.settings;
create policy "Public settings access" 
  on public.settings 
  for select 
  using (is_public = true);

drop policy if exists "Admin only settings access" on public.settings;
create policy "Admin only settings access" 
  on public.settings 
  for all 
  using (
    exists (
      select 1 from public.profiles 
      where id = auth.uid() and is_admin = true
    )
  );

-- 4. Utility function for Edge Functions
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

-- 5. Seed initial data
insert into public.settings (id, value, category, is_public, description)
values 
  ('gemini_api_key', 'your_gemini_key_here', 'API Keys', false, 'Google Gemini API Key for content generation'),
  ('razorpay_key_id', 'your_razorpay_key_id_here', 'Payment', true, 'Razorpay Public Key ID for frontend checkout'),
  ('razorpay_key_secret', 'your_razorpay_secret_here', 'Payment', false, 'Razorpay Secret Key for server-side order creation'),
  ('smtp_host', 'smtp.resend.com', 'Email', false, 'SMTP Server hostname'),
  ('smtp_port', '465', 'Email', false, 'SMTP Server port'),
  ('smtp_user', 'resend', 'Email', false, 'SMTP Server username'),
  ('smtp_password', 'your_smtp_password_here', 'Email', false, 'SMTP Server password'),
  ('smtp_sender_name', 'LinkedIn Post Generator', 'Email', false, 'Name displayed as sender in emails'),
  ('supabase_url', 'https://your-project.supabase.co', 'Supabase', true, 'Your Supabase Project URL (Public)'),
  ('supabase_anon_key', 'your-anon-key', 'Supabase', true, 'Your Supabase Anon/Public Key')
on conflict (id) do update set 
  category = excluded.category,
  is_public = excluded.is_public,
  description = excluded.description;
