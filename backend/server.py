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
