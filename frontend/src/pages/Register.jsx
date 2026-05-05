import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "../components/Header";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "", password: "", full_name: "", company_name: "", country: "", role: "both",
  });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form);
      toast.success("Welcome to CottonHub");
      navigate("/marketplace");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Registration failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-bg-base">
      <Header />
      <div className="max-w-md mx-auto px-6 py-16">
        <div className="text-xs font-semibold tracking-widest uppercase text-ink-muted mb-3">Get started</div>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-ink-primary">Create your account.</h1>
        <form onSubmit={submit} className="mt-8 bg-white border border-edge rounded-lg p-6 space-y-5">
          <div>
            <Label className="text-xs font-semibold tracking-widest uppercase text-ink-muted mb-2 block">Full name</Label>
            <Input data-testid="register-name" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} required />
          </div>
          <div>
            <Label className="text-xs font-semibold tracking-widest uppercase text-ink-muted mb-2 block">Email</Label>
            <Input data-testid="register-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
          </div>
          <div>
            <Label className="text-xs font-semibold tracking-widest uppercase text-ink-muted mb-2 block">Password</Label>
            <Input data-testid="register-password" type="password" value={form.password} onChange={(e) => set("password", e.target.value)} minLength={6} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold tracking-widest uppercase text-ink-muted mb-2 block">Company</Label>
              <Input data-testid="register-company" value={form.company_name} onChange={(e) => set("company_name", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-semibold tracking-widest uppercase text-ink-muted mb-2 block">Country</Label>
              <Input data-testid="register-country" value={form.country} onChange={(e) => set("country", e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold tracking-widest uppercase text-ink-muted mb-2 block">I am a</Label>
            <Select value={form.role} onValueChange={(v) => set("role", v)}>
              <SelectTrigger data-testid="register-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="buyer">Buyer</SelectItem>
                <SelectItem value="seller">Seller</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button data-testid="register-submit" type="submit" disabled={loading} className="w-full bg-brand hover:bg-brand-hover text-white">
            {loading ? "Creating account…" : "Create account"}
          </Button>
          <div className="text-sm text-ink-muted text-center">
            Have an account? <Link to="/login" className="text-brand font-medium">Log in</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
