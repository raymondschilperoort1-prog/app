import React from "react";
import { Header } from "../components/Header";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Coins, Recycle, Shield, TrendingUp, ArrowRight } from "lucide-react";

const TEXTURE = "https://images.pexels.com/photos/36013228/pexels-photo-36013228.png?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

export default function CRC() {
  return (
    <div className="min-h-screen bg-bg-base">
      <Header />

      <section className="relative overflow-hidden border-b border-edge">
        <div className="absolute inset-0 opacity-10">
          <img src={TEXTURE} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 md:px-10 py-20 md:py-28">
          <div className="inline-flex items-center gap-2 bg-bg-alt border border-edge text-brand text-xs font-semibold tracking-widest uppercase px-3 py-1.5 rounded-full mb-6">
            <Coins className="h-3 w-3" /> CottonRecycleCoin
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-ink-primary leading-tight max-w-3xl">
            A utility token built on circular cotton flow.
          </h1>
          <p className="mt-6 text-lg text-ink-secondary max-w-2xl leading-relaxed">
            CRC is the native token of CottonHub — pegged to real cotton recycling activity.
            Pay marketplace fees, earn rewards for circular trade, and lock traceability to every bale.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 md:px-10 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: <Coins className="h-5 w-5" />, title: "Transactions", body: "Pay marketplace fees in CRC and get a 20% discount. Settle deals peer-to-peer." },
            { icon: <Recycle className="h-5 w-5" />, title: "Rewards", body: "Recyclers and circular-economy sellers earn CRC per verified kg processed." },
            { icon: <Shield className="h-5 w-5" />, title: "Traceability", body: "Every bale gets an on-chain provenance record tied to the CRC minted for it." },
            { icon: <TrendingUp className="h-5 w-5" />, title: "Staking", body: "Stake CRC to become a verifier or boost your listings in search." },
          ].map((f) => (
            <div key={f.title} className="bg-white border border-edge rounded-lg p-6 transition-all hover:-translate-y-1 hover:shadow-md">
              <div className="h-10 w-10 rounded-md bg-bg-alt flex items-center justify-center text-brand mb-4">{f.icon}</div>
              <h3 className="font-display text-lg font-semibold text-ink-primary">{f.title}</h3>
              <p className="mt-2 text-ink-secondary text-sm leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-bg-alt py-20">
        <div className="max-w-7xl mx-auto px-6 md:px-10 grid md:grid-cols-2 gap-12 items-start">
          <div>
            <div className="text-xs font-semibold tracking-widest uppercase text-ink-muted mb-3">Tokenomics</div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-ink-primary leading-tight">Designed for real usage, not speculation.</h2>
            <ul className="mt-6 space-y-3 text-ink-secondary">
              <li className="flex gap-3"><span className="mt-2 h-1 w-1 rounded-full bg-brand" /> 40% — Ecosystem rewards (recyclers, verifiers)</li>
              <li className="flex gap-3"><span className="mt-2 h-1 w-1 rounded-full bg-brand" /> 25% — Platform treasury & liquidity</li>
              <li className="flex gap-3"><span className="mt-2 h-1 w-1 rounded-full bg-brand" /> 20% — Founders & team (4-year vest)</li>
              <li className="flex gap-3"><span className="mt-2 h-1 w-1 rounded-full bg-brand" /> 10% — Strategic partners</li>
              <li className="flex gap-3"><span className="mt-2 h-1 w-1 rounded-full bg-brand" /> 5%  — Public allocation</li>
            </ul>
          </div>
          <div className="bg-white border border-edge rounded-lg p-6 md:p-8">
            <div className="text-xs font-semibold tracking-widest uppercase text-ink-muted mb-4">How CRC earns</div>
            <div className="space-y-5">
              <Step n="01" title="Cotton is recycled" body="Verified recycling facility processes post-industrial or post-consumer cotton." />
              <Step n="02" title="CRC is minted" body="Proportional CRC is minted against verified kg recycled and attributed to the facility + origin bale." />
              <Step n="03" title="CRC circulates" body="Buyers pay fees in CRC for discounts; brands buy CRC to show circular commitments." />
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 md:px-10 py-20 text-center">
        <h2 className="font-display text-3xl md:text-5xl font-bold text-ink-primary">Ready to join the loop?</h2>
        <p className="mt-4 text-ink-secondary">Start listing or sourcing — CRC-ready from day one.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/marketplace"><Button data-testid="crc-browse-btn" className="bg-brand hover:bg-brand-hover text-white gap-2">Browse marketplace <ArrowRight className="h-4 w-4" /></Button></Link>
          <Link to="/register"><Button data-testid="crc-register-btn" variant="outline" className="border-brand text-brand hover:bg-brand/5">Create account</Button></Link>
        </div>
      </section>
    </div>
  );
}

const Step = ({ n, title, body }) => (
  <div className="flex gap-4">
    <div className="font-display text-2xl font-bold text-brand-accent">{n}</div>
    <div>
      <div className="font-semibold text-ink-primary">{title}</div>
      <div className="text-sm text-ink-secondary">{body}</div>
    </div>
  </div>
);
