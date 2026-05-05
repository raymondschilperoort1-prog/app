import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "../components/Header";
import { Button } from "../components/ui/button";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { ListingCard } from "../components/ListingCard";
import { MessageSquare, Package, Coins, Plus } from "lucide-react";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    api.get("/listings/mine").then((r) => setListings(r.data)).catch(() => {});
    api.get("/conversations").then((r) => setConversations(r.data)).catch(() => {});
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-bg-base">
      <Header />
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-10 md:py-14">
        <div className="flex flex-wrap items-end justify-between gap-6 mb-10">
          <div>
            <div className="text-xs font-semibold tracking-widest uppercase text-ink-muted mb-3">Dashboard</div>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-ink-primary">Welcome back, {user.full_name.split(" ")[0]}.</h1>
            <div className="mt-2 text-ink-secondary">{user.company_name && <span>{user.company_name} • </span>}{user.country}</div>
          </div>
          <Button data-testid="dash-new-listing" onClick={() => navigate("/create")} className="bg-brand hover:bg-brand-hover text-white gap-2">
            <Plus className="h-4 w-4" /> New listing
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          <StatCard testid="stat-listings" icon={<Package className="h-5 w-5" />} label="Active Listings" value={listings.length} />
          <StatCard testid="stat-chats" icon={<MessageSquare className="h-5 w-5" />} label="Active Chats" value={conversations.length} />
          <StatCard testid="stat-crc" icon={<Coins className="h-5 w-5" />} label="CRC Balance" value="0" accent />
        </div>

        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-semibold text-ink-primary">Your listings</h2>
            <Link to="/create" className="text-sm text-brand font-medium">+ Add</Link>
          </div>
          {listings.length === 0 ? (
            <div className="bg-white border border-edge rounded-lg p-10 text-center text-ink-muted">
              You haven't posted any listings yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-semibold text-ink-primary">Recent conversations</h2>
            <Link to="/chat" className="text-sm text-brand font-medium">Open inbox</Link>
          </div>
          <div className="bg-white border border-edge rounded-lg divide-y divide-edge">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-ink-muted">No conversations yet.</div>
            ) : conversations.slice(0, 5).map((c) => {
              const counterpart = c.buyer_id === user.id ? c.seller_name : c.buyer_name;
              return (
                <Link
                  key={c.id}
                  to={`/chat/${c.id}`}
                  data-testid={`dash-convo-${c.id}`}
                  className="flex items-center justify-between gap-4 p-5 hover:bg-bg-base transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-ink-primary truncate">{counterpart}</div>
                    <div className="text-sm text-ink-muted truncate">{c.listing_title}</div>
                    <div className="text-sm text-ink-secondary truncate mt-1">{c.last_message}</div>
                  </div>
                  <MessageSquare className="h-5 w-5 text-ink-muted" />
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

const StatCard = ({ testid, icon, label, value, accent }) => (
  <div data-testid={testid} className={`rounded-lg p-6 border ${accent ? "bg-brand text-white border-brand/30" : "bg-white border-edge"}`}>
    <div className={`h-10 w-10 rounded-md flex items-center justify-center mb-4 ${accent ? "bg-white/10 text-white" : "bg-bg-alt text-brand"}`}>{icon}</div>
    <div className={`text-xs font-semibold tracking-widest uppercase ${accent ? "text-white/70" : "text-ink-muted"}`}>{label}</div>
    <div className="font-display text-3xl font-bold mt-1">{value}</div>
  </div>
);
