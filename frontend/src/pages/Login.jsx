import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "../components/Header";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("demo@cottonhub.com");
  const [password, setPassword] = useState("demo1234");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back");
      navigate("/marketplace");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Login failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-bg-base">
      <Header />
      <div className="max-w-md mx-auto px-6 py-16">
        <div className="text-xs font-semibold tracking-widest uppercase text-ink-muted mb-3">Welcome back</div>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-ink-primary">Log in to CottonHub.</h1>
        <form onSubmit={submit} className="mt-8 bg-white border border-edge rounded-lg p-6 space-y-5">
          <div>
            <Label className="text-xs font-semibold tracking-widest uppercase text-ink-muted mb-2 block">Email</Label>
            <Input data-testid="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label className="text-xs font-semibold tracking-widest uppercase text-ink-muted mb-2 block">Password</Label>
            <Input data-testid="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button data-testid="login-submit" type="submit" disabled={loading} className="w-full bg-brand hover:bg-brand-hover text-white">
            {loading ? "Logging in…" : "Log in"}
          </Button>
          <div className="text-sm text-ink-muted text-center">
            New to CottonHub? <Link to="/register" className="text-brand font-medium">Create an account</Link>
          </div>
          <div className="text-xs text-ink-muted bg-bg-alt rounded-md p-3">
            Demo: <span className="font-mono">demo@cottonhub.com</span> / <span className="font-mono">demo1234</span>
          </div>
        </form>
      </div>
    </div>
  );
}
