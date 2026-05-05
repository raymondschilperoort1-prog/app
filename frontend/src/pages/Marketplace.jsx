import React, { useEffect, useState } from "react";
import { Header } from "../components/Header";
import { ListingCard } from "../components/ListingCard";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { api } from "../lib/api";
import { Search, SlidersHorizontal, X } from "lucide-react";

const TYPES = [
  { v: "", l: "All Types" },
  { v: "raw_cotton", l: "Raw Cotton" },
  { v: "recycled_cotton", l: "Recycled Cotton" },
  { v: "yarn", l: "Yarn" },
  { v: "fabric", l: "Fabric" },
  { v: "blend", l: "Blend" },
];

const CERTS = ["GOTS", "GRS", "OEKO-TEX", "Organic", "Fair Trade"];

export default function Marketplace() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [cert, setCert] = useState("");
  const [origin, setOrigin] = useState("");

  const load = async () => {
    setLoading(true);
    const params = {};
    if (q) params.q = q;
    if (type) params.product_type = type;
    if (cert) params.certification = cert;
    if (origin) params.origin = origin;
    const res = await api.get("/listings", { params });
    setListings(res.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const reset = () => {
    setQ(""); setType(""); setCert(""); setOrigin("");
    setTimeout(load, 0);
  };

  return (
    <div className="min-h-screen bg-bg-base">
      <Header />
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-10 md:py-14">
        <div className="mb-10">
          <div className="text-xs font-semibold tracking-widest uppercase text-ink-muted mb-3">Marketplace</div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-ink-primary">Find your next cotton supplier.</h1>
          <p className="mt-3 text-ink-secondary max-w-2xl">Verified suppliers. Transparent MOQs. Real-time negotiation.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
          {/* Filters */}
          <aside className="bg-white border border-edge rounded-lg p-6 h-fit sticky top-20">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-semibold text-ink-primary flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" /> Filters
              </h3>
              <button
                data-testid="reset-filters-btn"
                onClick={reset}
                className="text-xs text-ink-muted hover:text-ink-primary flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Reset
              </button>
            </div>
            <div className="space-y-5">
              <div>
                <label className="text-xs font-semibold tracking-widest uppercase text-ink-muted block mb-2">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
                  <Input
                    data-testid="filter-search-input"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="e.g. GOTS organic"
                    className="pl-9 bg-white border-edge"
                    onKeyDown={(e) => e.key === "Enter" && load()}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold tracking-widest uppercase text-ink-muted block mb-2">Product Type</label>
                <Select value={type || "all"} onValueChange={(v) => setType(v === "all" ? "" : v)}>
                  <SelectTrigger data-testid="filter-type-select" className="bg-white border-edge">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t.v || "all"} value={t.v || "all"}>{t.l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold tracking-widest uppercase text-ink-muted block mb-2">Origin</label>
                <Input
                  data-testid="filter-origin-input"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="e.g. India"
                  className="bg-white border-edge"
                  onKeyDown={(e) => e.key === "Enter" && load()}
                />
              </div>
              <div>
                <label className="text-xs font-semibold tracking-widest uppercase text-ink-muted block mb-2">Certification</label>
                <div className="flex flex-wrap gap-1.5">
                  {CERTS.map((c) => {
                    const active = cert === c;
                    return (
                      <button
                        key={c}
                        data-testid={`cert-chip-${c}`}
                        onClick={() => setCert(active ? "" : c)}
                        className={`text-[11px] font-semibold tracking-wide px-2.5 py-1 rounded border transition-all ${
                          active
                            ? "bg-brand text-white border-brand"
                            : "bg-bg-alt text-brand border-edge hover:bg-bg-alt/70"
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Button
                data-testid="apply-filters-btn"
                onClick={load}
                className="w-full bg-brand hover:bg-brand-hover text-white"
              >
                Apply filters
              </Button>
            </div>
          </aside>

          {/* Listings grid */}
          <main>
            <div className="flex items-center justify-between mb-5">
              <div className="text-sm text-ink-muted" data-testid="results-count">
                {loading ? "Loading…" : `${listings.length} result${listings.length === 1 ? "" : "s"}`}
              </div>
            </div>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="aspect-[4/3] bg-white border border-edge rounded-lg animate-pulse" />
                ))}
              </div>
            ) : listings.length === 0 ? (
              <div className="bg-white border border-edge rounded-lg p-12 text-center">
                <div className="text-ink-muted">No listings match your filters.</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {listings.map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
