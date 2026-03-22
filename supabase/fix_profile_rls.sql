-- Allow users to update their own profiles (required for client-side upgrades)
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);
