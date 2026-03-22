import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Trash2, History as HistoryIcon, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function History() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    fetchHistory();
  }, [user]);

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("generated_posts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      toast({
        title: "Error Loading History",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (post) => {
    const fullPost = `${post.hook}\n\n${post.body}\n\n${post.cta}\n\n${(post.hashtags || []).map(tag => tag.startsWith('#') ? tag : '#' + tag).join(" ")}`;
    try {
      await navigator.clipboard.writeText(fullPost);
      toast({ title: "Copied!", description: "Post copied to clipboard successfully." });
    } catch (error) {
      toast({ title: "Copy Failed", variant: "destructive" });
    }
  };

  const deletePost = async (id) => {
    try {
      const { error } = await supabase.from("generated_posts").delete().eq("id", id);
      if (error) throw error;
      
      setPosts(posts.filter(p => p.id !== id));
      toast({ title: "Post Deleted", description: "The content has been removed from your history." });
    } catch (error) {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="text-center py-20 text-muted-foreground animate-pulse">Loading history...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <HistoryIcon className="h-7 w-7 text-primary" /> 
            Post History
          </h1>
          <p className="text-muted-foreground">Review and manage your previously generated LinkedIn posts.</p>
        </div>
      </div>

      {posts.length === 0 ? (
        <Card className="text-center border-dashed py-16">
          <CardContent>
            <HistoryIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Generation History</h3>
            <p className="text-muted-foreground mb-6">You haven't generated any posts yet.</p>
            <Link to="/">
              <Button>Start Generating</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {posts.map((post) => (
            <Card key={post.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardHeader className="bg-muted/50 pb-4">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <CardTitle className="text-xl capitalize line-clamp-1">{post.topic}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-xs font-medium bg-background px-2 py-1 rounded-md border shadow-sm">{new Date(post.created_at).toLocaleDateString()}</span>
                      {post.post_type && <span className="capitalize px-2 py-0.5 border rounded-full text-xs text-muted-foreground">{post.post_type}</span>}
                      {post.tone && <span className="capitalize px-2 py-0.5 border rounded-full text-xs text-muted-foreground">{post.tone}</span>}
                      {post.length && <span className="capitalize px-2 py-0.5 border rounded-full text-xs text-muted-foreground">{post.length} length</span>}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(post)}>
                      <Copy className="h-4 w-4 mr-2" /> Copy
                    </Button>
                    <Button variant="outline" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => deletePost(post.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4 text-sm text-foreground/90">
                  <p className="font-semibold text-primary">{post.hook}</p>
                  <p className="whitespace-pre-line leading-relaxed">{post.body}</p>
                  <p className="italic">{post.cta}</p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {(post.hashtags || []).map((h, i) => (
                      <span key={i} className="text-primary font-medium hover:underline cursor-pointer">
                        {h.startsWith('#') ? h : '#' + h}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
