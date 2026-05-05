import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Header } from "../components/Header";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { api, BACKEND_URL } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { TrendingUp, TrendingDown, Bell, BellRing, Trash2, Activity, BarChart3, LineChart as LineIcon, CandlestickChart } from "lucide-react";
import {
  ComposedChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from "recharts";
import { toast } from "sonner";

const useElementWidth = () => {
  const ref = useRef(null);
  const [width, setWidth] = useState(800);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const update = () => {
      if (ref.current) setWidth(ref.current.getBoundingClientRect().width);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(ref.current);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);
  return [ref, Math.max(300, Math.floor(width))];
};

const RANGES = [
  { v: "1H", l: "1H" },
  { v: "24H", l: "24H" },
  { v: "7D", l: "7D" },
  { v: "30D", l: "30D" },
  { v: "1Y", l: "1Y" },
];

const fmtTime = (ms, range) => {
  const d = new Date(ms);
  if (range === "1Y" || range === "30D") return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (range === "7D") return d.toLocaleDateString(undefined, { weekday: "short" }) + " " + d.getHours() + "h";
  if (range === "24H") return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
};

const Candle = (props) => {
  const { x, y, width, height, payload } = props;
  if (!payload) return null;
  const { o, h, l, c } = payload;
  const up = c >= o;
  const color = up ? "#3B5C47" : "#9E473D";
  // y/height map to (h..l) range. Need to map o/c using same scale.
  const range = h - l || 0.0001;
  const top = y;
  const bottom = y + height;
  const yOf = (val) => top + ((h - val) / range) * height;
  const yo = yOf(o);
  const yc = yOf(c);
  const bodyTop = Math.min(yo, yc);
  const bodyH = Math.max(1, Math.abs(yc - yo));
  const cx = x + width / 2;
  const bodyW = Math.max(2, width * 0.6);
  return (
    <g stroke={color} fill={color}>
      <line x1={cx} x2={cx} y1={top} y2={bottom} strokeWidth={1} />
      <rect x={cx - bodyW / 2} y={bodyTop} width={bodyW} height={bodyH} />
    </g>
  );
};

export default function Trading() {
  const { user, token } = useAuth();
  const [chartWrapRef, chartWidth] = useElementWidth();
  const [range, setRange] = useState("24H");
  const [chartType, setChartType] = useState("area");
  const [candles, setCandles] = useState([]);
  const [quote, setQuote] = useState(null);
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [alertDir, setAlertDir] = useState("above");
  const [alertVal, setAlertVal] = useState("");
  const [ticker, setTicker] = useState([]);
  const wsRef = useRef(null);

  const loadHistory = async (r = range) => {
    const res = await api.get("/market/cotton/history", { params: { range: r } });
    setCandles(res.data.candles);
  };

  const loadQuote = async () => {
    const [q, s] = await Promise.all([
      api.get("/market/cotton/quote"),
      api.get("/market/cotton/stats"),
    ]);
    setQuote(q.data);
    setStats(s.data);
  };

  const loadAlerts = async () => {
    if (!user) return;
    try {
      const r = await api.get("/alerts");
      setAlerts(r.data);
    } catch {}
  };

  useEffect(() => {
    loadQuote();
    loadHistory();
    loadAlerts();
  }, []);

  useEffect(() => {
    loadHistory(range);
  }, [range]);

  // WebSocket subscription
  useEffect(() => {
    const wsBase = BACKEND_URL.replace(/^http/, "ws");
    const ws = new WebSocket(`${wsBase}/api/market/ws`);
    wsRef.current = ws;
    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.type === "snapshot") {
          setQuote(data.quote);
        } else if (data.type === "tick") {
          setQuote(data.quote);
          setTicker((t) => [{ ts: data.candle.t, price: data.candle.c }, ...t].slice(0, 12));
          // append to chart only if currently viewing 1H/24H
          if (range === "1H" || range === "24H") {
            setCandles((cs) => {
              const next = [...cs, data.candle];
              return range === "1H" ? next.slice(-60) : next.slice(-144);
            });
          }
        } else if (data.type === "alert") {
          toast.success(`Alert triggered: cotton ${data.alert.direction} $${data.alert.threshold}/kg`);
          loadAlerts();
        }
      } catch {}
    };
    return () => { try { ws.close(); } catch {} };
    // eslint-disable-next-line
  }, [range]);

  const createAlert = async () => {
    if (!user) { toast.error("Please log in to create alerts"); return; }
    const v = parseFloat(alertVal);
    if (!v || v <= 0) { toast.error("Enter a valid price"); return; }
    try {
      await api.post("/alerts", { direction: alertDir, threshold: v });
      toast.success("Alert created");
      setAlertVal("");
      loadAlerts();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to create alert");
    }
  };

  const deleteAlert = async (id) => {
    await api.delete(`/alerts/${id}`);
    loadAlerts();
  };

  const data = useMemo(() => candles.map((c) => ({ ...c })), [candles]);
  const minPrice = useMemo(() => (data.length ? Math.min(...data.map((d) => d.l)) : 0), [data]);
  const maxPrice = useMemo(() => (data.length ? Math.max(...data.map((d) => d.h)) : 0), [data]);
  const yDomain = [Math.max(0, minPrice * 0.998), maxPrice * 1.002];

  const isUp = (quote?.change_24h ?? 0) >= 0;

  return (
    <div className="min-h-screen bg-bg-base">
      <Header />
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-10">
        {/* Header strip */}
        <div className="flex flex-wrap items-end justify-between gap-6 mb-8">
          <div>
            <div className="text-xs font-semibold tracking-widest uppercase text-ink-muted mb-3">Live Market</div>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-ink-primary">Cotton Spot Index</h1>
            <p className="mt-1 text-ink-secondary text-sm">Updated every 60 seconds • USD / kg</p>
          </div>
          {quote && (
            <div className="flex items-end gap-6">
              <div>
                <div className="text-xs text-ink-muted">Price</div>
                <div className="font-display text-4xl font-bold text-ink-primary">${quote.price.toFixed(4)}</div>
              </div>
              <div className={`flex items-center gap-1.5 text-base font-semibold ${isUp ? "text-[#3B5C47]" : "text-[#9E473D]"}`}>
                {isUp ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                <span data-testid="quote-change-pct">
                  {isUp ? "+" : ""}{quote.change_pct_24h?.toFixed(2)}%
                </span>
                <span className="text-sm font-normal text-ink-muted ml-1">24h</span>
              </div>
            </div>
          )}
        </div>

        {/* KPI tiles */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <KPI testid="kpi-high" label="24h High" value={`$${stats.high_24h.toFixed(4)}`} />
            <KPI testid="kpi-low" label="24h Low" value={`$${stats.low_24h.toFixed(4)}`} />
            <KPI testid="kpi-vol" label="24h Volume" value={stats.volume_24h.toLocaleString()} unit="lots" />
            <KPI testid="kpi-volatility" label="Volatility 24h" value={`${stats.volatility_24h_pct.toFixed(2)}%`} accent />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Chart panel */}
          <div className="bg-ink-primary text-white rounded-lg border border-ink-primary overflow-hidden min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-white/10">
              <div className="flex gap-1">
                {RANGES.map((r) => (
                  <button
                    key={r.v}
                    data-testid={`range-${r.v}`}
                    onClick={() => setRange(r.v)}
                    className={`text-xs font-semibold tracking-wider px-3 py-1.5 rounded-md transition-colors ${
                      range === r.v ? "bg-brand-accent text-white" : "text-white/70 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {r.l}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {[
                  { v: "area", icon: <Activity className="h-3.5 w-3.5" /> },
                  { v: "line", icon: <LineIcon className="h-3.5 w-3.5" /> },
                  { v: "candle", icon: <CandlestickChart className="h-3.5 w-3.5" /> },
                ].map((t) => (
                  <button
                    key={t.v}
                    data-testid={`chart-${t.v}`}
                    onClick={() => setChartType(t.v)}
                    className={`p-1.5 rounded-md transition-colors ${
                      chartType === t.v ? "bg-white/10 text-white" : "text-white/60 hover:text-white"
                    }`}
                  >
                    {t.icon}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-2 md:p-4" ref={chartWrapRef}>
              <div>
                <ComposedChart width={chartWidth - 16} height={360} data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#C06A4A" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#C06A4A" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis
                      dataKey="t"
                      tickFormatter={(t) => fmtTime(t, range)}
                      stroke="rgba(255,255,255,0.4)"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                      interval="preserveStartEnd"
                      minTickGap={50}
                    />
                    <YAxis
                      domain={yDomain}
                      orientation="right"
                      stroke="rgba(255,255,255,0.4)"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `$${v.toFixed(3)}`}
                      tickLine={false}
                      axisLine={false}
                      width={60}
                    />
                    <Tooltip
                      contentStyle={{ background: "#22392B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff" }}
                      labelFormatter={(t) => fmtTime(t, range)}
                      formatter={(v, name) => [typeof v === "number" ? `$${v.toFixed(4)}` : v, name.toUpperCase()]}
                    />
                    {chartType === "area" && (
                      <Area type="monotone" dataKey="c" stroke="#C06A4A" strokeWidth={2} fill="url(#priceGrad)" dot={false} />
                    )}
                    {chartType === "line" && (
                      <Line type="monotone" dataKey="c" stroke="#C06A4A" strokeWidth={2} dot={false} />
                    )}
                    {chartType === "candle" && (
                      <Bar dataKey="h" shape={<Candle />} isAnimationActive={false}>
                        {data.map((entry, i) => (
                          <Cell key={i} fill={entry.c >= entry.o ? "#3B5C47" : "#9E473D"} />
                        ))}
                      </Bar>
                    )}
                    {quote && (
                      <ReferenceLine y={quote.price} stroke="#C06A4A" strokeDasharray="3 3" strokeOpacity={0.5} />
                    )}
                  </ComposedChart>
              </div>

              {/* Volume chart */}
              <div className="mt-2">
                <ComposedChart width={chartWidth - 16} height={80} data={data} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <XAxis dataKey="t" hide />
                  <YAxis orientation="right" tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.3)" tickLine={false} axisLine={false} width={60} />
                  <Tooltip
                    contentStyle={{ background: "#22392B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff" }}
                    labelFormatter={(t) => fmtTime(t, range)}
                  />
                  <Bar dataKey="v" fill="rgba(255,255,255,0.18)" />
                </ComposedChart>
              </div>
            </div>
          </div>

          {/* Sidebar: live ticker + alerts */}
          <aside className="space-y-4">
            <div className="bg-white border border-edge rounded-lg p-5">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-ink-muted mb-4">
                <BarChart3 className="h-3.5 w-3.5" /> Live Ticker
              </div>
              {ticker.length === 0 ? (
                <div className="text-sm text-ink-muted">Waiting for next tick…</div>
              ) : (
                <ul className="space-y-2 text-sm">
                  {ticker.map((t, i) => (
                    <li key={`${t.ts}-${i}`} data-testid={`ticker-${i}`} className="flex justify-between border-b border-edge last:border-b-0 pb-1.5">
                      <span className="text-ink-muted text-xs">{new Date(t.ts).toLocaleTimeString()}</span>
                      <span className="font-mono font-semibold text-ink-primary">${t.price.toFixed(4)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white border border-edge rounded-lg p-5">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-ink-muted mb-4">
                <Bell className="h-3.5 w-3.5" /> Price Alerts
              </div>
              {!user ? (
                <div className="text-sm text-ink-muted">Log in to create price alerts.</div>
              ) : (
                <>
                  <div className="flex gap-2 mb-3">
                    <Select value={alertDir} onValueChange={setAlertDir}>
                      <SelectTrigger data-testid="alert-direction" className="w-[110px] bg-white border-edge"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="above">Above</SelectItem>
                        <SelectItem value="below">Below</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      data-testid="alert-threshold"
                      type="number"
                      step="0.0001"
                      placeholder="$/kg"
                      value={alertVal}
                      onChange={(e) => setAlertVal(e.target.value)}
                      className="bg-white border-edge"
                    />
                    <Button data-testid="create-alert-btn" onClick={createAlert} className="bg-brand hover:bg-brand-hover text-white">Add</Button>
                  </div>
                  <ul className="space-y-2">
                    {alerts.length === 0 && <li className="text-sm text-ink-muted">No alerts yet.</li>}
                    {alerts.map((a) => (
                      <li key={a.id} data-testid={`alert-${a.id}`} className="flex items-center justify-between gap-2 text-sm border border-edge rounded-md px-3 py-2">
                        <div className="flex items-center gap-2">
                          {a.triggered ? (
                            <BellRing className="h-3.5 w-3.5 text-brand-accent" />
                          ) : (
                            <Bell className="h-3.5 w-3.5 text-ink-muted" />
                          )}
                          <span>
                            <span className="font-medium">{a.direction}</span> ${a.threshold.toFixed(4)}
                          </span>
                          {a.triggered && <Badge className="bg-bg-alt text-brand-accent border-edge text-[10px] hover:bg-bg-alt">Hit</Badge>}
                        </div>
                        <button onClick={() => deleteAlert(a.id)} className="text-ink-muted hover:text-ink-primary" data-testid={`delete-alert-${a.id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

const KPI = ({ testid, label, value, unit, accent }) => (
  <div data-testid={testid} className={`rounded-lg border p-5 ${accent ? "bg-brand text-white border-brand/30" : "bg-white border-edge"}`}>
    <div className={`text-xs font-semibold tracking-widest uppercase mb-1 ${accent ? "text-white/70" : "text-ink-muted"}`}>{label}</div>
    <div className="font-display text-2xl font-bold flex items-baseline gap-1">
      {value} {unit && <span className={`text-xs font-normal ${accent ? "text-white/70" : "text-ink-muted"}`}>{unit}</span>}
    </div>
  </div>
);
