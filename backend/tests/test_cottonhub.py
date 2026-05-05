"""CottonHub backend API tests."""
import os
import uuid
import asyncio
import json
import pytest
import requests
import websockets

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://fiber-connect-io.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="module")
def buyer_token(s):
    r = s.post(f"{API}/auth/login", json={"email": "demo@cottonhub.com", "password": "demo1234"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def seller_token(s):
    r = s.post(f"{API}/auth/login", json={"email": "sara@greenfield.in", "password": "demo1234"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def auth(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---- Auth ----
def test_root(s):
    r = s.get(f"{API}/")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_register_and_me(s):
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/register", json={
        "email": email, "password": "pass1234", "full_name": "TEST User", "role": "buyer"
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and data["user"]["email"] == email
    me = s.get(f"{API}/auth/me", headers=auth(data["token"]))
    assert me.status_code == 200
    assert me.json()["email"] == email


def test_register_duplicate(s):
    r = s.post(f"{API}/auth/register", json={
        "email": "demo@cottonhub.com", "password": "demo1234", "full_name": "Dup"
    })
    assert r.status_code == 400


def test_login_demo_buyer(s, buyer_token):
    assert isinstance(buyer_token, str) and len(buyer_token) > 10


def test_login_invalid(s):
    r = s.post(f"{API}/auth/login", json={"email": "demo@cottonhub.com", "password": "wrong"})
    assert r.status_code == 401


def test_me_missing_token(s):
    r = s.get(f"{API}/auth/me")
    assert r.status_code == 401


def test_me_invalid_token(s):
    r = s.get(f"{API}/auth/me", headers={"Authorization": "Bearer bad.token.here"})
    assert r.status_code == 401


# ---- Listings ----
def test_listings_seeded(s):
    r = s.get(f"{API}/listings")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 4, f"Expected >=4 seeded listings, got {len(data)}"
    for l in data:
        assert "id" in l and "title" in l and "price_per_unit" in l
        assert "_id" not in l


def test_listings_filter_product_type(s):
    r = s.get(f"{API}/listings", params={"product_type": "yarn"})
    assert r.status_code == 200
    for l in r.json():
        assert l["product_type"] == "yarn"


def test_listings_filter_origin(s):
    r = s.get(f"{API}/listings", params={"origin": "India"})
    assert r.status_code == 200
    for l in r.json():
        assert l["origin"] == "India"


def test_listings_filter_certification(s):
    r = s.get(f"{API}/listings", params={"certification": "GOTS"})
    assert r.status_code == 200
    for l in r.json():
        assert "GOTS" in l["certifications"]


def test_listings_search_q(s):
    r = s.get(f"{API}/listings", params={"q": "organic"})
    assert r.status_code == 200
    assert len(r.json()) >= 1


def test_get_listing_by_id(s):
    lst = s.get(f"{API}/listings").json()
    lid = lst[0]["id"]
    r = s.get(f"{API}/listings/{lid}")
    assert r.status_code == 200
    assert r.json()["id"] == lid


def test_get_listing_404(s):
    r = s.get(f"{API}/listings/nonexistent-id-xyz")
    assert r.status_code == 404


def test_create_listing_auth_required(s):
    r = s.post(f"{API}/listings", json={"title": "x"})
    assert r.status_code in (401, 422)


def test_create_listing(s, seller_token):
    payload = {
        "title": "TEST_Cotton Yarn",
        "product_type": "yarn",
        "origin": "India",
        "moq": 100,
        "moq_unit": "kg",
        "price_per_unit": 2.5,
        "currency": "USD",
        "certifications": ["GOTS"],
        "incoterms": "FOB",
        "description": "Test listing",
    }
    r = s.post(f"{API}/listings", json=payload, headers=auth(seller_token))
    assert r.status_code == 200, r.text
    created = r.json()
    assert created["title"] == "TEST_Cotton Yarn"
    assert "id" in created and "_id" not in created
    # Verify persistence via GET
    g = s.get(f"{API}/listings/{created['id']}")
    assert g.status_code == 200
    assert g.json()["price_per_unit"] == 2.5


# ---- Conversations ----
@pytest.fixture(scope="module")
def conversation_id(s, buyer_token):
    listings = s.get(f"{API}/listings").json()
    seller_listing = next(l for l in listings if l["seller_name"] != "Demo Buyer")
    r = s.post(f"{API}/conversations", json={
        "listing_id": seller_listing["id"],
        "initial_message": "Hello, interested in your cotton."
    }, headers=auth(buyer_token))
    assert r.status_code == 200, r.text
    return r.json()["conversation_id"]


def test_conversation_created(conversation_id):
    assert conversation_id


def test_list_conversations(s, buyer_token, conversation_id):
    r = s.get(f"{API}/conversations", headers=auth(buyer_token))
    assert r.status_code == 200
    ids = [c["id"] for c in r.json()]
    assert conversation_id in ids


def test_get_conversation_messages(s, buyer_token, conversation_id):
    r = s.get(f"{API}/conversations/{conversation_id}", headers=auth(buyer_token))
    assert r.status_code == 200
    data = r.json()
    assert "conversation" in data and "messages" in data
    assert len(data["messages"]) >= 1


def test_send_message(s, buyer_token, conversation_id):
    r = s.post(f"{API}/conversations/{conversation_id}/messages",
               json={"text": "Can you do 1.80/kg?"}, headers=auth(buyer_token))
    assert r.status_code == 200
    assert r.json()["text"] == "Can you do 1.80/kg?"
    # Verify persistence
    g = s.get(f"{API}/conversations/{conversation_id}", headers=auth(buyer_token))
    texts = [m["text"] for m in g.json()["messages"]]
    assert "Can you do 1.80/kg?" in texts


def test_cannot_message_self(s, seller_token):
    listings = s.get(f"{API}/listings").json()
    own = next((l for l in listings if l["seller_name"] == "Sara Mehta"), None)
    assert own
    r = s.post(f"{API}/conversations", json={
        "listing_id": own["id"], "initial_message": "test"
    }, headers=auth(seller_token))
    assert r.status_code == 400


def test_conversation_forbidden(s, conversation_id):
    # register a stranger
    email = f"stranger_{uuid.uuid4().hex[:6]}@x.com"
    reg = s.post(f"{API}/auth/register", json={
        "email": email, "password": "pass1234", "full_name": "Stranger"
    }).json()
    r = s.get(f"{API}/conversations/{conversation_id}", headers=auth(reg["token"]))
    assert r.status_code == 403


# ---- AI Assist ----
def test_ai_assist_reply(s, buyer_token):
    r = s.post(f"{API}/ai/assist", json={
        "mode": "reply",
        "context": "Seller offered organic cotton at 1.95/kg, MOQ 5000kg FOB India.",
        "user_intent": "ask about samples and lead time"
    }, headers=auth(buyer_token), timeout=60)
    assert r.status_code == 200, r.text
    sug = r.json()["suggestion"]
    assert isinstance(sug, str) and len(sug.strip()) > 10


def test_ai_assist_negotiate(s, buyer_token):
    r = s.post(f"{API}/ai/assist", json={
        "mode": "negotiate",
        "context": "Price 1.95/kg, we want 1.70/kg for 10000kg order.",
    }, headers=auth(buyer_token), timeout=60)
    assert r.status_code == 200
    assert len(r.json()["suggestion"].strip()) > 10


# ---- WebSocket ----
def test_ws_invalid_token_rejected(conversation_id):
    ws_url = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")
    url = f"{ws_url}/api/ws/{conversation_id}?token=bad"
    async def run():
        try:
            async with websockets.connect(url) as ws:
                await ws.recv()
            return False
        except Exception:
            return True
    assert asyncio.run(run())


def test_ws_valid_token_connects(conversation_id, buyer_token):
    ws_url = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")
    url = f"{ws_url}/api/ws/{conversation_id}?token={buyer_token}"
    async def run():
        async with websockets.connect(url) as ws:
            await asyncio.sleep(0.3)
            return True
    assert asyncio.run(run())
