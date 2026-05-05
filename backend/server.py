from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, WebSocket, WebSocketDisconnect, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import asyncio

from emergentintegrations.llm.chat import LlmChat, UserMessage
import random
import math
from collections import deque

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = "HS256"
EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']

app = FastAPI(title="CottonHub API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ===================== MODELS =====================

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    company_name: Optional[str] = None
    country: Optional[str] = None
    role: str = "both"  # buyer, seller, both


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: str
    email: str
    full_name: str
    company_name: Optional[str] = None
    country: Optional[str] = None
    role: str
    verified: bool = False
    rating: float = 0.0
    avatar_url: Optional[str] = None
    created_at: str


class ListingCreate(BaseModel):
    title: str
    product_type: str  # raw_cotton, recycled_cotton, yarn, fabric, blend
    origin: str
    fiber_length_mm: Optional[float] = None
    gsm: Optional[int] = None
    quality_grade: Optional[str] = None
    moq: float  # minimum order quantity
    moq_unit: str = "kg"
    price_per_unit: float
    currency: str = "USD"
    certifications: List[str] = []
    incoterms: str = "FOB"
    description: str
    image_url: Optional[str] = None


class Listing(ListingCreate):
    id: str
    seller_id: str
    seller_name: str
    seller_country: Optional[str] = None
    seller_verified: bool = False
    created_at: str
    status: str = "active"


class ConversationCreate(BaseModel):
    listing_id: str
    initial_message: str


class MessageCreate(BaseModel):
    text: str


class Message(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    sender_name: str
    text: str
    created_at: str


class Conversation(BaseModel):
    id: str
    listing_id: str
    listing_title: str
    listing_image: Optional[str] = None
    buyer_id: str
    buyer_name: str
    seller_id: str
    seller_name: str
    last_message: Optional[str] = None
    last_message_at: Optional[str] = None
    created_at: str


class AIAssistRequest(BaseModel):
    conversation_id: Optional[str] = None
    mode: str = "reply"  # reply, negotiate, optimize_listing
    context: str  # last few messages or listing description
    user_intent: Optional[str] = None  # what the user wants to achieve


class AIAssistResponse(BaseModel):
    suggestion: str


# ===================== AUTH HELPERS =====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def decode_token(token: str) -> str:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        return payload["sub"]
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing auth token")
    token = authorization.split(" ", 1)[1]
    user_id = decode_token(token)
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def user_to_public(u: dict) -> dict:
    return {
        "id": u["id"],
        "email": u["email"],
        "full_name": u["full_name"],
        "company_name": u.get("company_name"),
        "country": u.get("country"),
        "role": u.get("role", "both"),
        "verified": u.get("verified", False),
        "rating": u.get("rating", 0.0),
        "avatar_url": u.get("avatar_url"),
        "created_at": u["created_at"],
    }


# ===================== AUTH ENDPOINTS =====================

@api_router.post("/auth/register")
async def register(payload: UserRegister):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": user_id,
        "email": payload.email.lower(),
        "password_hash": hash_password(payload.password),
        "full_name": payload.full_name,
        "company_name": payload.company_name,
        "country": payload.country,
        "role": payload.role,
        "verified": False,
        "rating": 0.0,
        "avatar_url": None,
        "created_at": now,
    }
    await db.users.insert_one(doc)
    token = create_token(user_id)
    return {"token": token, "user": user_to_public(doc)}


@api_router.post("/auth/login")
async def login(payload: UserLogin):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(user["id"])
    return {"token": token, "user": user_to_public(user)}


@api_router.get("/auth/me")
async def me(current: dict = Depends(get_current_user)):
    return user_to_public(current)


# ===================== LISTING ENDPOINTS =====================

@api_router.get("/listings")
async def list_listings(
    q: Optional[str] = None,
    product_type: Optional[str] = None,
    origin: Optional[str] = None,
    certification: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    limit: int = 50,
):
    query: Dict = {"status": "active"}
    if product_type:
        query["product_type"] = product_type
    if origin:
        query["origin"] = origin
    if certification:
        query["certifications"] = certification
    if min_price is not None or max_price is not None:
        pr = {}
        if min_price is not None:
            pr["$gte"] = min_price
        if max_price is not None:
            pr["$lte"] = max_price
        query["price_per_unit"] = pr
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"origin": {"$regex": q, "$options": "i"}},
        ]
    cursor = db.listings.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
    return await cursor.to_list(length=limit)


