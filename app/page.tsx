"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Copy, Sparkles, Wand2, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface GeneratedPost {
  hook: string
  body: string
  cta: string
  hashtags: string[]
}

export default function LinkedInPostGenerator() {
  const [topic, setTopic] = useState("")
  const [postType, setPostType] = useState("")
  const [tone, setTone] = useState("")
  const [length, setLength] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedPost, setGeneratedPost] = useState<GeneratedPost | null>(null)
  const { toast } = useToast()

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast({
        title: "Topic Required",
        description: "Please enter a topic for your LinkedIn post.",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)

    try {
      const response = await fetch("/api/generate-post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: topic.trim(),
          postType: postType || "educational",
          tone: tone || "professional",
          length: length || "medium",
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate post")
      }

      const data = await response.json()
      setGeneratedPost(data)

      toast({
        title: "Post Generated!",
        description: "Your LinkedIn post has been created successfully.",
      })
    } catch (error) {
      console.error("Error generating post:", error)
      toast({
        title: "Generation Failed",
        description: "There was an error generating your post. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = async () => {
    if (!generatedPost) return

    const fullPost = `${generatedPost.hook}\n\n${generatedPost.body}\n\n${generatedPost.cta}\n\n${generatedPost.hashtags.join(" ")}`

    try {
      await navigator.clipboard.writeText(fullPost)
      toast({
        title: "Copied!",
        description: "Post copied to clipboard successfully.",
      })
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy post to clipboard.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold text-foreground">LinkedIn Post Generator</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Create engaging LinkedIn posts with AI. Just enter your topic and let our advanced AI craft compelling
            content that drives engagement.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-primary" />
                Post Configuration
              </CardTitle>
              <CardDescription>Configure your LinkedIn post parameters to generate tailored content</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="topic">Topic *</Label>
                <Textarea
                  id="topic"
                  placeholder="e.g., AI in recruitment, Remote work productivity, Leadership lessons..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="post-type">Post Type</Label>
                  <Select value={postType} onValueChange={setPostType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="educational">Educational</SelectItem>
                      <SelectItem value="story">Story</SelectItem>
                      <SelectItem value="motivational">Motivational</SelectItem>
                      <SelectItem value="promotional">Promotional</SelectItem>
                      <SelectItem value="question">Question</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tone">Tone</Label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="witty">Witty</SelectItem>
                      <SelectItem value="inspirational">Inspirational</SelectItem>
                      <SelectItem value="authoritative">Authoritative</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="length">Post Length</Label>
                <Select value={length} onValueChange={setLength}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select length" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">Short (50-100 words)</SelectItem>
                    <SelectItem value="medium">Medium (100-200 words)</SelectItem>
                    <SelectItem value="long">Long (200-300 words)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleGenerate} disabled={isGenerating || !topic.trim()} className="w-full" size="lg">
                {isGenerating ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Post
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Output Section */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Generated Post</span>
                {generatedPost && (
                  <Button variant="outline" size="sm" onClick={copyToClipboard}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </Button>
                )}
              </CardTitle>
              <CardDescription>Your AI-generated LinkedIn post ready to share</CardDescription>
            </CardHeader>
            <CardContent>
              {generatedPost ? (
                <div className="space-y-4">
                  {/* Hook */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-primary">Hook</Label>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium">{generatedPost.hook}</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Body */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-primary">Body</Label>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm whitespace-pre-line">{generatedPost.body}</p>
                    </div>
                  </div>

                  <Separator />

                  {/* CTA */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-primary">Call to Action</Label>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium">{generatedPost.cta}</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Hashtags */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-primary">Hashtags</Label>
                    <div className="flex flex-wrap gap-2">
                      {generatedPost.hashtags.map((hashtag, index) => (
                        <Badge key={index} variant="secondary">
                          {hashtag}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Full Preview */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-primary">Full Post Preview</Label>
                    <div className="p-4 border rounded-lg bg-card">
                      <div className="space-y-3 text-sm">
                        <p className="font-medium">{generatedPost.hook}</p>
                        <p className="whitespace-pre-line">{generatedPost.body}</p>
                        <p className="font-medium">{generatedPost.cta}</p>
                        <p className="text-primary">{generatedPost.hashtags.join(" ")}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Enter your topic and click "Generate Post" to create your LinkedIn content
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
