-- Create transactions tracking table
create table if not exists public.transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  plan_id text references public.plans(id) not null,
  amount integer not null,
  reference_id text not null, -- UTR or Stripe Session ID
  payment_method text not null, -- 'upi' or 'stripe'
  status text default 'completed' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for severe security
alter table public.transactions enable row level security;

-- Users can securely view their own transactions history
create policy "Users can view their own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

-- Securely allow insertion from authenticated users claiming their own ID
create policy "Users can insert their own transactions"
  on public.transactions for insert
  with check (auth.uid() = user_id);
