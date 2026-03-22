import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"

export default function Navbar() {
  const { user, profile } = useAuth()

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }
  console.log(profile)
  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="font-bold text-lg flex items-center gap-2">
          LinkedIn Post Generator
        </Link>

        <div className="flex items-center gap-4">
          <Link to="/pricing">
            <Button variant="ghost">Pricing</Button>
          </Link>

          {user ? (
            <div className="flex items-center gap-4">
              {profile?.is_admin && (
                  <Link to="/admin">
                    <Button variant="ghost" className="hidden sm:flex items-center gap-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
                      Admin
                    </Button>
                  </Link>
              )}
              <Link to="/history">
                <Button variant="ghost" className="hidden sm:flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
                  History
                </Button>
              </Link>
              <div className="text-sm hidden sm:block">
                <span className="text-muted-foreground mr-2 font-semibold">
                  {profile?.full_name || user.email}
                </span>
                {profile && (
                  <span className="bg-primary/10 text-primary px-2 py-1 rounded-md font-medium text-xs">
                    {profile.plan?.name} ({profile.usage_count}/{profile.plan?.daily_limit})
                  </span>
                )}
              </div>
              <Button onClick={handleLogout} variant="outline" size="sm">
                Logout
              </Button>
            </div>
          ) : (
            <Link to="/login">
              <Button>Log in / Sign up</Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
