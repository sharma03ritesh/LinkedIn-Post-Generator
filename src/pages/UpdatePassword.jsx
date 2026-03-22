import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Loader2, KeyRound, CheckCircle2 } from "lucide-react"
import { motion } from "framer-motion"

export default function UpdatePassword() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  
  const { toast } = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    // Optionally: Check if the user is actually currently in a recovery session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast({
          title: "Session Expired",
          description: "Please request a new password reset link.",
          variant: "destructive"
        })
        navigate('/login')
      }
    }
    checkSession()
  }, [navigate, toast])

  const handleUpdate = async (e) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match.",
        variant: "destructive"
      })
      return
    }

    if (password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters.",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      
      setSuccess(true)
      toast({ title: "Success!", description: "Your password has been securely updated." })
      
      // Give them a moment to read success before redirecting
      setTimeout(() => {
        navigate("/")
      }, 2000)

    } catch (error) {
      toast({
        title: "Failed to update password",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-background relative overflow-hidden">
        {/* Decorative Background Blob */}
        <div className="absolute w-full h-full overflow-hidden z-0 opacity-20 pointer-events-none">
           <div className="absolute top-[20%] left-[20%] w-[30%] h-[40%] rounded-full bg-primary/30 blur-[120px]" />
        </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-[400px] z-10"
      >
        <div className="bg-card border border-border/40 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
          {!success ? (
            <>
              <div className="mb-8 text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4 border border-primary/20">
                  <KeyRound className="w-6 h-6 text-primary" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Set new password</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                  Please enter your new password below to regain access to your account.
                </p>
              </div>

              <form onSubmit={handleUpdate} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">New Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-background/50 h-11"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="bg-background/50 h-11"
                      required
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-11" 
                  disabled={loading || !password || !confirmPassword}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </form>
            </>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="text-center py-8"
            >
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold mb-2">You're all set!</h2>
              <p className="text-muted-foreground">Your password has been successfully updated. Redirecting to workspace...</p>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
