import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Copy, Sparkles, Wand2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generatePost as generateGeiminiPost } from "@/lib/gemini";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

export default function Home() {
    const [topic, setTopic] = useState("");
    const [postType, setPostType] = useState("");
    const [tone, setTone] = useState("");
    const [length, setLength] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedPost, setGeneratedPost] = useState(null);
    const { toast } = useToast();
    const navigate = useNavigate();
    const { checkCanGenerate, user, profile } = useAuth();

    const handleGenerate = async () => {
        if (!topic.trim()) {
            toast({
                title: "Topic Required",
                description: "Please enter a topic for your LinkedIn post.",
                variant: "destructive",
            });
            return;
        }
        
        try {
            // First check if they have usage left!
            await checkCanGenerate();
        } catch (authError) {
            toast({
                title: "Usage Limit Reached",
                description: authError.message,
                variant: "destructive",
            });
            
            // Redirect based on whether they are logged in setup
            if (!user) {
                navigate("/login");
            } else {
                navigate("/pricing");
            }
            return;
        }

        setIsGenerating(true);
        try {
            const data = await generateGeiminiPost({
                topic: topic.trim(),
                postType: postType || "educational",
                tone: tone || "professional",
                length: length || "medium",
            });
            setGeneratedPost(data);

            if (user) {
                const { error: dbError } = await supabase.from('generated_posts').insert({
                    user_id: user.id,
                    topic: topic.trim(),
                    post_type: postType || "educational",
                    tone: tone || "professional",
                    length: length || "medium",
                    hook: data.hook,
                    body: data.body,
                    cta: data.cta,
                    hashtags: data.hashtags
                });
                if (dbError) {
                    console.error("Failed to save history:", dbError);
                }
            }

            toast({
                title: "Post Generated!",
                description: "Your LinkedIn post has been created successfully.",
            });
        }
        catch (error) {
            console.error("Error generating post:", error);
            toast({
                title: "Generation Failed",
                description: error.message || "There was an error generating your post. Please try again.",
                variant: "destructive",
            });
        }
        finally {
            setIsGenerating(false);
        }
    };

    const copyToClipboard = async () => {
        if (!generatedPost) return;
        const fullPost = `${generatedPost.hook}\n\n${generatedPost.body}\n\n${generatedPost.cta}\n\n${generatedPost.hashtags.map(tag => tag.startsWith('#') ? tag : '#' + tag).join(" ")}`;
        try {
            await navigator.clipboard.writeText(fullPost);
            toast({
                title: "Copied!",
                description: "Post copied to clipboard successfully.",
            });
        }
        catch (error) {
            toast({
                title: "Copy Failed",
                description: "Failed to copy post to clipboard.",
                variant: "destructive",
            });
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Sparkles className="h-8 w-8 text-primary"/>
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
                  <Wand2 className="h-5 w-5 text-primary"/>
                  Post Configuration
                </CardTitle>
                <CardDescription>Configure your LinkedIn post parameters to generate tailored content</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="topic">Topic *</Label>
                  <Textarea id="topic" placeholder="e.g., AI in recruitment, Remote work productivity, Leadership lessons..." value={topic} onChange={(e) => setTopic(e.target.value)} className="min-h-[80px]"/>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="post-type">Post Type</Label>
                    <Select value={postType} onValueChange={setPostType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type"/>
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
                        <SelectValue placeholder="Select tone"/>
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
                      <SelectValue placeholder="Select length"/>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short">Short (50-100 words)</SelectItem>
                      <SelectItem value="medium">Medium (100-200 words)</SelectItem>
                      <SelectItem value="long">Long (200-300 words)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4 pt-4">
                  {user && profile ? (
                    <div className="space-y-2 relative">
                       {/* Subscription Warning / States */}
                       {profile.plan_expires_at && new Date(profile.plan_expires_at) < new Date() ? (
                         <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg mb-4 text-sm flex items-center justify-between">
                            <strong>Plan Expired! Switched to Basic. Please upgrade.</strong>
                            <Button variant="outline" size="sm" onClick={() => navigate('/pricing')} className="h-8 border-destructive/30 hover:bg-destructive/10 text-destructive">
                              Upgrade
                            </Button>
                         </div>
                       ) : profile.plan_id !== 'basic' && profile.plan_expires_at ? (
                         <div className="text-xs text-muted-foreground flex justify-between bg-primary/5 px-3 py-2 rounded-md mb-2">
                            <span>Active Subscription</span>
                            <span>Renews: <strong className="text-foreground">{new Date(profile.plan_expires_at).toLocaleDateString()}</strong></span>
                         </div>
                       ) : null}

                       <div className="flex justify-between text-sm">
                         <span className="text-muted-foreground">Daily Limit ({profile.plan_expires_at && new Date(profile.plan_expires_at) < new Date() ? 'Basic' : profile.plan?.name || 'Loading'})</span>
                         <span className="font-medium">
                           {profile.usage_count} / {profile.plan_expires_at && new Date(profile.plan_expires_at) < new Date() ? 2 : profile.plan?.daily_limit >= 999999 ? "∞" : profile.plan?.daily_limit || '-'}
                         </span>
                       </div>
                       <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                         <div 
                           className={`h-full transition-all duration-300 ${
                             profile.usage_count >= (profile.plan_expires_at && new Date(profile.plan_expires_at) < new Date() ? 2 : profile.plan?.daily_limit) ? 'bg-destructive' : 'bg-primary'
                           }`}
                           style={{ width: `${Math.min(100, (profile.usage_count / ((profile.plan_expires_at && new Date(profile.plan_expires_at) < new Date() ? 2 : profile.plan?.daily_limit) || 1)) * 100)}%` }}
                         />
                       </div>
                    </div>
                  ) : (
                    <div className="text-sm text-center px-4 py-2 bg-secondary/50 rounded-lg text-muted-foreground">
                      <p>Guest Access: You have 1 free generation to test our AI.</p>
                    </div>
                  )}

                  <Button 
                    onClick={handleGenerate} 
                    disabled={
                      isGenerating || 
                      !topic.trim() || 
                      (user && profile && profile.usage_count >= (profile.plan_expires_at && new Date(profile.plan_expires_at) < new Date() ? 2 : profile.plan?.daily_limit)) || 
                      (!user && parseInt(localStorage.getItem('guestUsageCount') || '0') >= 1)
                    } 
                    className="w-full mt-2" 
                    size="lg"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin"/>
                        Generating...
                      </>
                    ) : (user && profile && profile.usage_count >= (profile.plan_expires_at && new Date(profile.plan_expires_at) < new Date() ? 2 : profile.plan?.daily_limit)) ? (
                      <>Upgrade to Generate More</>
                    ) : (!user && parseInt(localStorage.getItem('guestUsageCount') || '0') >= 1) ? (
                      <>Login to Continue Creating</>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4"/>
                        Generate Post
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Output Section */}
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Generated Post</span>
                  {generatedPost && (<Button variant="outline" size="sm" onClick={copyToClipboard}>
                      <Copy className="mr-2 h-4 w-4"/>
                      Copy
                    </Button>)}
                </CardTitle>
                <CardDescription>Your AI-generated LinkedIn post ready to share</CardDescription>
              </CardHeader>
              <CardContent>
                {generatedPost ? (<div className="space-y-4">
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
                        {generatedPost.hashtags.map((hashtag, index) => (<Badge key={index} variant="secondary">
                            {hashtag}
                          </Badge>))}
                      </div>
                    </div>

                    <Separator />

                    {/* Full Preview */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-primary">Full Post Preview</Label>
                      <div className="p-4 border rounded-lg bg-card text-card-foreground">
                        <div className="space-y-3 text-sm">
                          <p className="font-medium">{generatedPost.hook}</p>
                          <p className="whitespace-pre-line">{generatedPost.body}</p>
                          <p className="font-medium">{generatedPost.cta}</p>
                          <p className="text-primary">{generatedPost.hashtags.map(h => h.startsWith('#') ? h : '#' + h).join(" ")}</p>
                        </div>
                      </div>
                    </div>
                  </div>) : (<div className="text-center py-12">
                    <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4"/>
                    <p className="text-muted-foreground">
                      Enter your topic and click "Generate Post" to create your LinkedIn content
                    </p>
                  </div>)}
              </CardContent>
            </Card>
          </div>
        </div>
    );
}
