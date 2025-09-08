import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { topic, postType, tone, length } = await request.json()

    // Check if GEMINI_API_KEY is available
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY environment variable is not set. Please add your Gemini API key to continue." },
        { status: 500 },
      )
    }

    // Construct the prompt based on the workflow
    const prompt = `You are a LinkedIn content expert. Create a compelling LinkedIn post about "${topic}".

Requirements:
- Post type: ${postType}
- Tone: ${tone}
- Length: ${length}

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

Generate only the JSON response, no additional text.`

    // Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
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
      },
    )

    if (!response.ok) {
      const errorData = await response.text()
      console.error("Gemini API error:", errorData)
      return NextResponse.json({ error: "Failed to generate content from Gemini API" }, { status: response.status })
    }

    const data = await response.json()

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      console.error("Unexpected Gemini API response structure:", data)
      return NextResponse.json({ error: "Invalid response from Gemini API" }, { status: 500 })
    }

    const generatedText = data.candidates[0].content.parts[0].text

    try {
      let cleanedText = generatedText.trim()

      console.log("[v0] Raw response length:", generatedText.length)
      console.log("[v0] Raw response:", generatedText)

      if (cleanedText.startsWith("```json")) {
        cleanedText = cleanedText.replace(/^```json\s*/, "").replace(/\s*```$/, "")
      } else if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.replace(/^```\s*/, "").replace(/\s*```$/, "")
      }

      // Remove any leading/trailing non-JSON content
      const jsonStart = cleanedText.indexOf("{")
      const jsonEnd = cleanedText.lastIndexOf("}")

      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        cleanedText = cleanedText.substring(jsonStart, jsonEnd + 1)
      }

      cleanedText = cleanedText
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove control characters
        .replace(/(?<!\\)\\(?!["\\/bfnrt])/g, "\\\\") // Escape unescaped backslashes
        .replace(/\n/g, "\\n") // Escape newlines in strings
        .replace(/\r/g, "\\r") // Escape carriage returns
        .replace(/\t/g, "\\t") // Escape tabs

      console.log("[v0] Cleaned text for parsing:", cleanedText.substring(0, 200) + "...")

      const openBraces = (cleanedText.match(/{/g) || []).length
      const closeBraces = (cleanedText.match(/}/g) || []).length

      if (openBraces !== closeBraces) {
        console.log("[v0] Detected incomplete JSON - braces don't match")
        throw new Error("Incomplete JSON response - likely truncated")
      }

      // Parse the JSON response from Gemini
      const parsedPost = JSON.parse(cleanedText)

      // Validate the structure
      if (!parsedPost.hook || !parsedPost.body || !parsedPost.cta || !Array.isArray(parsedPost.hashtags)) {
        throw new Error("Invalid post structure")
      }

      if (typeof parsedPost.body === "string") {
        parsedPost.body = parsedPost.body.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t")
      }

      console.log("[v0] Successfully parsed post:", parsedPost)
      return NextResponse.json(parsedPost)
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", parseError)
      console.error("Raw response:", generatedText)
      console.log("[v0] Parse error details:", parseError.message)

      try {
        // Try to extract content manually using more robust regex patterns
        const hookMatch = generatedText.match(/"hook":\s*"((?:[^"\\]|\\.)*)"/s)
        const bodyMatch = generatedText.match(/"body":\s*"((?:[^"\\]|\\.)*)"/s)
        const ctaMatch = generatedText.match(/"cta":\s*"((?:[^"\\]|\\.)*)"/s)
        const hashtagsMatch = generatedText.match(/"hashtags":\s*\[(.*?)\]/s)

        if (hookMatch && bodyMatch && ctaMatch && hashtagsMatch) {
          const fallbackPost = {
            hook: hookMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "\n"),
            body: bodyMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "\n"),
            cta: ctaMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "\n"),
            hashtags: hashtagsMatch[1]
              .split(",")
              .map((tag) => tag.trim().replace(/["[\]]/g, ""))
              .filter((tag) => tag.length > 0),
          }

          console.log("[v0] Fallback parsing successful:", fallbackPost)
          return NextResponse.json(fallbackPost)
        }
      } catch (fallbackError) {
        console.log("[v0] Fallback parsing also failed:", fallbackError.message)
      }

      return NextResponse.json({ error: "Failed to parse generated content. Please try again." }, { status: 500 })
    }
  } catch (error) {
    console.error("Error in generate-post API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
