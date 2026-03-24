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

    // 2. Get User Identity (Enforce Authentication)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("No authorization header provided.");

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth error:", authError);
      throw new Error("Authentication required to generate posts.");
    }

    // 3. Check Usage & Plan Limits
    // Hardcoded limits based on plan_id (matches Home.jsx logic)
    const PLAN_LIMITS = {
      'basic': 10,
      'starter': 50,
      'advanced': 200,
      'enterprise': 1000
    };

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('usage_count, plan_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error("Profile fetch error:", profileError);
      throw new Error("Could not verify your account status.");
    }

    const currentUsage = profile.usage_count || 0;
    const maxUsage = PLAN_LIMITS[profile.plan_id] || 1; // Default 1 for safety

    if (currentUsage >= maxUsage) {
      throw new Error(`Usage limit reached for your ${profile.plan_id} plan (${currentUsage}/${maxUsage}). Please upgrade to generate more.`);
    }

    // 4. Fetch the Gemini API Key from secure settings
    const { data: apiKey, error: settingError } = await supabaseClient.rpc('get_setting', {
      setting_id: 'gemini_api_key'
    });

    if (settingError || !apiKey) {
      throw new Error("AI service is currently unavailable. Please contact support.");
    }

    // 5. Build Prompt and call Gemini
    const { topic, postType, tone, length } = await req.json();
    if (!topic) throw new Error("Topic is required");

    const prompt = `You are a LinkedIn content expert. Create a compelling LinkedIn post about "${topic}".
Structure your response as a JSON object with: hook, body, cta, hashtags.
Post type: ${postType || 'educational'}, Tone: ${tone || 'professional'}, Length: ${length || 'medium'}`;

    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!geminiResponse.ok) throw new Error("AI Generation failed.");

    const data = await geminiResponse.json();
    const generatedText = data.candidates[0].content.parts[0].text;
    
    // Simple JSON cleanup (common for LLMs)
    let cleanedText = generatedText.trim();
    if (cleanedText.includes("```json")) {
       cleanedText = cleanedText.split("```json")[1].split("```")[0].trim();
    } else if (cleanedText.includes("```")) {
       cleanedText = cleanedText.split("```")[1].split("```")[0].trim();
    }

    const parsedPost = JSON.parse(cleanedText);

    // 6. INCREMENT USAGE SECURELY (Success path)
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({ usage_count: currentUsage + 1, last_usage_date: new Date().toISOString() })
      .eq('id', user.id);

    if (updateError) {
      console.error("Usage update failed:", updateError);
      // We still return the post, but log the error
    }

    return new Response(JSON.stringify(parsedPost), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

