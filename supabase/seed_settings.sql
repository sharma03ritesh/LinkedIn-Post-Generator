-- Seed initial settings
insert into public.settings (id, value, category, is_public, description)
values 
  ('gemini_api_key', 'your_gemini_key_here', 'API Keys', false, 'Google Gemini API Key for content generation'),
  ('site_url', 'http://localhost:5173', 'general', true, 'The public URL of your application (used for Magic Links and Resets)'),
  ('razorpay_key_id', 'your_razorpay_key_id_here', 'Payment', true, 'Razorpay Public Key ID for frontend checkout'),
  ('razorpay_key_secret', 'your_razorpay_secret_here', 'Payment', false, 'Razorpay Secret Key for server-side order creation')
on conflict (id) do update set 
  category = excluded.category,
  is_public = excluded.is_public,
  description = excluded.description;
