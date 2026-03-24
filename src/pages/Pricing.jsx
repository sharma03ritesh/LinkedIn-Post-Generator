import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CheckCircle2, Zap, CreditCard, Building, QrCode, ArrowRight, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"

export default function Pricing() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)

  // Payment Modal States
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState(null) // 'card' or 'upi'
  const [processingUPI, setProcessingUPI] = useState(false)
  const [transactionId, setTransactionId] = useState("")
  const [razorpayKeyId, setRazorpayKeyId] = useState(null)

  const { user, profile } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    fetchPlans()
    fetchRazorpayKey()
  }, [])

  const fetchRazorpayKey = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('id', 'razorpay_key_id')
        .single()
      
      if (data) setRazorpayKeyId(data.value)
    } catch (err) {
      console.error("Error fetching payment config:", err)
    }
  }

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .order("price", { ascending: true })

      if (error) throw error
      setPlans(data || [])
    } catch (error) {
      console.error("Error fetching plans:", error)
      toast({
        title: "Error",
        description: "Failed to load pricing plans",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  // Initial Upgrade Click Handler
  const openPaymentModal = (plan) => {
    if (!user) {
      navigate("/login")
      return
    }

    if (plan.id === "enterprise") {
      toast({ title: "Contacting Sales", description: "Our team will reach out to you shortly." })
      return
    }

    setSelectedPlan(plan)
    setPaymentMethod(null)
    setTransactionId("")
    setIsModalOpen(true)
  }

  // Load Razorpay Script
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script")
      script.src = "https://checkout.razorpay.com/v1/checkout.js"
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })
  }

  // Handler for Razorpay (Cards, NetBanking, Wallets, UPI)
  const handleRazorpayCheckout = async () => {
    const res = await loadRazorpayScript()

    if (!res) {
      toast({
        title: "Connection Error",
        description: "Failed to load Razorpay SDK. Please check your internet connection.",
        variant: "destructive"
      })
      return
    }

    // securely generate order_id from supabase edge function
    const { data: orderData, error: orderError } = await supabase.functions.invoke(
      'create-razorpay-order',
      {
        body: { amount: selectedPlan.price, currency: "INR", receipt: `plan_${selectedPlan.id}`.substring(0, 39) }
      }
    )

    if (orderError || !orderData || !orderData.id) {
      toast({
        title: "Order Initialization Failed",
        description: orderError?.message || orderData?.error || "Deploy backend functions to start creating orders.",
        variant: "destructive"
      })
      return
    }

    const options = {
      key: razorpayKeyId || import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_YourTestKeyHere",
      amount: orderData.amount, // fetched securely from order
      currency: orderData.currency,
      name: "LinkedIn Post Generator",
      description: `Upgrade to ${selectedPlan.name} Plan`,
      order_id: orderData.id, // Secure Order ID
      handler: async function (response) {
        try {
          // Verify cryptographic signature tightly on the backend edge function
          const { data: verifyData, error: verifyError } = await supabase.functions.invoke(
            'verify-razorpay-payment',
            {
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              }
            }
          )

          if (verifyError || !verifyData?.verified) {
             throw new Error(verifyError?.message || verifyData?.error || "Cryptographic Signature Validation Failed")
          }

          // At this point the payment is strictly validated. Add Transaction Data.
          const { error: txError } = await supabase
            .from("transactions")
            .insert({
              user_id: user.id,
              plan_id: selectedPlan.id,
              amount: selectedPlan.price,
              reference_id: response.razorpay_payment_id,
              payment_method: 'razorpay',
              status: 'completed'
            })
            
          if (txError) throw txError

          // Instantly upgrade profile securely since it passed verification
          const { error: profileError } = await supabase
            .from('profiles')
            .update({
              plan_id: selectedPlan.id,
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id)

          if (profileError) throw profileError

          toast({ 
            title: "Payment Verified & Successful!", 
            description: `You are now on the ${selectedPlan.name} plan.`
          })
          
          setIsModalOpen(false)
          navigate("/")
          window.location.reload()
        } catch (error) {
          toast({
            title: "Verification/Update Failed",
            description: error.message,
            variant: "destructive"
          })
        }
      },
      prefill: {
        name: profile?.full_name || user?.email?.split('@')[0],
        email: user?.email,
      },
      theme: {
        color: "#0f172a",
      },
    };

    const paymentObject = new window.Razorpay(options)
    paymentObject.on('payment.failed', function (response) {
      toast({
        title: "Payment Failed",
        description: response.error.description,
        variant: "destructive"
      })
    })
    paymentObject.open()
  }

  // Handler for Manual UPI Payment Verification
  const verifyUPIPayment = async (e) => {
    e.preventDefault()

    if (transactionId.length < 8) {
      toast({ title: "Invalid UTR", description: "Please enter a valid 12-digit transaction reference number", variant: "destructive" })
      return;
    }

    setProcessingUPI(true)

    // Simulate slight delay for Submit
    setTimeout(async () => {
      try {
        // Log the transaction as purely PENDING for manual admin review
        const { error: txError } = await supabase
          .from("transactions")
          .insert({
            user_id: user.id,
            plan_id: selectedPlan.id,
            amount: selectedPlan.price,
            reference_id: transactionId,
            payment_method: 'upi',
            status: 'pending' // STRICTLY PENDING UNTIL ADMIN VERIFIES
          })
          
        if (txError) throw txError

        // Do NOT instantly upgrade the profile!
        // The user must wait for the Admin to check their physical bank app 
        // to verify the UTR and amount match exactly.

        toast({ 
          title: "Verification Pending!", 
          description: "We have received your UTR. Your account will be upgraded as soon as our team manually verifies the bank slip." 
        })
        
        setIsModalOpen(false)
        navigate("/")

      } catch (error) {
        toast({
          title: "Update Failed",
          description: error.message,
          variant: "destructive"
        })
      } finally {
        setProcessingUPI(false)
      }
    }, 2000)
  }

  if (loading) return <div className="text-center py-20">Loading plans...</div>

  // Generate dynamic QR Code based on plan price
  const generateUpiQr = () => {
    if (!selectedPlan) return "";
    const upiLink = `upi://pay?pa=ritesharmakush89508@oksbi&pn=LinkedIn%20Post%20Generator&am=${selectedPlan.price}&cu=INR`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiLink)}`;
  }

  return (
    <div className="container mx-auto px-4 py-16 max-w-6xl text-center">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">Simple, transparent pricing</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Choose the plan that best fits your content needs. Upgrade anytime as your audience grows.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
        {plans.map((plan) => {
          const isCurrentPlan = profile?.plan_id === plan.id
          return (
            <Card key={plan.id} className={`flex flex-col relative ${isCurrentPlan ? 'border-primary shadow-lg ring-1 ring-primary' : ''}`}>
              {isCurrentPlan && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-medium">
                  Current Plan
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>
                  {plan.price === null || plan.price === 0 ? "Custom pricing" : `₹${plan.price} / month`}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="text-3xl font-bold mb-6">
                  {plan.price === null ? "Custom" : plan.price === 0 ? "Free" : `₹${plan.price}`}
                </div>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>{plan.daily_limit >= 999999 ? "Unlimited" : plan.daily_limit} posts per day</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>AI Content Generation</span>
                  </li>
                  {plan.price > 0 && (
                    <li className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-500" />
                      <span>Priority Generation</span>
                    </li>
                  )}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={isCurrentPlan ? "outline" : "default"}
                  disabled={isCurrentPlan}
                  onClick={() => openPaymentModal(plan)}
                >
                  {isCurrentPlan ? "Active Plan" : (plan.price === null ? "Contact Sales" : plan.price === 0 ? "Downgrade" : "Upgrade")}
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>

      {/* Unified Payment Selection Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Your Upgrade</DialogTitle>
            <DialogDescription>
              Securely upgrade to the <strong className="text-foreground">{selectedPlan?.name} Plan</strong> for <strong className="text-foreground">₹{selectedPlan?.price}</strong>
            </DialogDescription>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {!paymentMethod ? (
              <motion.div
                key="selection"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid gap-4 py-4"
              >
                <button
                  onClick={handleRazorpayCheckout}
                  className="flex items-center justify-between w-full p-4 border rounded-xl hover:border-blue-500 hover:bg-blue-500/5 transition-all text-left group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-500/10 flex justify-center items-center rounded-lg">
                      <CreditCard className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">Pay with Razorpay</h4>
                      <p className="text-sm text-muted-foreground line-clamp-1">Cards, NetBanking, UPI, Wallets</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-blue-500 transition-colors" />
                </button>

                <button
                  onClick={() => setPaymentMethod('upi')}
                  className="flex items-center justify-between w-full p-4 border rounded-xl hover:border-green-500 hover:bg-green-500/5 transition-all text-left group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-green-500/10 flex justify-center items-center rounded-lg">
                      <Building className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">Pay Direct via UPI</h4>
                      <p className="text-sm text-muted-foreground">Scan QR Code or transfer to our UPI ID</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-green-500 transition-colors" />
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="upi-flow"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="py-4 space-y-6"
              >
                <div className="bg-muted/50 p-6 rounded-xl flex flex-col items-center justify-center text-center space-y-4">
                  <div className="bg-white p-2 rounded-xl shadow-sm">
                    <img src={generateUpiQr()} alt="UPI QR Code" className="w-40 h-40 mix-blend-multiply" />
                  </div>
                  <div>
                    <p className="font-medium text-lg text-emerald-600">Scan to Pay ₹{selectedPlan?.price}</p>
                    <p className="text-sm text-muted-foreground mt-2">Or transfer directly to:</p>
                    <p className="font-mono bg-background border px-3 py-1 rounded-md text-sm mt-1 inline-block">ritesharmakush89508@oksbi</p>
                    <p className="text-sm text-muted-foreground mt-2">UPI Number:</p>
                    <p className="font-mono bg-background border px-3 py-1 rounded-md text-sm mt-1 inline-block">8950830269</p>
                  </div>
                </div>

                <form onSubmit={verifyUPIPayment} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="utr">Transaction ID (UTR Number)</Label>
                    <Input
                      id="utr"
                      placeholder="Enter the 12-digit transaction ID"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">This helps us verify your payment instantly.</p>
                  </div>
                  <div className="flex gap-3">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setPaymentMethod(null)}>
                      Back
                    </Button>
                    <Button type="submit" className="flex-[2] bg-green-600 hover:bg-green-700 text-white" disabled={processingUPI || !transactionId}>
                      {processingUPI ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <QrCode className="w-4 h-4 mr-2" />}
                      Verify Payment
                    </Button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </div>
  )
}
