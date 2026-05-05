import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "../components/Header";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

const TYPES = [
  { v: "raw_cotton", l: "Raw Cotton" },
  { v: "recycled_cotton", l: "Recycled Cotton" },
  { v: "yarn", l: "Yarn" },
  { v: "fabric", l: "Fabric" },
  { v: "blend", l: "Blend" },
];

const CERTS = ["GOTS", "GRS", "OEKO-TEX", "Organic", "Fair Trade", "BCI"];
const INCOTERMS = ["FOB", "CIF", "CFR", "EXW", "DAP", "DDP"];

export default function CreateListing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState({
    title: "",
    product_type: "raw_cotton",
    origin: "",
    fiber_length_mm: "",
    gsm: "",
    quality_grade: "",
    moq: "",
    moq_unit: "kg",
    price_per_unit: "",
    currency: "USD",
    certifications: [],
    incoterms: "FOB",
    description: "",
    image_url: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  if (!user) {
    navigate("/login");
    return null;
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleCert = (c) => {
    setForm((f) => ({
      ...f,
      certifications: f.certifications.includes(c)
        ? f.certifications.filter((x) => x !== c)
        : [...f.certifications, c],
    }));
  };

  const optimize = async () => {
    if (!form.title && !form.description) {
      toast.error("Add a title or description first.");
      return;
    }
    setOptimizing(true);
    try {
      const ctx = `Current title: ${form.title}\nCurrent description: ${form.description}\nType: ${form.product_type}\nOrigin: ${form.origin}\nCerts: ${form.certifications.join(", ")}\nMOQ: ${form.moq} ${form.moq_unit}\nPrice: $${form.price_per_unit}/${form.moq_unit}`;
      const res = await api.post("/ai/assist", {
        mode: "optimize_listing",
        context: ctx,
        user_intent: "Maximize conversion on a B2B cotton marketplace",
      });
      set("description", res.data.suggestion);
      toast.success("Listing optimized by Spark AI");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "AI optimization failed");
    } finally { setOptimizing(false); }
  };

  const submit = async () => {
    if (!form.title || !form.origin || !form.moq || !form.price_per_unit || !form.description) {
      toast.error("Please complete all required fields.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        moq: parseFloat(form.moq),
        price_per_unit: parseFloat(form.price_per_unit),
        fiber_length_mm: form.fiber_length_mm ? parseFloat(form.fiber_length_mm) : null,
        gsm: form.gsm ? parseInt(form.gsm) : null,
      };
      const res = await api.post("/listings", payload);
      toast.success("Listing created!");
      navigate(`/listings/${res.data.id}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to create listing");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-bg-base">
      <Header />
      <div className="max-w-3xl mx-auto px-6 md:px-10 py-10 md:py-14">
        <div className="mb-10">
          <div className="text-xs font-semibold tracking-widest uppercase text-ink-muted mb-3">New Listing</div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-ink-primary">Create a listing.</h1>
          <p className="mt-2 text-ink-secondary">Be specific — buyers filter on certifications, MOQ, and grade.</p>
        </div>

        <div className="bg-white border border-edge rounded-lg p-6 md:p-8 space-y-6">
          <Field label="Title" required>
            <Input data-testid="listing-title-input" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Organic Long-Staple Raw Cotton — Gujarat Premium" />
          </Field>
          <div className="grid md:grid-cols-2 gap-5">
            <Field label="Product Type" required>
              <Select value={form.product_type} onValueChange={(v) => set("product_type", v)}>
                <SelectTrigger data-testid="listing-type-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Origin (country)" required>
              <Input data-testid="listing-origin-input" value={form.origin} onChange={(e) => set("origin", e.target.value)} placeholder="India" />
            </Field>
            <Field label="Fiber Length (mm)">
              <Input data-testid="listing-fiber-input" type="number" value={form.fiber_length_mm} onChange={(e) => set("fiber_length_mm", e.target.value)} placeholder="32" />
            </Field>
            <Field label="GSM">
              <Input data-testid="listing-gsm-input" type="number" value={form.gsm} onChange={(e) => set("gsm", e.target.value)} placeholder="340" />
            </Field>
            <Field label="Quality Grade">
              <Input data-testid="listing-grade-input" value={form.quality_grade} onChange={(e) => set("quality_grade", e.target.value)} placeholder="Premium / A / B" />
            </Field>
            <Field label="Incoterms">
              <Select value={form.incoterms} onValueChange={(v) => set("incoterms", v)}>
                <SelectTrigger data-testid="listing-incoterms-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INCOTERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="MOQ" required>
              <div className="flex gap-2">
                <Input data-testid="listing-moq-input" type="number" value={form.moq} onChange={(e) => set("moq", e.target.value)} placeholder="5000" />
                <Select value={form.moq_unit} onValueChange={(v) => set("moq_unit", v)}>
                  <SelectTrigger data-testid="listing-moq-unit-select" className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="ton">ton</SelectItem>
                    <SelectItem value="m">m</SelectItem>
                    <SelectItem value="bale">bale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Field>
            <Field label="Price per unit (USD)" required>
              <Input data-testid="listing-price-input" type="number" step="0.01" value={form.price_per_unit} onChange={(e) => set("price_per_unit", e.target.value)} placeholder="1.95" />
            </Field>
          </div>

          <Field label="Certifications">
            <div className="flex flex-wrap gap-2">
              {CERTS.map((c) => {
                const active = form.certifications.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    data-testid={`create-cert-${c}`}
                    onClick={() => toggleCert(c)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded border transition-all ${
                      active ? "bg-brand text-white border-brand" : "bg-bg-alt text-brand border-edge hover:bg-bg-alt/70"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Image URL">
            <Input data-testid="listing-image-input" value={form.image_url} onChange={(e) => set("image_url", e.target.value)} placeholder="https://..." />
          </Field>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold tracking-widest uppercase text-ink-muted">Description <span className="text-brand-accent">*</span></Label>
              <Button
                data-testid="optimize-listing-btn"
                type="button"
                size="sm"
                onClick={optimize}
                disabled={optimizing}
                className="bg-brand-accent hover:bg-brand-accent-hover text-white rounded-full gap-1.5 h-8"
              >
                <Sparkles className="h-3 w-3" /> {optimizing ? "Optimizing…" : "Spark AI Optimize"}
              </Button>
            </div>
            <Textarea
              data-testid="listing-description-textarea"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Describe the product, quality, origin story, and why buyers should choose you."
              className="min-h-[160px]"
            />
          </div>

          <Button
            data-testid="submit-listing-btn"
            onClick={submit}
            disabled={submitting}
            className="w-full bg-brand hover:bg-brand-hover text-white"
          >
            {submitting ? "Publishing…" : "Publish listing"}
          </Button>
        </div>
      </div>
    </div>
  );
}

const Field = ({ label, required, children }) => (
  <div>
    <Label className="text-xs font-semibold tracking-widest uppercase text-ink-muted mb-2 block">
      {label} {required && <span className="text-brand-accent">*</span>}
    </Label>
    {children}
  </div>
);
