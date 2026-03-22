import { HashRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";

import Navbar from "@/components/Navbar";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Pricing from "@/pages/Pricing";
import UpdatePassword from "@/pages/UpdatePassword";

import History from "@/pages/History";
import AdminPanel from "@/pages/AdminPanel";

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-background text-foreground flex flex-col">
            <Navbar />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/update-password" element={<UpdatePassword />} />
                <Route path="/history" element={<History />} />
                <Route path="/admin" element={<AdminPanel />} />
              </Routes>
            </main>
          </div>
          <Toaster />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
