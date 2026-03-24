import { supabase } from "./supabase";

export async function generatePost({ topic, postType, tone, length }) {
    const payload = { topic, postType, tone, length };
    console.log("here-----------",payload)
    try {
        // Method 1: Standard Supabase Client Invoke (Preferred)
        if (supabase.functions && typeof supabase.functions.invoke === 'function') {
            const { data, error } = await supabase.functions.invoke('generate-post', {
                body: payload
            });

            if (error) {
                if (error.message?.includes("Function not found")) {
                    throw new Error("Edge Function 'generate-post' not found. Deploy it using: npx supabase functions deploy generate-post");
                }
                throw error;
            }
            return data;
        }

        // Method 2: Manual Fetch Fallback (if client property is missing)
        console.warn("supabase.functions.invoke is missing, using manual fetch fallback");
        const { data: { publicUrl } } = supabase.storage.from('dummy').getPublicUrl(''); // Just to get the base URL if needed, or use .supabaseUrl
        const baseUrl = supabase.supabaseUrl;
        const anonKey = supabase.supabaseKey;

        const response = await fetch(`${baseUrl}/functions/v1/generate-post`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${anonKey}`,
                'x-client-info': 'supabase-js-manual-fetch'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || `HTTP error! status: ${response.status}`);
        }

        return await response.json();

    } catch (error) {
        console.error("Error generating post:", error);
        throw error;
    }
}



