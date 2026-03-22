import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          fetchProfile(session.user.id)
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, plan:plans(*)')
        .eq('id', userId)
        .single()
      
      if (error) throw error
      setProfile(data)
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setLoading(false)
    }
  }

  // Helper to generate a basic device fingerprint
  const getDeviceFingerprint = () => {
    try {
      const components = [
        navigator.userAgent,
        window.screen.width,
        window.screen.height,
        window.screen.colorDepth,
        navigator.language
      ].join('||');
      return btoa(components);
    } catch {
      return 'unknown_device_fingerprint';
    }
  }

  // Subscription checking logic
  const checkCanGenerate = async () => {
    if (user) {
      // For authenticated users, call our RPC function in supabase
      const { data, error } = await supabase.rpc('increment_usage')
      if (error) {
        throw new Error(error.message)
      }
      if (!data.success) {
        throw new Error(data.error) // 'Daily limit reached'
      }
      
      // Update local profile usage_count to reflect the newly returned count
      setProfile(prev => ({
        ...prev,
        usage_count: data.usage_count
      }))
      return true;
    } else {
      // For guests - Call the new strict IP + Device Fingerprint Tracker
      const fingerprint = getDeviceFingerprint()
      const { data, error } = await supabase.rpc('check_and_mark_guest_usage', {
        device_fingerprint: fingerprint
      })
      
      if (error) {
        throw new Error(error.message)
      }
      
      if (!data?.success) {
        throw new Error(data?.error || 'Guest usage limit reached')
      }
      
      return true;
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, checkCanGenerate }}>
      {children}
    </AuthContext.Provider>
  )
}
