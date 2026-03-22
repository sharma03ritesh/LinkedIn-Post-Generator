-- Create the table for tracking generated posts
create table public.generated_posts (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users not null,
    topic text not null,
    post_type text,
    tone text,
    length text,
    hook text,
    body text,
    cta text,
    hashtags text[],
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Turn on Row Level Security
alter table public.generated_posts enable row level security;

-- Policies so users can only CRUD their own posts
create policy "Users can insert their own posts."
    on public.generated_posts for insert
    with check ( auth.uid() = user_id );

create policy "Users can view their own posts."
    on public.generated_posts for select
    using ( auth.uid() = user_id );

create policy "Users can delete their own posts."
    on public.generated_posts for delete
    using ( auth.uid() = user_id );
