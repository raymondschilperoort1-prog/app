"""Phase 2 tests — Cotton Market endpoints, WebSocket, and Alerts."""
import os
import asyncio
import json
import pytest
import requests
import websockets

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://fiber-connect-io.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"
WS_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")


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


def auth(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------------- Market: Quote ----------------
def test_market_quote(s):
    r = s.get(f"{API}/market/cotton/quote")
    assert r.status_code == 200, r.text
    q = r.json()
    for k in ["symbol", "price", "change_24h", "change_pct_24h", "high_24h", "low_24h", "volume_24h", "currency", "unit", "ts"]:
        assert k in q, f"missing {k}"
    assert q["symbol"] == "COTTON"
    assert isinstance(q["price"], (int, float)) and q["price"] > 0
    assert q["currency"] == "USD" and q["unit"] == "kg"
    assert q["high_24h"] >= q["low_24h"]
    assert q["volume_24h"] >= 0


# ---------------- Market: History ----------------
@pytest.mark.parametrize("rng,expected_min,expected_max", [
    ("1H", 55, 65),
    ("24H", 140, 148),
    ("7D", 160, 172),
    ("30D", 235, 245),
    ("1Y", 360, 370),
])
def test_market_history_counts(s, rng, expected_min, expected_max):
    r = s.get(f"{API}/market/cotton/history", params={"range": rng})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["range"] == rng
    candles = body["candles"]
    assert isinstance(candles, list)
    assert expected_min <= len(candles) <= expected_max, f"{rng} got {len(candles)} candles"
    # Every candle shape
    for c in candles[:5]:
        for k in ["t", "o", "h", "l", "c", "v"]:
            assert k in c, f"candle missing {k}"
        assert c["h"] >= c["l"]
        assert isinstance(c["t"], int)


def test_market_history_lowercase_accepted(s):
    # server upper-cases input
    r = s.get(f"{API}/market/cotton/history", params={"range": "1h"})
    assert r.status_code == 200
    assert r.json()["range"] == "1H"


def test_market_history_invalid_range(s):
    r = s.get(f"{API}/market/cotton/history", params={"range": "BAD"})
    assert r.status_code == 400


# ---------------- Market: Stats ----------------
def test_market_stats(s):
    r = s.get(f"{API}/market/cotton/stats")
    assert r.status_code == 200, r.text
    data = r.json()
    # Must include quote fields + volatility
    for k in ["price", "high_24h", "low_24h", "volume_24h", "volatility_24h_pct"]:
        assert k in data, f"stats missing {k}"
    assert isinstance(data["volatility_24h_pct"], (int, float))
    assert data["volatility_24h_pct"] >= 0


# ---------------- WebSocket: Market ----------------
def test_market_ws_connect_and_snapshot():
    url = f"{WS_BASE}/api/market/ws"
    async def run():
        async with websockets.connect(url, open_timeout=10) as ws:
            frame = await asyncio.wait_for(ws.recv(), timeout=10)
            data = json.loads(frame)
            assert data.get("type") == "snapshot"
            assert "quote" in data
            q = data["quote"]
            assert q.get("symbol") == "COTTON"
            assert "price" in q
            return True
    assert asyncio.run(run())


# ---------------- Alerts ----------------
def test_create_alert_requires_auth(s):
    r = s.post(f"{API}/alerts", json={"direction": "above", "threshold": 2.0})
    assert r.status_code == 401


def test_create_alert_invalid_direction(s, buyer_token):
    r = s.post(f"{API}/alerts", json={"direction": "sideways", "threshold": 2.0}, headers=auth(buyer_token))
    assert r.status_code == 400


def test_create_list_delete_alert(s, buyer_token):
    # Create above
    r = s.post(f"{API}/alerts", json={"direction": "above", "threshold": 9.99}, headers=auth(buyer_token))
    assert r.status_code == 200, r.text
    created = r.json()
    assert created["direction"] == "above"
    assert created["threshold"] == 9.99
    assert created["triggered"] is False
    assert created["user_id"]
    assert "_id" not in created
    alert_id = created["id"]

    # List alerts — must include the one we created
    r = s.get(f"{API}/alerts", headers=auth(buyer_token))
    assert r.status_code == 200
    ids = [a["id"] for a in r.json()]
    assert alert_id in ids

    # Create a below alert too
    r2 = s.post(f"{API}/alerts", json={"direction": "below", "threshold": 0.01}, headers=auth(buyer_token))
    assert r2.status_code == 200

    # Delete the first one
    d = s.delete(f"{API}/alerts/{alert_id}", headers=auth(buyer_token))
    assert d.status_code == 200
    assert d.json()["ok"] is True

    # Verify removal
    r = s.get(f"{API}/alerts", headers=auth(buyer_token))
    ids = [a["id"] for a in r.json()]
    assert alert_id not in ids

    # Delete not-owned / non-existent → 404
    d2 = s.delete(f"{API}/alerts/{alert_id}", headers=auth(buyer_token))
    assert d2.status_code == 404

    # cleanup: also delete the second one
    s.delete(f"{API}/alerts/{r2.json()['id']}", headers=auth(buyer_token))


def test_alert_isolation_between_users(s, buyer_token):
    # register stranger
    import uuid
    email = f"stranger_{uuid.uuid4().hex[:6]}@x.com"
    reg = s.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "full_name": "Stranger"}).json()
    stranger = reg["token"]

    # buyer creates alert
    r = s.post(f"{API}/alerts", json={"direction": "above", "threshold": 8.88}, headers=auth(buyer_token))
    aid = r.json()["id"]

    # stranger sees none of buyer's
    r_s = s.get(f"{API}/alerts", headers=auth(stranger))
    assert r_s.status_code == 200
    assert all(a["id"] != aid for a in r_s.json())

    # stranger cannot delete buyer's alert
    d = s.delete(f"{API}/alerts/{aid}", headers=auth(stranger))
    assert d.status_code == 404

    # cleanup
    s.delete(f"{API}/alerts/{aid}", headers=auth(buyer_token))


# ---------------- Regression: Phase 1 endpoints ----------------
def test_regression_login(s):
    r = s.post(f"{API}/auth/login", json={"email": "demo@cottonhub.com", "password": "demo1234"})
    assert r.status_code == 200


def test_regression_listings(s):
    r = s.get(f"{API}/listings")
    assert r.status_code == 200
    assert len(r.json()) >= 4


def test_regression_conversations(s, buyer_token):
    r = s.get(f"{API}/conversations", headers=auth(buyer_token))
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_regression_ai_assist(s, buyer_token):
    r = s.post(f"{API}/ai/assist", json={
        "mode": "reply",
        "context": "Seller offered cotton at 1.95/kg",
        "user_intent": "ask about lead time"
    }, headers=auth(buyer_token), timeout=60)
    assert r.status_code == 200
    assert len(r.json()["suggestion"].strip()) > 5
