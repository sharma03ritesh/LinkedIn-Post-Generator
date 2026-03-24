import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, UserCog, History, RefreshCw, QrCode, CheckCircle2, XCircle, Settings, Save, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [pendingTx, setPendingTx] = useState([]);
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [savingSetting, setSavingSetting] = useState(null);
  const [showKeys, setShowKeys] = useState({}); // Track visibility per setting ID
  
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!profile) return;
    if (!profile.is_admin) {
      toast({ title: "Access Denied", description: "You are not an administrative user.", variant: "destructive" });
      navigate("/");
      return;
    }
    fetchDashboardData();
  }, [profile]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Fetch users
      const { data: usersData, error: usersError } = await supabase.rpc('admin_get_all_users');
      if (usersError) throw usersError;
      setUsers(usersData || []);

      // Fetch pending transactions
      const { data: txData, error: txError } = await supabase.rpc('admin_get_pending_transactions');
      if (txError) throw txError;
      setPendingTx(txData || []);

      // Fetch settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('settings')
        .select('*')
        .order('category', { ascending: true });
      if (settingsError) throw settingsError;
      setSettings(settingsData || []);
    } catch (error) {
      toast({ title: "Fetch Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePlan = async (userId, newPlanId) => {
    setUpdating(userId);
    try {
      const { data, error } = await supabase.rpc('admin_update_user_plan', {
        target_user_id: userId,
        new_plan_id: newPlanId
      });

      if (error) throw error;
      
      toast({ title: "Success", description: "User's subscription plan has been updated successfully!" });
      
      setUsers(users.map(u => {
        if (u.id === userId) return { ...u, plan_id: newPlanId };
        return u;
      }));
    } catch (error) {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    } finally {
      setUpdating(null);
    }
  };

  const handleResolveTx = async (txId, status) => {
    setUpdating(txId);
    try {
      const { error } = await supabase.rpc('admin_resolve_transaction', {
        tx_id: txId,
        resolution_status: status
      });

      if (error) throw error;

      toast({ 
        title: status === 'completed' ? "Payment Approved" : "Payment Rejected", 
        description: status === 'completed' ? "The user's account has been upgraded instantly." : "Transaction marked as failed."
      });

      setPendingTx(pendingTx.filter(tx => tx.id !== txId));
      fetchDashboardData(); // Refetch to update user list with new plans
    } catch (error) {
      toast({ title: "Action Failed", description: error.message, variant: "destructive" });
    } finally {
      setUpdating(null);
    }
  };

  const handleUpdateSetting = async (settingId, newValue) => {
    if (!newValue || newValue.trim() === "") {
      toast({ title: "Validation Error", description: "Setting value cannot be empty.", variant: "destructive" });
      return;
    }

    setSavingSetting(settingId);
    try {
      const { error } = await supabase
        .from('settings')
        .update({ value: newValue, updated_at: new Date().toISOString() })
        .eq('id', settingId);

      if (error) throw error;
      
      toast({ title: "Setting Updated", description: `${settingId} has been updated successfully.` });
      
      setSettings(settings.map(s => s.id === settingId ? { ...s, value: newValue } : s));
    } catch (error) {
      toast({ title: "Save Failed", description: error.message, variant: "destructive" });
    } finally {
      setSavingSetting(null);
    }
  };


  if (loading || !profile?.is_admin) {
    return <div className="text-center py-20 text-muted-foreground animate-pulse">Checking Authorization...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-8 w-8 text-primary" />
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">Manage platform users, subscriptions, and verify payments.</p>
        </div>
        <Button variant="outline" onClick={fetchDashboardData}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <UserCog className="h-4 w-4" /> User Management
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <QrCode className="h-4 w-4" /> Pending UPI Payments
            {pendingTx.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                {pendingTx.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" /> Platform Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card className="shadow-md">
            <CardHeader className="bg-muted/30 pb-4">
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5 text-primary" />
                Registered Users ({users.length})
              </CardTitle>
              <CardDescription>View all accounts and instantly modify their active billing plans.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead>User Information</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead className="w-[200px]">Subscription Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id} className="hover:bg-muted/10">
                      <TableCell>
                        <div className="font-semibold text-foreground/90">{u.full_name || "Anonymous"}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                        <div className="text-[10px] text-muted-foreground mt-1 opacity-50 font-mono">ID: {u.id.slice(0, 10)}...</div>
                      </TableCell>
                      <TableCell>
                         {u.is_admin ? <Badge variant="default">Admin</Badge> : <Badge variant="secondary">User</Badge>}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="text-foreground/80">Posts: <strong>{u.usage_count}</strong></div>
                        <div className="text-xs text-muted-foreground mt-1">
                           Seen: {u.last_usage_date ? new Date(u.last_usage_date).toLocaleDateString() : 'Never'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select 
                          disabled={updating === u.id || u.is_admin} 
                          value={u.plan_id} 
                          onValueChange={(val) => handleUpdatePlan(u.id, val)}
                        >
                          <SelectTrigger className="h-8 text-xs font-semibold">
                            <SelectValue placeholder="Select plan" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="basic">Basic (Free)</SelectItem>
                            <SelectItem value="starter">Starter</SelectItem>
                            <SelectItem value="advanced">Advanced</SelectItem>
                            <SelectItem value="enterprise">Enterprise</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {users.length === 0 && (
                 <div className="py-12 text-center text-muted-foreground text-sm">No users found.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card className="shadow-md border-amber-200">
            <CardHeader className="bg-amber-500/10 pb-4">
              <CardTitle className="flex items-center gap-2 text-amber-600">
                <QrCode className="h-5 w-5" />
                Awaiting Manual Review ({pendingTx.length})
              </CardTitle>
              <CardDescription>
                Cross-reference the UTR IDs below with your bank app statement. Approve them to instantly upgrade user accounts.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead>Submission Date</TableHead>
                    <TableHead>User Email</TableHead>
                    <TableHead>Requested Plan</TableHead>
                    <TableHead>Claimed Amount</TableHead>
                    <TableHead>Bank UTR ID</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingTx.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(tx.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {tx.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{tx.plan_name}</Badge>
                      </TableCell>
                      <TableCell className="font-semibold">
                        ₹{tx.amount}
                      </TableCell>
                      <TableCell>
                        <code className="bg-muted px-2 py-1 rounded text-xs select-all">
                          {tx.reference_id}
                        </code>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                            disabled={updating === tx.id}
                            onClick={() => handleResolveTx(tx.id, 'completed')}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-destructive hover:bg-destructive/10"
                            disabled={updating === tx.id}
                            onClick={() => handleResolveTx(tx.id, 'failed')}
                          >
                            <XCircle className="w-4 h-4 mr-1" /> Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {pendingTx.length === 0 && (
                <div className="py-16 text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">All Caught Up!</p>
                  <p className="text-muted-foreground text-sm">No users are currently waiting for UPI approval.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card className="shadow-lg border-none bg-background">
            <CardHeader className="border-b bg-muted/20 pb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Settings className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">System Configuration</CardTitle>
                  <CardDescription>Securely manage global application parameters and API credentials.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-12">
                {['API Keys', 'Payment', 'Email', 'Supabase', 'general'].map((cat) => {
                  const catSettings = settings.filter(s => s.category === cat || (cat === 'general' && !s.category));
                  if (catSettings.length === 0) return null;
                  
                  return (
                    <div key={cat} className="space-y-6">
                      <div className="flex items-center gap-4">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">{cat}</h3>
                        <div className="h-[1px] flex-1 bg-muted"></div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {catSettings.map((s) => (
                          <div key={s.id} className="group p-5 rounded-xl border bg-card hover:border-primary/50 transition-all duration-200 shadow-sm flex flex-col justify-between h-full">
                            <div className="space-y-3 mb-4">
                              <div className="flex items-center justify-between">
                                <Label className="text-sm font-bold text-foreground capitalize tracking-tight">
                                  {s.id.replace(/_/g, ' ')}
                                </Label>
                                {s.is_public ? (
                                  <Badge variant="outline" className="text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-600 border-emerald-200">Public</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] font-bold uppercase bg-amber-500/10 text-amber-600 border-amber-200">Secret</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed h-8">
                                {s.description || `Management key for the ${cat} module.`}
                              </p>
                              
                              <div className="relative mt-4">
                                <Input 
                                  type={
                                    (s.id.includes('secret') || s.id.includes('key') || s.id.includes('password')) && !showKeys[s.id] 
                                    ? "password" : "text"
                                  }
                                  value={s.value}
                                  onChange={(e) => setSettings(settings.map(set => set.id === s.id ? { ...set, value: e.target.value } : set))}
                                  className="pr-10 font-mono text-xs bg-muted/30 border-muted focus-visible:ring-primary h-10"
                                  placeholder="Enter configuration value..."
                                />
                                {(s.id.includes('secret') || s.id.includes('key') || s.id.includes('password')) && (
                                  <button
                                    type="button"
                                    onClick={() => setShowKeys(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors focus:outline-none"
                                  >
                                    {showKeys[s.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            <Button 
                              size="sm" 
                              variant="secondary"
                              className="w-full mt-2 font-semibold text-xs h-9 hover:bg-primary hover:text-primary-foreground transition-colors group-hover:shadow-md"
                              onClick={() => handleUpdateSetting(s.id, s.value)}
                              disabled={savingSetting === s.id}
                            >
                              {savingSetting === s.id ? (
                                <RefreshCw className="h-3 w-3 animate-spin mr-2" />
                              ) : (
                                <Save className="h-3 w-3 mr-2" />
                              )}
                              Sync Changes
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {settings.length === 0 && (
                  <div className="text-center py-20 border-2 border-dashed rounded-2xl bg-muted/5">
                    <Settings className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground font-medium">No system settings found.</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Please initialize your database configuration.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
