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
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json()

    // Connect to Supabase to fetch setting
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Fetch the Razorpay Secret Key using the database function
    const { data: key_secret, error: settingError } = await supabaseClient.rpc('get_setting', {
      setting_id: 'razorpay_key_secret'
    });

    if (settingError || !key_secret) {
        console.error("Database fetch error:", settingError);
        throw new Error("Razorpay Secret is missing in the system settings")
    }

    // Create HMAC SHA256 Signature
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(key_secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    )

    const data = encoder.encode(razorpay_order_id + "|" + razorpay_payment_id)
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, data)
    
    // Convert ArrayBuffer to Hex String manually
    const signatureArray = Array.from(new Uint8Array(signatureBuffer))
    const generated_signature = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('')

    if (generated_signature !== razorpay_signature) {
      throw new Error("Invalid payment signature. Payment verification failed.")
    }

    return new Response(JSON.stringify({ verified: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ verified: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

