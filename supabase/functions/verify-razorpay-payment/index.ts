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
      throw new Error("Authentication required to verify payments.");
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json()

    // 3. Fetch Secret from Database
    const { data: key_secret } = await supabaseClient.rpc('get_setting', { setting_id: 'razorpay_key_secret' });

    if (!key_secret) {
      throw new Error("Razorpay secret not configured in database.");
    }

    const encoder = new TextEncoder()
    const data = encoder.encode(razorpay_order_id + "|" + razorpay_payment_id)
    const secret = encoder.encode(key_secret)

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      secret,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    )

    const signature = await crypto.subtle.sign("HMAC", cryptoKey, data)
    const generated_signature = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")

    if (generated_signature !== razorpay_signature) {
      throw new Error("Invalid payment signature")
    }

    return new Response(JSON.stringify({ status: "success" }), {
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
