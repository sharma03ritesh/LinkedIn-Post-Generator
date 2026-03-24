import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Sparkles, ArrowRight, Loader2, Mail } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)

  // Alt Login Flows
  const [useMagicLink, setUseMagicLink] = useState(false)
  const [isResetPassword, setIsResetPassword] = useState(false)
  
  const { toast } = useToast()
  const navigate = useNavigate()
  const { user } = useAuth()

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate("/")
    }
  }, [user, navigate])

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Dynamically fetch the configured site URL for redirects
      const { data: siteSetting } = await supabase
        .from('settings')
        .select('value')
        .eq('id', 'site_url')
        .single()
      
      // We combine the origin with the Vite BASE_URL (e.g. /LinkedIn-Post-Generator/) 
      // if the siteSetting isn't explicitly set to a different full URL.
      const baseUrl = import.meta.env.BASE_URL || '/'
      const siteUrl = siteSetting && siteSetting.value !== 'http://localhost:5173' 
        ? siteSetting.value 
        : window.location.origin + baseUrl

      if (isResetPassword) {
        // Send actual password reset email
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${siteUrl}update-password`.replace(/\/\//g, '/') // Ensure clean slashes
        })
        if (error) throw error
        toast({ title: "Reset link sent!", description: "Check your email for the password reset link." })
        setIsResetPassword(false)
      }
      else if (useMagicLink) {
        // Send a magic login link
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: siteUrl
          }
        })
        if (error) throw error
        toast({ title: "Magic Link Sent!", description: "Check your email for the seamless login link." })
      }

      else if (isSignUp) {
        if (!fullName.trim()) throw new Error("Full name is required")
        if (password !== confirmPassword) throw new Error("Passwords do not match!")
        // Standard Email/Password Signup
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: siteUrl
          }
        })
        if (error) throw error
        toast({
          title: "Account Created!",
          description: "Please check your email to confirm your account."
        })
      }
      else {
        // Standard Email/Password Login
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        })
        if (error) throw error
        toast({ title: "Logged in successfully!" })
        navigate("/")
      }
    } catch (error) {
      toast({
        title: "Authentication Error",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="min-h-[calc(100vh-4rem)] flex w-full">
      {/* Left side - Dynamic Form */}
      <div className="flex-1 flex items-center justify-center p-8 sm:p-12 relative overflow-hidden bg-background">

        {/* Decorative Background Blob */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 opacity-30 pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px]" />
          <div className="absolute bottom-[10%] right-[10%] w-[30%] h-[30%] rounded-full bg-secondary/20 blur-[100px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-[400px] space-y-8"
        >
          <div className="space-y-2 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4"
            >
              <Sparkles className="w-6 h-6 text-primary" />
            </motion.div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {isResetPassword ? "Reset password" : useMagicLink ? "Passwordless Login" : (isSignUp ? "Create an account" : "Welcome back")}
            </h1>
            <p className="text-muted-foreground">
              {isResetPassword
                ? "We'll send you a link to securely reset your password."
                : useMagicLink
                  ? "We'll email you a magic link for a password-free sign in."
                  : (isSignUp
                    ? "Start creating explosive LinkedIn content today."
                    : "Enter your credentials to access your workspace.")}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {isSignUp && !useMagicLink && !isResetPassword && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-2 overflow-hidden mb-4"
                  >
                    <Label htmlFor="fullName" className="text-foreground/80">Full Name</Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="bg-background/50 backdrop-blur-sm border-muted h-11"
                      required={isSignUp}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground/80">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-background/50 backdrop-blur-sm border-muted h-11"
                  required
                />
              </div>

              <AnimatePresence mode="popLayout">
                {!useMagicLink && !isResetPassword && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-2 overflow-hidden"
                  >
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-foreground/80">Password</Label>
                      {!isSignUp && (
                        <span
                          onClick={() => setIsResetPassword(true)}
                          className="text-xs text-primary hover:underline cursor-pointer"
                        >
                          Forgot password?
                        </span>
                      )}
                    </div>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-background/50 backdrop-blur-sm border-muted h-11"
                      required={!useMagicLink && !isResetPassword}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="popLayout">
                {isSignUp && !useMagicLink && !isResetPassword && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-2 overflow-hidden"
                  >
                    <Label htmlFor="confirmPassword" className="text-foreground/80">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="bg-background/50 backdrop-blur-sm border-muted h-11"
                      required={isSignUp}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Button
              type="submit"
              className="w-full h-11 relative overflow-hidden group"
              disabled={loading || !email || (!isResetPassword && !useMagicLink && !password) || (isSignUp && (!useMagicLink && (!confirmPassword || !fullName)))}
            >
              <span className={`flex items-center gap-2 transition-transform duration-300 ${loading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
                {isResetPassword ? "Send Reset Link" : useMagicLink ? "Send Magic Link" : (isSignUp ? "Create Account" : "Sign In")}
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </span>
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              )}
            </Button>

            <div className="flex items-center justify-center gap-2 text-sm text-foreground/60 p-2">
              <div className="h-px bg-border flex-1" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground">OR</span>
              <div className="h-px bg-border flex-1" />
            </div>

            <div className="flex flex-col gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setUseMagicLink(!useMagicLink)}
                className="w-full h-11"
              >
                <Mail className="w-4 h-4 mr-2" />
                {useMagicLink ? "Use Password Instead" : "Sign in with Magic Link"}
              </Button>
            </div>
          </form>

          <div className="text-center text-sm text-muted-foreground pt-4">
            {isResetPassword ? (
              <button
                type="button"
                onClick={() => setIsResetPassword(false)}
                className="text-primary hover:text-primary/80 font-semibold transition-colors focus:outline-none"
              >
                Return to sign in
              </button>
            ) : (
              <>
                {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp)
                    setUseMagicLink(false)
                  }}
                  className="text-primary hover:text-primary/80 font-semibold transition-colors focus:outline-none"
                >
                  {isSignUp ? "Sign in" : "Sign up for free"}
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>

      {/* Right side - Premium Branding Display */}
      <div className="hidden lg:flex flex-1 relative bg-zinc-900 border-l border-white/10 items-center justify-center p-12 overflow-hidden">
        {/* Animated Gradient Mesh layers */}
        <div className="absolute inset-0 z-0">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5 }}
            className="w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/30 via-zinc-900/10 to-transparent"
          />
        </div>

        <motion.div
          className="relative z-10 max-w-lg text-white space-y-8"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-xl mb-8 shadow-2xl">
            <Sparkles className="w-8 h-8 text-white" />
          </div>

          <h2 className="text-4xl lg:text-5xl font-bold tracking-tight leading-tight">
            Stop writing blocks.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-primary">Start engaging.</span>
          </h2>

          <p className="text-zinc-400 text-lg leading-relaxed max-w-md">
            The artificial intelligence capable of writing human-led, insightful, and algorithmic-friendly content on LinkedIn at a scale never seen before.
          </p>

          <div className="pt-8">
            <div className="flex items-center gap-4">
              <div className="flex -space-x-3">
                <div className="w-10 h-10 rounded-full border-2 border-zinc-900 bg-zinc-800" />
                <div className="w-10 h-10 rounded-full border-2 border-zinc-900 bg-zinc-700" />
                <div className="w-10 h-10 rounded-full border-2 border-zinc-900 bg-zinc-600" />
              </div>
              <div className="text-sm font-medium text-zinc-300">
                <span className="text-white block">+10,000 creators</span>
                trusting our platform
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
