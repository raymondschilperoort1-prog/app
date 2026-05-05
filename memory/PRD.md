# CottonHub — Product Requirements Document

**Last updated:** Feb 2026
**Status:** MVP v1 live ✅

## Problem Statement
Global B2B marketplace for cotton trading — Vinted-style with integrated real-time chat, AI negotiation assistant, and CRC (CottonRecycleCoin) token story for circular textile economy. Users: buyers (sourcing), sellers (listing + closing), investors (market narrative), recyclers (CRC rewards).

## User Personas
- **Buyer** — apparel/textile brand sourcing raw cotton, yarn, or recycled fabric by origin, certification, MOQ.
- **Seller** — mill/farm/recycler listing product globally with certifications and Incoterms.
- **Investor** — evaluating marketplace economics (take-rate, GMV, network effects).
- **Recycler** — earning CRC for verified recycling activity.

## Core Requirements (static)
- Listings: title, product_type, origin, specs (GSM, fiber length, grade), MOQ, price/unit, certifications, Incoterms, description.
- Real-time chat per listing conversation (buyer ↔ seller), WebSocket + REST hybrid.
- AI assist (GPT-5.2) — reply, negotiate, optimize listing.
- JWT auth + user profiles with verification/ratings.
- CRC utility token narrative page.
- Earthy/natural design system (Satoshi + Work Sans, #2E4D3A brand, #C06A4A accent).

## Implemented (Feb 2026)
- ✅ Backend FastAPI + Mongo, JWT auth (pyjwt + bcrypt), seed data (3 users, 4 listings).
- ✅ `/api/auth/*`, `/api/listings` (CRUD + filters), `/api/conversations`, `/api/conversations/:id/messages`, `/api/ai/assist`, `/api/ws/:id?token=` WebSocket.
- ✅ Frontend pages: Landing, Marketplace (filters), Listing Detail, Create Listing (w/ Spark AI optimize), Chat (Vinted-style + WebSocket + Spark AI), Login, Register, CRC, Dashboard.
- ✅ GPT-5.2 via Emergent LLM key (emergentintegrations).
- ✅ Design guidelines followed: Satoshi/Work Sans fonts, earthy palette, asymmetric bento, chat bubble styling.
- ✅ Testing: 26/26 backend pytest passing; frontend renders all pages.

## Prioritized Backlog
**P0 (next)**
- Multi-image upload per listing (object storage).
- Seller profile page (/profile/:id) with active listings + reviews.

**P1**
- Ratings/reviews after closed deals.
- Stripe-based secure escrow for deposits.
- Rate-limit /api/ai/assist per user.

**P2**
- CRC wallet + on-chain provenance MVP.
- Multi-language (EN / IT / HI / CN).
- Logistics integration (Flexport / Maersk APIs).
- Admin verification dashboard.

## Test Credentials
See `/app/memory/test_credentials.md`.
