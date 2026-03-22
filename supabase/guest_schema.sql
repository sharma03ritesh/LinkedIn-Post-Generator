-- Create table for tracking guest usage
create table if not exists public.guest_usage (
  id uuid default uuid_generate_v4() primary key,
  ip_address text not null,
  fingerprint text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RPC Function to check and mark guest usage securely
create or replace function public.check_and_mark_guest_usage(device_fingerprint text)
returns json
language plpgsql
security definer
as $$
declare
  client_ip text;
  existing_usage record;
begin
  -- Supabase stores request headers in a local setting during the API call
  -- We extract the x-forwarded-for header which contains the real client IP
  begin
    client_ip := current_setting('request.headers', true)::json->>'x-forwarded-for';
  exception when others then
    client_ip := 'unknown';
  end;
  
  -- Clean up the IP string (x-forwarded-for can be a comma-separated list)
  if client_ip is not null then
    client_ip := trim(split_part(client_ip, ',', 1));
  else
    client_ip := 'unknown';
  end if;

  -- Check if this IP or Device Fingerprint has ALREADY used their free chance
  select * into existing_usage from public.guest_usage 
  where ip_address = client_ip or fingerprint = device_fingerprint
  limit 1;

  if found then
    return json_build_object(
      'success', false, 
      'error', 'Free guest usage already exhausted for your device or network. Please log in to continue.'
    );
  end if;

  -- If not found, log this new usage
  insert into public.guest_usage (ip_address, fingerprint)
  values (client_ip, device_fingerprint);

  return json_build_object('success', true);
end;
$$;

-- Enable RLS and prevent direct access (only the RPC function can read/write)
alter table public.guest_usage enable row level security;
