# CottonHub — Product Requirements Document

**Last updated:** Feb 2026
**Status:** Phase 2 live ✅

## Problem Statement
Global B2B marketplace for cotton trading — Vinted-style with integrated real-time chat, AI negotiation assistant, CRC token narrative, and live commodity pricing dashboard.

## User Personas
- **Buyer** — apparel/textile brand sourcing raw cotton, yarn, or recycled fabric.
- **Seller** — mill/farm/recycler listing product globally.
- **Trader** — monitoring cotton spot prices, setting alerts, timing buys.
- **Investor** — evaluating marketplace economics + CRC token.
- **Recycler** — earning CRC for verified recycling.

## Core Requirements (static)
- Listings with full B2B specs + AI assist for replies/negotiation/optimization.
- Real-time chat (WebSocket) per listing conversation.
- JWT auth + user profiles with verification.
- CRC utility token narrative.
- **Live cotton commodity pricing dashboard** with charts, alerts, WebSocket tick stream.
- Earthy/natural design (Satoshi + Work Sans, brand #2E4D3A, accent #C06A4A).

## Implemented (Feb 2026)

### Phase 1 — Marketplace + Chat MVP
- ✅ Auth (JWT + bcrypt), seed data (3 users + 4 listings).
- ✅ Listings CRUD + filters; Conversations + Messages WebSocket.
- ✅ Spark AI assist (GPT-5.2 via Emergent LLM key) — reply / negotiate / optimize_listing.
- ✅ Pages: Landing, Marketplace, ListingDetail, CreateListing, Chat, Login, Register, CRC, Dashboard.
- ✅ 26/26 backend pytest passing.

### Phase 2 — Live Commodity Pricing Dashboard
- ✅ `CottonMarketSimulator` — deterministic 1Y daily / 30D hourly / 24H minute OHLC seed + 60s tick loop.
- ✅ `/api/market/cotton/quote`, `/history?range=...`, `/stats`.
- ✅ `/api/market/ws` public WebSocket — broadcasts `tick` + `alert` events.
- ✅ Price alerts: `POST/GET/DELETE /api/alerts` (JWT-protected, threshold>0 validated).
- ✅ Frontend `/trading` page — area/line/candle chart toggles, range selector (1H/24H/7D/30D/1Y), KPIs (high, low, volume, volatility), live ticker, alerts manager. Custom width hook replaces ResponsiveContainer.
- ✅ 18/18 backend pytest passing (Phase 2) + Phase 1 regression intact.

## Prioritized Backlog

**P0 (next phase candidates)**
- Admin Panel + Compliance: admin role, user management, KYC/blacklist, audit log, fraud flags, transaction monitoring.
- Trading System Upgrade: instant buy, escrow, Stripe payments, order tracking.
- CRC Token + Wallet: MetaMask connect, balance, mint-on-recycle, Polygon Mumbai testnet ERC-20.

**P1**
- Multi-image upload + object storage for listings.
- Seller public profile (`/profile/:id`) with reviews.
- Real Alpha Vantage integration (swap simulator) once API key available.
- Multi-language (EN / NL).

**P2**
- Factory/Recycling Reports module (CO₂, water savings, batches).
- AI price prediction (cotton trend forecasting).
- NFT certificates for recycled batches.
- Logistics integrations (Flexport / Maersk).
- Split server.py into modular routers (auth, listings, conversations, market, alerts).

## Test Credentials
See `/app/memory/test_credentials.md`.
