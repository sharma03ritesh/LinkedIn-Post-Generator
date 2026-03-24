import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Initialize Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 2. Enforce Authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("No authorization header provided.");

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Authentication required to create orders.");
    }

    const { amount, currency = "INR", receipt = "receipt_id" } = await req.json()

    // 3. Fetch credentials from the settings table
    const { data: key_id } = await supabaseClient.rpc('get_setting', { setting_id: 'razorpay_key_id' });
    const { data: key_secret } = await supabaseClient.rpc('get_setting', { setting_id: 'razorpay_key_secret' });

    if (!key_id || !key_secret) {
      throw new Error("Razorpay credentials are not configured in the system settings.")
    }

    const basicAuth = btoa(`${key_id}:${key_secret}`)

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${basicAuth}`
      },
      body: JSON.stringify({
        amount: amount * 100, // Amount in paise
        currency,
        receipt
      })
    })

    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error?.description || "Failed to create order")
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
