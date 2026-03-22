import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { amount, currency = "INR", receipt = "receipt_id" } = await req.json()

    // Retrieve the secret directly from the function's environment variables
    const key_id = Deno.env.get("RAZORPAY_KEY_ID") || ""
    const key_secret = Deno.env.get("RAZORPAY_KEY_SECRET") || ""

    if (!key_id || !key_secret) {
      throw new Error("Razorpay credentials are not configured on the server.")
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
