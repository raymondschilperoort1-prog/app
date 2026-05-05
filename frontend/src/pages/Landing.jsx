import React from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { ArrowRight, ShieldCheck, MessageSquare, Coins, Globe2, Sparkles, Leaf, TrendingUp } from "lucide-react";
import { Header } from "../components/Header";

const HERO_IMG = "https://images.unsplash.com/photo-1761069183877-fe29a212e5eb?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDN8MHwxfHNlYXJjaHwxfHxyYXclMjBjb3R0b24lMjBmaWVsZHxlbnwwfHx8fDE3Nzc5NjAyMDB8MA&ixlib=rb-4.1.0&q=85";
const CONTAINERS_IMG = "https://images.pexels.com/photos/3856433/pexels-photo-3856433.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

export default function Landing() {
  return (
    <div className="min-h-screen bg-bg-base">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={HERO_IMG} alt="Cotton field" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" />
          <div className="grain" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 md:px-10 py-24 md:py-36 lg:py-44">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-semibold tracking-widest uppercase px-3 py-1.5 rounded-full mb-8">
              <Leaf className="h-3 w-3" /> Circular Textile Trade
            </div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-7xl font-bold text-white leading-[1.05] tracking-tight">
              The global marketplace <br />
              for cotton that moves.
            </h1>
            <p className="mt-8 text-lg md:text-xl text-white/80 max-w-2xl leading-relaxed">
              Discover verified cotton suppliers. Negotiate in real-time. Close B2B deals
              with traceability built in — powered by the CottonRecycleCoin (CRC) ecosystem.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/marketplace">
                <Button
                  data-testid="hero-browse-btn"
                  size="lg"
                  className="bg-brand-accent hover:bg-brand-accent-hover text-white rounded-md px-7 py-6 text-base gap-2"
                >
                  Browse Marketplace <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/register">
                <Button
                  data-testid="hero-start-selling-btn"
                  size="lg"
                  variant="outline"
                  className="bg-white/5 border-white/30 text-white hover:bg-white/10 rounded-md px-7 py-6 text-base"
                >
                  Start Selling
                </Button>
              </Link>
            </div>
            <div className="mt-16 grid grid-cols-3 gap-8 max-w-xl">
              <Stat num="42+" label="Countries" />
              <Stat num="$18M" label="GMV traded" />
              <Stat num="1,200+" label="Verified suppliers" />
            </div>
          </div>
        </div>
      </section>

      {/* Value props bento */}
      <section className="max-w-7xl mx-auto px-6 md:px-10 py-20 md:py-28">
        <div className="flex items-end justify-between flex-wrap gap-6 mb-14">
          <div>
            <div className="text-xs font-semibold tracking-widest uppercase text-ink-muted mb-3">For Every Stakeholder</div>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-ink-primary max-w-2xl leading-tight">
              One platform. Three ways to win.
            </h2>
          </div>
          <p className="text-ink-secondary max-w-md">
            Whether you source, sell, or invest — CottonHub connects the whole supply chain with real-time chat and transparent pricing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <BentoCard
            testid="bento-buyers"
            className="md:col-span-7 md:row-span-2 bg-brand text-white"
            icon={<ShieldCheck className="h-5 w-5" />}
            label="Buyers"
            title="Source verified cotton without the phone tag."
            body="Filter by origin, certifications (GOTS, GRS, OEKO-TEX), MOQ, and price. Open a chat, negotiate Incoterms, and close deals in hours — not weeks."
            bullets={["Verified supplier profiles", "Certification transparency", "Price & MOQ comparison"]}
          />
          <BentoCard
            testid="bento-sellers"
            className="md:col-span-5"
            icon={<TrendingUp className="h-5 w-5" />}
            label="Sellers"
            title="List once. Sell globally."
            body="AI-assisted listings and replies help you convert inquiries into orders faster."
            bullets={["Spark AI reply assistant", "Global demand exposure"]}
          />
          <BentoCard
            testid="bento-investors"
            className="md:col-span-5"
            icon={<Globe2 className="h-5 w-5" />}
            label="Investors"
            title="Marketplace economics meet circular impact."
            body="Transaction-fee revenue, network effects, CRC token upside."
            bullets={["~5-8% take rate", "Liquidity flywheel"]}
          />
        </div>
      </section>

      {/* AI Chat preview */}
      <section className="bg-bg-alt py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-6 md:px-10 grid md:grid-cols-2 gap-14 items-center">
          <div>
            <div className="text-xs font-semibold tracking-widest uppercase text-ink-muted mb-4">Spark AI Assist</div>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-ink-primary leading-tight">
              Every message, deal-focused.
            </h2>
            <p className="mt-6 text-ink-secondary text-lg leading-relaxed max-w-lg">
              Powered by GPT-5.2. One click drafts a professional reply, counters a price offer,
              or rewrites your listing to convert more inquiries.
            </p>
            <div className="mt-8 flex gap-3">
              <Link to="/marketplace">
                <Button data-testid="ai-cta-btn" className="bg-brand hover:bg-brand-hover text-white gap-2">
                  <MessageSquare className="h-4 w-4" /> Try a live chat
                </Button>
              </Link>
            </div>
          </div>
          <div className="bg-white border border-edge rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 pb-4 border-b border-edge">
              <div className="h-10 w-10 rounded-full bg-bg-alt overflow-hidden">
                <img src="https://images.pexels.com/photos/36645466/pexels-photo-36645466.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" alt="seller" className="h-full w-full object-cover" />
              </div>
              <div>
                <div className="text-sm font-semibold text-ink-primary">Sara Mehta</div>
                <div className="text-xs text-ink-muted">Greenfield Organic Cotton • India</div>
              </div>
            </div>
            <div className="space-y-3 py-5">
              <div className="max-w-[75%] bg-white border border-edge rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-ink-primary">
                Hi Sara — interested in your 32mm GOTS cotton. Can you do $1.80/kg for 8,000kg, CIF Hamburg?
              </div>
              <div className="max-w-[75%] ml-auto bg-bg-alt rounded-2xl rounded-br-sm px-4 py-2.5 text-sm text-ink-primary">
                $1.85/kg is achievable for 8,000kg CIF Hamburg — 30% advance, balance against BL copy. Lead time 18 days. Shall I draft the PI?
              </div>
            </div>
            <div className="pt-4 border-t border-edge flex items-center justify-between">
              <span className="text-xs text-ink-muted">Suggested by Spark AI</span>
              <span className="inline-flex items-center gap-1.5 bg-brand-accent text-white rounded-full px-3 py-1 text-xs font-semibold">
                <Sparkles className="h-3 w-3" /> AI Assist
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* CRC banner */}
      <section className="max-w-7xl mx-auto px-6 md:px-10 py-20 md:py-28">
        <div className="relative overflow-hidden rounded-2xl bg-ink-primary text-white p-10 md:p-16">
          <div className="absolute inset-0 opacity-20">
            <img src={CONTAINERS_IMG} alt="containers" className="w-full h-full object-cover" />
          </div>
          <div className="relative grid md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white text-xs font-semibold tracking-widest uppercase px-3 py-1.5 rounded-full mb-6">
                <Coins className="h-3 w-3" /> CottonRecycleCoin
              </div>
              <h2 className="font-display text-3xl md:text-5xl font-bold leading-tight">
                The token that closes the loop.
              </h2>
              <p className="mt-6 text-white/80 leading-relaxed max-w-lg">
                CRC rewards recyclers, pays for transactions, and locks traceability to every bale.
                One utility token — real-world cotton flow.
              </p>
              <Link to="/crc">
                <Button data-testid="crc-learn-btn" className="mt-8 bg-brand-accent hover:bg-brand-accent-hover text-white">
                  Learn about CRC <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { k: "Transactions", v: "Pay fees in CRC — 20% discount" },
                { k: "Rewards", v: "Earn for recycling & circular flow" },
                { k: "Traceability", v: "On-chain proof of origin" },
                { k: "Staking", v: "Validators + marketplace boosts" },
              ].map((it) => (
                <div key={it.k} className="bg-white/5 border border-white/10 rounded-lg p-5">
                  <div className="text-xs font-semibold tracking-widest uppercase text-white/60 mb-2">{it.k}</div>
                  <div className="text-sm text-white/90">{it.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-edge py-10">
        <div className="max-w-7xl mx-auto px-6 md:px-10 text-sm text-ink-muted flex flex-wrap justify-between gap-4">
          <span>© 2026 CottonHub — A global B2B cotton marketplace.</span>
          <span>Built for traders. Powered by CRC.</span>
        </div>
      </footer>
    </div>
  );
}

const Stat = ({ num, label }) => (
  <div>
    <div className="font-display text-3xl md:text-4xl font-bold text-white">{num}</div>
    <div className="text-xs text-white/60 tracking-widest uppercase mt-1">{label}</div>
  </div>
);

const BentoCard = ({ testid, className = "", icon, label, title, body, bullets = [] }) => (
  <div
    data-testid={testid}
    className={`rounded-xl border border-edge p-8 md:p-10 flex flex-col gap-4 transition-all hover:-translate-y-0.5 ${
      className.includes("bg-brand") ? "border-brand/40" : "bg-white"
    } ${className}`}
  >
    <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase opacity-80">
      {icon} <span>{label}</span>
    </div>
    <h3 className="font-display text-2xl md:text-3xl font-bold leading-tight">{title}</h3>
    <p className={`leading-relaxed ${className.includes("text-white") ? "text-white/80" : "text-ink-secondary"}`}>{body}</p>
    {bullets.length > 0 && (
      <ul className="mt-2 space-y-1.5 text-sm">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2">
            <span className={`mt-1 h-1 w-1 rounded-full ${className.includes("text-white") ? "bg-white/60" : "bg-brand"}`} />
            {b}
          </li>
        ))}
      </ul>
    )}
  </div>
);
