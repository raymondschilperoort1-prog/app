import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Header } from "../components/Header";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { api, wsUrl } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Sparkles, Send, ShieldCheck, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function Chat() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(conversationId || null);
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const wsRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  useEffect(() => {
    api.get("/conversations").then((r) => {
      setConversations(r.data);
      if (!activeId && r.data.length > 0) {
        setActiveId(r.data[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (conversationId) setActiveId(conversationId);
  }, [conversationId]);

  useEffect(() => {
    if (!activeId) return;
    api.get(`/conversations/${activeId}`).then((r) => {
      setActiveConvo(r.data.conversation);
      setMessages(r.data.messages);
    });
    // WS
    if (wsRef.current) { try { wsRef.current.close(); } catch {} }
    const ws = new WebSocket(wsUrl(activeId, token));
    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.type === "message") {
          setMessages((m) => {
            if (m.some((x) => x.id === data.message.id)) return m;
            return [...m, data.message];
          });
        }
      } catch {}
    };
    wsRef.current = ws;
    return () => { try { ws.close(); } catch {} };
  }, [activeId, token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    if (!text.trim() || !activeId) return;
    setSending(true);
    try {
      const res = await api.post(`/conversations/${activeId}/messages`, { text: text.trim() });
      setMessages((m) => (m.some((x) => x.id === res.data.id) ? m : [...m, res.data]));
      setText("");
    } catch (e) {
      toast.error("Failed to send");
    } finally { setSending(false); }
  };

  const aiAssist = async () => {
    if (!activeId) return;
    setAiLoading(true);
    try {
      const last = messages.slice(-6).map((m) => `${m.sender_name}: ${m.text}`).join("\n");
      const ctx = `Listing: ${activeConvo?.listing_title}\n\nConversation so far:\n${last || "(no messages yet)"}`;
      const res = await api.post("/ai/assist", {
        conversation_id: activeId,
        mode: "negotiate",
        context: ctx,
        user_intent: "Draft my next reply as the current user to move the deal forward professionally",
      });
      setText(res.data.suggestion);
      toast.success("Spark AI drafted your reply");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "AI assist failed");
    } finally { setAiLoading(false); }
  };

  const isMe = (m) => m.sender_id === user?.id;

  return (
    <div className="min-h-screen bg-bg-base flex flex-col">
      <Header />
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-9rem)]">
          {/* Thread list */}
          <aside className="bg-white border border-edge rounded-lg overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-edge">
              <div className="text-xs font-semibold tracking-widest uppercase text-ink-muted">Conversations</div>
              <h2 className="font-display text-lg font-semibold text-ink-primary">Inbox</h2>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {conversations.length === 0 && (
                <div className="p-6 text-sm text-ink-muted">
                  No conversations yet. <Link to="/marketplace" className="text-brand font-medium">Browse listings</Link>
                </div>
              )}
              {conversations.map((c) => {
                const active = c.id === activeId;
                const counterpart = c.buyer_id === user?.id ? c.seller_name : c.buyer_name;
                return (
                  <button
                    key={c.id}
                    data-testid={`convo-item-${c.id}`}
                    onClick={() => { setActiveId(c.id); navigate(`/chat/${c.id}`); }}
                    className={`w-full text-left px-5 py-4 border-b border-edge transition-colors ${
                      active ? "bg-bg-alt" : "hover:bg-bg-base"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-ink-primary truncate">{counterpart}</span>
                    </div>
                    <div className="text-xs text-ink-muted truncate mt-0.5">{c.listing_title}</div>
                    <div className="text-xs text-ink-secondary truncate mt-1">{c.last_message}</div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Conversation */}
          <section className="bg-white border border-edge rounded-lg flex flex-col overflow-hidden">
            {!activeConvo ? (
              <div className="flex-1 flex items-center justify-center text-ink-muted">Select a conversation</div>
            ) : (
              <>
                <div className="px-5 py-4 border-b border-edge flex items-center gap-3">
                  <button onClick={() => navigate("/chat")} className="md:hidden text-ink-muted"><ArrowLeft className="h-4 w-4" /></button>
                  {activeConvo.listing_image && (
                    <div className="h-10 w-10 rounded-md overflow-hidden bg-bg-alt">
                      <img src={activeConvo.listing_image} alt="" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-ink-primary truncate">{activeConvo.listing_title}</div>
                    <div className="text-xs text-ink-muted truncate">
                      with {activeConvo.buyer_id === user?.id ? activeConvo.seller_name : activeConvo.buyer_name}
                    </div>
                  </div>
                  <Link to={`/listings/${activeConvo.listing_id}`} className="text-xs text-brand font-medium hover:underline">View listing</Link>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-6 space-y-3 bg-bg-base">
                  {messages.map((m) => {
                    const mine = isMe(m);
                    return (
                      <div key={m.id} data-testid={`msg-${m.id}`} className={`flex ${mine ? "justify-end" : "justify-start"} chat-bubble-in`}>
                        <div className={`max-w-[78%] px-4 py-2.5 text-sm ${
                          mine
                            ? "bg-bg-alt text-ink-primary rounded-2xl rounded-br-sm"
                            : "bg-white border border-edge text-ink-primary rounded-2xl rounded-bl-sm"
                        }`}>
                          {!mine && <div className="text-[10px] font-semibold tracking-widest uppercase text-ink-muted mb-0.5">{m.sender_name}</div>}
                          <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>

                <div className="border-t border-edge p-4 bg-white">
                  <Textarea
                    data-testid="chat-input"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Write a message…"
                    className="min-h-[80px] bg-white border-edge resize-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                    }}
                  />
                  <div className="flex items-center justify-between mt-3 gap-2">
                    <Button
                      data-testid="ai-assist-btn"
                      type="button"
                      onClick={aiAssist}
                      disabled={aiLoading}
                      className="bg-brand-accent hover:bg-brand-accent-hover text-white rounded-full gap-2 h-9 px-4"
                    >
                      <Sparkles className="h-4 w-4" /> {aiLoading ? "Drafting…" : "Spark AI Assist"}
                    </Button>
                    <Button
                      data-testid="send-btn"
                      onClick={send}
                      disabled={sending || !text.trim()}
                      className="bg-brand hover:bg-brand-hover text-white gap-2"
                    >
                      <Send className="h-4 w-4" /> Send
                    </Button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