@api_router.get("/listings/mine")
async def my_listings(current: dict = Depends(get_current_user)):
    cursor = db.listings.find({"seller_id": current["id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(length=200)


@api_router.get("/listings/{listing_id}")
async def get_listing(listing_id: str):
    listing = await db.listings.find_one({"id": listing_id}, {"_id": 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    return listing


@api_router.post("/listings")
async def create_listing(payload: ListingCreate, current: dict = Depends(get_current_user)):
    listing_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": listing_id,
        "seller_id": current["id"],
        "seller_name": current["full_name"],
        "seller_country": current.get("country"),
        "seller_verified": current.get("verified", False),
        "created_at": now,
        "status": "active",
        **payload.model_dump(),
    }
    await db.listings.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ===================== CONVERSATIONS & MESSAGES =====================

@api_router.post("/conversations")
async def start_conversation(payload: ConversationCreate, current: dict = Depends(get_current_user)):
    listing = await db.listings.find_one({"id": payload.listing_id}, {"_id": 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing["seller_id"] == current["id"]:
        raise HTTPException(status_code=400, detail="Cannot message yourself")

    # Check if a conversation already exists between this buyer & listing
    existing = await db.conversations.find_one(
        {"listing_id": payload.listing_id, "buyer_id": current["id"]}, {"_id": 0}
    )
    if existing:
        convo_id = existing["id"]
    else:
        convo_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        convo_doc = {
            "id": convo_id,
            "listing_id": payload.listing_id,
            "listing_title": listing["title"],
            "listing_image": listing.get("image_url"),
            "buyer_id": current["id"],
            "buyer_name": current["full_name"],
            "seller_id": listing["seller_id"],
            "seller_name": listing["seller_name"],
            "last_message": payload.initial_message,
            "last_message_at": now,
            "created_at": now,
        }
        await db.conversations.insert_one(convo_doc)

    # insert message
    msg_id = str(uuid.uuid4())
    msg_now = datetime.now(timezone.utc).isoformat()
    msg_doc = {
        "id": msg_id,
        "conversation_id": convo_id,
        "sender_id": current["id"],
        "sender_name": current["full_name"],
        "text": payload.initial_message,
        "created_at": msg_now,
    }
    await db.messages.insert_one(msg_doc)
    await db.conversations.update_one(
        {"id": convo_id},
        {"$set": {"last_message": payload.initial_message, "last_message_at": msg_now}},
    )
    msg_doc.pop("_id", None)
    return {"conversation_id": convo_id, "message": msg_doc}


@api_router.get("/conversations")
async def get_conversations(current: dict = Depends(get_current_user)):
    cursor = db.conversations.find(
        {"$or": [{"buyer_id": current["id"]}, {"seller_id": current["id"]}]}, {"_id": 0}
    ).sort("last_message_at", -1)
    return await cursor.to_list(length=200)


@api_router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str, current: dict = Depends(get_current_user)):
    convo = await db.conversations.find_one({"id": conversation_id}, {"_id": 0})
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if current["id"] not in (convo["buyer_id"], convo["seller_id"]):
        raise HTTPException(status_code=403, detail="Forbidden")
    msgs = await db.messages.find({"conversation_id": conversation_id}, {"_id": 0}).sort("created_at", 1).to_list(length=1000)
    return {"conversation": convo, "messages": msgs}


@api_router.post("/conversations/{conversation_id}/messages")
async def send_message(conversation_id: str, payload: MessageCreate, current: dict = Depends(get_current_user)):
    convo = await db.conversations.find_one({"id": conversation_id}, {"_id": 0})
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if current["id"] not in (convo["buyer_id"], convo["seller_id"]):
        raise HTTPException(status_code=403, detail="Forbidden")

    msg_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    msg_doc = {
        "id": msg_id,
        "conversation_id": conversation_id,
        "sender_id": current["id"],
        "sender_name": current["full_name"],
        "text": payload.text,
        "created_at": now,
    }
    await db.messages.insert_one(msg_doc)
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {"last_message": payload.text, "last_message_at": now}},
    )
    msg_doc.pop("_id", None)

    # broadcast to websocket subscribers
    await ws_manager.broadcast(conversation_id, {"type": "message", "message": msg_doc})
    return msg_doc


# ===================== AI ASSIST =====================

SYSTEM_PROMPT = """You are Spark, an AI assistant embedded inside CottonHub — a global B2B cotton trading marketplace.

You support professional buyer-seller communication in a Vinted-style chat.

Your job:
- Generate professional, deal-focused replies (direct, concise, no fluff).
- Help negotiate price, volume (MOQ), quality grade, Incoterms, and delivery timelines.
- Use bullet points where relevant.
- Suggest concrete next steps to close deals faster.
- For listing optimization: return a rewritten title + a persuasive, SEO-friendly description with clear specs.

Tone: Direct, Professional, Deal-focused. Never generic. Never apologetic.

Output only the suggested reply text — no preambles, no explanations, no markdown headers.
"""

@api_router.post("/ai/assist", response_model=AIAssistResponse)
async def ai_assist(payload: AIAssistRequest, current: dict = Depends(get_current_user)):
    session_id = payload.conversation_id or f"assist-{current['id']}"
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=SYSTEM_PROMPT,
    ).with_model("openai", "gpt-5.2")

    intent = payload.user_intent or "respond professionally and move the deal forward"
    mode_label = {
        "reply": "Draft a professional reply",
        "negotiate": "Draft a negotiation reply (price/volume/terms)",
        "optimize_listing": "Rewrite this listing title + description to maximize conversions",
    }.get(payload.mode, "Respond professionally")

    user_text = f"""MODE: {mode_label}
USER GOAL: {intent}

CONTEXT:
{payload.context}

Respond with only the suggested reply text."""
    try:
        suggestion = await chat.send_message(UserMessage(text=user_text))
        return AIAssistResponse(suggestion=suggestion.strip())
    except Exception as e:
        logger.exception("AI assist failed")
        raise HTTPException(status_code=500, detail=f"AI assist failed: {str(e)}")


# ===================== WEBSOCKET =====================

class WSManager:
    def __init__(self):
        self.rooms: Dict[str, List[WebSocket]] = {}
        self.lock = asyncio.Lock()

    async def connect(self, conversation_id: str, ws: WebSocket):
        await ws.accept()
        async with self.lock:
            self.rooms.setdefault(conversation_id, []).append(ws)

    async def disconnect(self, conversation_id: str, ws: WebSocket):
        async with self.lock:
            conns = self.rooms.get(conversation_id, [])
            if ws in conns:
                conns.remove(ws)

    async def broadcast(self, conversation_id: str, data: dict):
        async with self.lock:
            conns = list(self.rooms.get(conversation_id, []))
        for ws in conns:
            try:
                await ws.send_json(data)
            except Exception:
                pass


ws_manager = WSManager()


@api_router.websocket("/ws/{conversation_id}")
async def websocket_endpoint(websocket: WebSocket, conversation_id: str, token: str = Query(...)):
    try:
        user_id = decode_token(token)
    except HTTPException:
        await websocket.close(code=4401)
        return
    convo = await db.conversations.find_one({"id": conversation_id}, {"_id": 0})
    if not convo or user_id not in (convo["buyer_id"], convo["seller_id"]):
        await websocket.close(code=4403)
        return

    await ws_manager.connect(conversation_id, websocket)
    try:
        while True:
            # keep the connection alive; client can send pings or typed messages
            await websocket.receive_text()
    except WebSocketDisconnect:
        await ws_manager.disconnect(conversation_id, websocket)


# ===================== COTTON MARKET SIMULATOR =====================

class CottonMarketSimulator:
    """Deterministic random-walk simulator for cotton spot price ($/kg).

    Generates 1-year of daily candles, 30-day of hourly, and 24h of minute candles.
    Ticks forward every 60s in the background loop. When ALPHA_VANTAGE_KEY is set
    in .env, this can be replaced with a real fetcher in `tick()`.
    """

    def __init__(self):
        self.minute_candles = deque(maxlen=1440)
        self.hourly_candles = deque(maxlen=720)
        self.daily_candles = deque(maxlen=365)
        self.current_price = 1.95
        self.last_tick = None
        self.subscribers: List[WebSocket] = []
        self.sub_lock = asyncio.Lock()
        self._init_history()

    @staticmethod
    def _candle(t: datetime, o: float, h: float, l: float, c: float, v: int) -> dict:
        return {
            "t": int(t.timestamp() * 1000),
            "o": round(o, 4), "h": round(h, 4), "l": round(l, 4), "c": round(c, 4),
            "v": int(v),
        }

    def _init_history(self):
        rng = random.Random(2026_02)
        now = datetime.now(timezone.utc).replace(second=0, microsecond=0)

        # 1-year daily candles
        price = 1.78
        day_start = (now - timedelta(days=365)).replace(hour=0, minute=0)
        day_closes = []
        for i in range(365):
            day = day_start + timedelta(days=i)
            drift = 0.0003
            vol = 0.013
            seasonal = 0.0009 * math.sin((i / 365) * 2 * math.pi)
            change = rng.gauss(drift, vol) + seasonal
            o = price
            c = max(0.5, price * (1 + change))
            h = max(o, c) * (1 + abs(rng.gauss(0, 0.004)))
            l = min(o, c) * (1 - abs(rng.gauss(0, 0.004)))
            v = max(8000, int(rng.gauss(58000, 14000)))
            self.daily_candles.append(self._candle(day, o, h, l, c, v))
            day_closes.append(c)
            price = c

        # 30-day hourly candles (extrapolate from last 30 daily closes)
        rng_h = random.Random(2026_03)
        for d_idx in range(30):
            base = day_closes[-30 + d_idx]
            next_close = day_closes[-29 + d_idx] if d_idx < 29 else self.current_price
            for hour in range(24):
                t = (now - timedelta(days=30 - d_idx) + timedelta(hours=hour)).replace(minute=0)
                ratio = hour / 24
                center = base + (next_close - base) * ratio
                noise = rng_h.gauss(0, 0.003) * center
                o = center + rng_h.gauss(0, 0.002) * center
                c = center + noise
                h = max(o, c) + abs(rng_h.gauss(0, 0.002)) * center
                l = min(o, c) - abs(rng_h.gauss(0, 0.002)) * center
                v = max(500, int(rng_h.gauss(2400, 600)))
                self.hourly_candles.append(self._candle(t, o, h, l, c, v))

        # 24h minute candles
        rng_m = random.Random(2026_04)
        last_close = day_closes[-1]
        for minute in range(1440):
            t = now - timedelta(minutes=1440 - minute)
            change = rng_m.gauss(0, 0.0006) * last_close
            o = last_close
            c = last_close + change
            h = max(o, c) + abs(rng_m.gauss(0, 0.0004)) * last_close
            l = min(o, c) - abs(rng_m.gauss(0, 0.0004)) * last_close
            v = max(20, int(rng_m.gauss(45, 14)))
            self.minute_candles.append(self._candle(t, o, h, l, c, v))
            last_close = c

        self.current_price = last_close
        self.last_tick = now

    def tick(self) -> dict:
        """Advance simulator by one minute. Returns the latest candle."""
        now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
        rng = random.Random()
        prev_close = self.current_price
        change = rng.gauss(0, 0.0007) * prev_close
        o = prev_close
        c = max(0.3, prev_close + change)
        h = max(o, c) + abs(rng.gauss(0, 0.0005)) * prev_close
        l = min(o, c) - abs(rng.gauss(0, 0.0005)) * prev_close
        v = max(20, int(rng.gauss(48, 16)))
        candle = self._candle(now, o, h, l, c, v)
        self.minute_candles.append(candle)
        self.current_price = c
        self.last_tick = now

        # rebuild rolling hourly aggregate every 60 ticks
        if now.minute == 0:
            cutoff = now - timedelta(hours=1)
            window = [m for m in self.minute_candles if m["t"] >= int(cutoff.timestamp() * 1000)]
            if window:
                self.hourly_candles.append(self._candle(
                    now,
                    window[0]["o"],
                    max(m["h"] for m in window),
                    min(m["l"] for m in window),
                    window[-1]["c"],
                    sum(m["v"] for m in window),
                ))
        return candle

    def quote(self) -> dict:
        last = self.minute_candles[-1] if self.minute_candles else None
        first_24h = self.minute_candles[0] if self.minute_candles else None
        prev_close = first_24h["c"] if first_24h else self.current_price
        change = self.current_price - prev_close
        change_pct = (change / prev_close * 100) if prev_close else 0
        h24 = max((m["h"] for m in self.minute_candles), default=self.current_price)
        l24 = min((m["l"] for m in self.minute_candles), default=self.current_price)
        v24 = sum(m["v"] for m in self.minute_candles)
        return {
            "symbol": "COTTON",
            "price": round(self.current_price, 4),
            "change_24h": round(change, 4),
            "change_pct_24h": round(change_pct, 3),
            "high_24h": round(h24, 4),
            "low_24h": round(l24, 4),
            "volume_24h": v24,
            "currency": "USD",
            "unit": "kg",
            "ts": int((self.last_tick or datetime.now(timezone.utc)).timestamp() * 1000),
        }

    def history(self, range_key: str) -> List[dict]:
        if range_key == "1H":
            return list(self.minute_candles)[-60:]
        if range_key == "24H":
            # downsample 1440 → ~144 (every 10 min)
            arr = list(self.minute_candles)
            return arr[::10]
        if range_key == "7D":
            return list(self.hourly_candles)[-168:]
        if range_key == "30D":
            arr = list(self.hourly_candles)
            return arr[::3]  # every 3 hours
        if range_key == "1Y":
            return list(self.daily_candles)
        return list(self.minute_candles)[-60:]

    async def broadcast(self, payload: dict):
        async with self.sub_lock:
            conns = list(self.subscribers)
        for ws in conns:
            try:
                await ws.send_json(payload)
            except Exception:
                pass

    async def add_subscriber(self, ws: WebSocket):
        async with self.sub_lock:
            self.subscribers.append(ws)

    async def remove_subscriber(self, ws: WebSocket):
        async with self.sub_lock:
            if ws in self.subscribers:
                self.subscribers.remove(ws)


market_sim = CottonMarketSimulator()


async def market_loop():
    while True:
        try:
            await asyncio.sleep(60)
            candle = market_sim.tick()
            await market_sim.broadcast({"type": "tick", "candle": candle, "quote": market_sim.quote()})
            await evaluate_alerts(market_sim.current_price)
        except asyncio.CancelledError:
            break
        except Exception:
            logger.exception("market_loop error")


# ===================== MARKET ENDPOINTS =====================

@api_router.get("/market/cotton/quote")
async def market_quote():
    return market_sim.quote()


@api_router.get("/market/cotton/history")
async def market_history(range: str = "24H"):
    range_key = range.upper()
    if range_key not in {"1H", "24H", "7D", "30D", "1Y"}:
        raise HTTPException(status_code=400, detail="Invalid range")
    return {"range": range_key, "candles": market_sim.history(range_key)}


@api_router.get("/market/cotton/stats")
async def market_stats():
    q = market_sim.quote()
    minutes = list(market_sim.minute_candles)
    if len(minutes) > 1:
        rets = []
        for i in range(1, len(minutes)):
            p = minutes[i - 1]["c"]
            c = minutes[i]["c"]
            if p > 0:
                rets.append((c - p) / p)
        mean = sum(rets) / len(rets) if rets else 0
        var = sum((r - mean) ** 2 for r in rets) / len(rets) if rets else 0
        vol = math.sqrt(var) * math.sqrt(1440) * 100
    else:
        vol = 0
    return {**q, "volatility_24h_pct": round(vol, 3)}


# ===================== PRICE ALERTS =====================

class AlertCreate(BaseModel):
    direction: str  # 'above' or 'below'
    threshold: float


@api_router.post("/alerts")
async def create_alert(payload: AlertCreate, current: dict = Depends(get_current_user)):
    if payload.direction not in {"above", "below"}:
        raise HTTPException(status_code=400, detail="direction must be 'above' or 'below'")
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": current["id"],
        "symbol": "COTTON",
        "direction": payload.direction,
        "threshold": float(payload.threshold),
        "triggered": False,
        "triggered_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.alerts.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/alerts")
async def list_alerts(current: dict = Depends(get_current_user)):
    cursor = db.alerts.find({"user_id": current["id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(length=200)


@api_router.delete("/alerts/{alert_id}")
async def delete_alert(alert_id: str, current: dict = Depends(get_current_user)):
    res = await db.alerts.delete_one({"id": alert_id, "user_id": current["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"ok": True}


async def evaluate_alerts(price: float):
    cursor = db.alerts.find({"triggered": False}, {"_id": 0})
    alerts = await cursor.to_list(length=1000)
    now_iso = datetime.now(timezone.utc).isoformat()
    for a in alerts:
        triggered = (
            (a["direction"] == "above" and price >= a["threshold"]) or
            (a["direction"] == "below" and price <= a["threshold"])
        )
        if triggered:
            await db.alerts.update_one(
                {"id": a["id"]},
                {"$set": {"triggered": True, "triggered_at": now_iso}},
            )
            await market_sim.broadcast({
                "type": "alert",
                "alert": {**a, "triggered": True, "triggered_at": now_iso, "price": price},
            })


# ===================== MARKET WEBSOCKET =====================

@api_router.websocket("/market/ws")
async def market_ws(websocket: WebSocket):
    await websocket.accept()
    await market_sim.add_subscriber(websocket)
    try:
        # send snapshot
        await websocket.send_json({"type": "snapshot", "quote": market_sim.quote()})
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await market_sim.remove_subscriber(websocket)
    except Exception:
        await market_sim.remove_subscriber(websocket)


# ===================== SEED =====================

SEED_USERS = [
    {
        "email": "sara@greenfield.in",
        "password": "demo1234",
        "full_name": "Sara Mehta",
        "company_name": "Greenfield Organic Cotton",
        "country": "India",
        "role": "seller",
        "verified": True,
        "rating": 4.8,
        "avatar_url": "https://images.pexels.com/photos/36645466/pexels-photo-36645466.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
    },
    {
        "email": "marco@textilemill.it",
        "password": "demo1234",
        "full_name": "Marco Rossi",
        "company_name": "Rossi Textile Mills",
        "country": "Italy",
        "role": "both",
        "verified": True,
        "rating": 4.6,
        "avatar_url": "https://images.unsplash.com/photo-1629507208649-70919ca33793?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxNzV8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBidXNpbmVzcyUyMHBvcnRyYWl0fGVufDB8fHx8MTc3Nzk2MDIwMHww&ixlib=rb-4.1.0&q=85",
    },
    {
        "email": "demo@cottonhub.com",
        "password": "demo1234",
        "full_name": "Demo Buyer",
        "company_name": "DemoCo",
        "country": "Germany",
        "role": "buyer",
        "verified": False,
        "rating": 0.0,
        "avatar_url": None,
    },
]

SEED_LISTINGS_TEMPLATE = [
    {
        "title": "Organic Long-Staple Raw Cotton — Gujarat Premium",
        "product_type": "raw_cotton",
        "origin": "India",
        "fiber_length_mm": 32.5,
        "gsm": None,
        "quality_grade": "Premium",
        "moq": 5000,
        "moq_unit": "kg",
        "price_per_unit": 1.95,
        "currency": "USD",
        "certifications": ["GOTS", "Organic"],
        "incoterms": "FOB",
        "description": "Premium long-staple organic cotton sourced from Gujarat farms. Excellent for spinning fine yarns (40s-80s count). Hand-picked, GOTS certified, minimal contamination. Ready for export.",
        "image_url": "https://images.unsplash.com/photo-1762112464284-db2e871a9f4f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDN8MHwxfHNlYXJjaHwyfHxyYXclMjBjb3R0b24lMjBmaWVsZHxlbnwwfHx8fDE3Nzc5NjAyMDB8MA&ixlib=rb-4.1.0&q=85",
        "seller_email": "sara@greenfield.in",
    },
    {
        "title": "Recycled Cotton Yarn — Post-Industrial, 20/1 Ne",
        "product_type": "yarn",
        "origin": "Italy",
        "fiber_length_mm": None,
        "gsm": None,
        "quality_grade": "A",
        "moq": 2000,
        "moq_unit": "kg",
        "price_per_unit": 3.40,
        "currency": "USD",
        "certifications": ["GRS", "OEKO-TEX"],
        "incoterms": "CIF",
        "description": "20/1 Ne recycled cotton yarn, 60% recycled cotton blended with 40% recycled polyester. GRS certified. Ideal for circular-economy apparel brands.",
        "image_url": "https://images.pexels.com/photos/36320425/pexels-photo-36320425.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "seller_email": "marco@textilemill.it",
    },
    {
        "title": "Recycled Cotton Fabric — Heritage Denim Weave",
        "product_type": "fabric",
        "origin": "Italy",
        "fiber_length_mm": None,
        "gsm": 340,
        "quality_grade": "Premium",
        "moq": 1000,
        "moq_unit": "m",
        "price_per_unit": 6.80,
        "currency": "USD",
        "certifications": ["GRS"],
        "incoterms": "EXW",
        "description": "Indigo-dyed recycled cotton denim with heritage weave structure. 340 GSM, suitable for premium jeans and jackets. Short lead times for European buyers.",
        "image_url": "https://images.pexels.com/photos/36013228/pexels-photo-36013228.png?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "seller_email": "marco@textilemill.it",
    },
    {
        "title": "Combed Ring-Spun Cotton — 30s Count",
        "product_type": "yarn",
        "origin": "India",
        "fiber_length_mm": 29.0,
        "gsm": None,
        "quality_grade": "A",
        "moq": 3000,
        "moq_unit": "kg",
        "price_per_unit": 2.85,
        "currency": "USD",
        "certifications": ["OEKO-TEX"],
        "incoterms": "FOB",
        "description": "High-quality 30s combed ring-spun yarn. Consistent twist, low hairiness. Perfect for premium knit and woven garments.",
        "image_url": "https://images.unsplash.com/photo-1761069183877-fe29a212e5eb?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDN8MHwxfHNlYXJjaHwxfHxyYXclMjBjb3R0b24lMjBmaWVsZHxlbnwwfHx8fDE3Nzc5NjAyMDB8MA&ixlib=rb-4.1.0&q=85",
        "seller_email": "sara@greenfield.in",
    },
]


async def seed_if_empty():
    users_count = await db.users.count_documents({})
    if users_count == 0:
        for u in SEED_USERS:
            doc = {
                "id": str(uuid.uuid4()),
                "email": u["email"],
                "password_hash": hash_password(u["password"]),
                "full_name": u["full_name"],
                "company_name": u["company_name"],
                "country": u["country"],
                "role": u["role"],
                "verified": u["verified"],
                "rating": u["rating"],
                "avatar_url": u.get("avatar_url"),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.users.insert_one(doc)
        logger.info("Seeded %d users", len(SEED_USERS))

    listings_count = await db.listings.count_documents({})
    if listings_count == 0:
        for tmpl in SEED_LISTINGS_TEMPLATE:
            seller = await db.users.find_one({"email": tmpl["seller_email"]}, {"_id": 0})
            if not seller:
                continue
            doc = {
                "id": str(uuid.uuid4()),
                "seller_id": seller["id"],
                "seller_name": seller["full_name"],
                "seller_country": seller.get("country"),
                "seller_verified": seller.get("verified", False),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "status": "active",
                **{k: v for k, v in tmpl.items() if k != "seller_email"},
            }
            await db.listings.insert_one(doc)
        logger.info("Seeded %d listings", len(SEED_LISTINGS_TEMPLATE))


@app.on_event("startup")
async def on_startup():
    await seed_if_empty()
    asyncio.create_task(market_loop())


@api_router.get("/")
async def root():
    return {"service": "CottonHub API", "status": "ok"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
