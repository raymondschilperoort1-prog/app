import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "../components/Header";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { MapPin, ShieldCheck, Package, Scale, Ruler, Award, Truck, MessageSquare, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const TYPE_LABELS = {
  raw_cotton: "Raw Cotton", recycled_cotton: "Recycled Cotton",
  yarn: "Yarn", fabric: "Fabric", blend: "Blend",
};

export default function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [listing, setListing] = useState(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.get(`/listings/${id}`).then((res) => setListing(res.data)).catch(() => {});
  }, [id]);

  const startChat = async () => {
    if (!user) { navigate("/login"); return; }
    if (!message.trim()) { toast.error("Please write a message first."); return; }
    setSending(true);
    try {
      const res = await api.post("/conversations", {
        listing_id: id,
        initial_message: message.trim(),
      });
      navigate(`/chat/${res.data.conversation_id}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to start chat");
    } finally { setSending(false); }
  };

  if (!listing) {
    return (
      <div className="min-h-screen bg-bg-base">
        <Header />
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-20 text-ink-muted">Loading…</div>
      </div>
    );
  }

  const Spec = ({ icon, label, value }) => (
    <div className="flex items-start gap-3 py-3 border-b border-edge last:border-b-0">
      <div className="text-ink-muted mt-0.5">{icon}</div>
      <div className="flex-1 flex justify-between gap-4">
        <span className="text-xs font-semibold tracking-widest uppercase text-ink-muted">{label}</span>
        <span className="text-sm font-medium text-ink-primary text-right">{value}</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg-base">
      <Header />
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-8 md:py-12">
        <button
          data-testid="back-to-marketplace"
          onClick={() => navigate("/marketplace")}
          className="flex items-center gap-2 text-sm text-ink-muted hover:text-ink-primary mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to marketplace
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-10">
          <div className="lg:sticky lg:top-20 self-start">
            <div className="aspect-[4/3] bg-white border border-edge rounded-lg overflow-hidden">
              {listing.image_url && (
                <img src={listing.image_url} alt={listing.title} className="h-full w-full object-cover" />
              )}
            </div>
            <div className="mt-5 bg-white border border-edge rounded-lg p-5">
              <div className="text-xs font-semibold tracking-widest uppercase text-ink-muted mb-2">Description</div>
              <p className="text-ink-secondary leading-relaxed">{listing.description}</p>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-ink-muted mb-3">
              <Package className="h-3 w-3" /> {TYPE_LABELS[listing.product_type]}
              <span className="text-edge">•</span>
              <MapPin className="h-3 w-3" /> {listing.origin}
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-ink-primary leading-tight">
              {listing.title}
            </h1>

            <div className="mt-6 flex items-end justify-between border-b border-edge pb-6">
              <div>
                <div className="text-xs text-ink-muted">Price</div>
                <div className="font-display text-4xl font-bold text-ink-primary">
                  ${listing.price_per_unit.toFixed(2)}
                  <span className="text-base font-normal text-ink-muted">/{listing.moq_unit}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-ink-muted">Min. Order</div>
                <div className="font-display text-2xl font-semibold text-ink-primary">
                  {listing.moq.toLocaleString()} <span className="text-sm text-ink-muted">{listing.moq_unit}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-white border border-edge rounded-lg px-5">
              {listing.fiber_length_mm && <Spec icon={<Ruler className="h-4 w-4" />} label="Fiber Length" value={`${listing.fiber_length_mm} mm`} />}
              {listing.gsm && <Spec icon={<Scale className="h-4 w-4" />} label="GSM" value={listing.gsm} />}
              {listing.quality_grade && <Spec icon={<Award className="h-4 w-4" />} label="Quality Grade" value={listing.quality_grade} />}
              <Spec icon={<Truck className="h-4 w-4" />} label="Incoterms" value={listing.incoterms} />
              <Spec icon={<Package className="h-4 w-4" />} label="Currency" value={listing.currency} />
            </div>

            {listing.certifications?.length > 0 && (
              <div className="mt-6">
                <div className="text-xs font-semibold tracking-widest uppercase text-ink-muted mb-3">Certifications</div>
                <div className="flex flex-wrap gap-2">
                  {listing.certifications.map((c) => (
                    <Badge key={c} className="bg-bg-alt text-brand border border-edge text-xs font-semibold px-3 py-1 rounded hover:bg-bg-alt">{c}</Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 bg-white border border-edge rounded-lg p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-bg-alt" />
              <div className="flex-1">
                <div className="font-semibold text-ink-primary">{listing.seller_name}</div>
                <div className="text-xs text-ink-muted">{listing.seller_country}</div>
              </div>
              {listing.seller_verified && (
                <span className="inline-flex items-center gap-1 text-brand text-xs font-semibold">
                  <ShieldCheck className="h-4 w-4" /> Verified
                </span>
              )}
            </div>

            <div className="mt-6 bg-white border border-edge rounded-lg p-5">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-ink-muted mb-3">
                <MessageSquare className="h-3 w-3" /> Contact Seller
              </div>
              <Textarea
                data-testid="initial-message-textarea"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hi — interested in this listing. Can we discuss volume and price?"
                className="bg-white border-edge min-h-[110px]"
              />
              <Button
                data-testid="contact-seller-btn"
                onClick={startChat}
                disabled={sending}
                className="mt-3 w-full bg-brand hover:bg-brand-hover text-white"
              >
                {sending ? "Opening chat…" : "Start conversation"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
