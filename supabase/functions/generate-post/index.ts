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
    const { topic, postType, tone, length } = await req.json()

    if (!topic) {
       throw new Error("Topic is required");
    }

    // Connect to Supabase to fetch API Key from settings table
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Fetch the Gemini API Key using the RPC function we created in SQL
    const { data: apiKey, error: settingError } = await supabaseClient.rpc('get_setting', {
      setting_id: 'gemini_api_key'
    });

    if (settingError || !apiKey) {
      console.error("Database fetch error:", settingError);
      throw new Error("Gemini API key not found in system settings.");
    }

    const prompt = `You are a LinkedIn content expert. Create a compelling LinkedIn post about "${topic}".

Requirements:
- Post type: ${postType || 'educational'}
- Tone: ${tone || 'professional'}
- Length: ${length || 'medium'}

Structure your response as a JSON object with these exact fields:
{
  "hook": "An attention-grabbing opening line (1-2 sentences)",
  "body": "Main content with insights, examples, or storytelling. Use line breaks for readability. Keep it engaging and valuable.",
  "cta": "A call-to-action that invites engagement (e.g., 'What's your take?', 'Share your experience below')",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"]
}

Guidelines:
- Make the hook compelling and scroll-stopping
- Include specific insights or actionable advice in the body
- Use line breaks and formatting for readability
- End with an engaging question or call-to-action
- Include 3-5 relevant, non-spammy hashtags
- Match the specified tone and post type
- Keep within the specified length range

Generate only the JSON response, no additional text.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Gemini API error:", errorData);
      throw new Error("Failed to generate content from Gemini API");
    }

    const data = await response.json();
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      console.error("Unexpected Gemini API response structure:", data);
      throw new Error("Invalid response from Gemini API");
    }

    const generatedText = data.candidates[0].content.parts[0].text;
    
    // Attempt to clean the text to ensure valid JSON
    let cleanedText = generatedText.trim();
    if (cleanedText.startsWith("```json")) {
        cleanedText = cleanedText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    // Try a second level of extraction in case of surrounding text
    const jsonStart = cleanedText.indexOf("{");
    const jsonEnd = cleanedText.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        cleanedText = cleanedText.substring(jsonStart, jsonEnd + 1);
    }
    
    // Minimal JSON sanitization for weird characters
    cleanedText = cleanedText
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
        .replace(/(?<!\\)\\(?!["\\/bfnrt])/g, "\\\\")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t");

    const parsedPost = JSON.parse(cleanedText);

    return new Response(JSON.stringify(parsedPost), {
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
