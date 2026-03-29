#!/usr/bin/env python3
"""Random 50-event stress test for EventFlow. Run via: make test-random"""
import urllib.request, urllib.error, json, random, string, time

API = "http://localhost:3000"
KEYS = ["dev_key_123", "test_key_456"]

def rid(prefix, n=8):
    return prefix + "_" + "".join(random.choices(string.ascii_lowercase + string.digits, k=n))

def email():
    names = ["alice","bob","carol","dave","eve","frank","grace","heidi","ivan","judy"]
    domains = ["example.com","test.io","demo.dev","acme.co","widgets.net"]
    return f"{random.choice(names)}{random.randint(1,99)}@{random.choice(domains)}"

def amount():
    return round(random.uniform(1.99, 999.99), 2)

EVENTS = [
    lambda: ("user.signup",          {"userId": rid("usr"), "email": email(), "plan": random.choice(["free","pro","enterprise"]), "source": random.choice(["organic","referral","ad"])}),
    lambda: ("user.login",           {"userId": rid("usr"), "email": email(), "ip": f"10.{random.randint(0,255)}.{random.randint(0,255)}.1", "userAgent": random.choice(["Mozilla/5.0","curl/7.88","PostmanRuntime/7.36"])}),
    lambda: ("user.logout",          {"userId": rid("usr"), "sessionDuration": random.randint(30, 7200)}),
    lambda: ("user.updated",         {"userId": rid("usr"), "fields": random.sample(["email","name","avatar","timezone","plan"], k=random.randint(1,3))}),
    lambda: ("user.deleted",         {"userId": rid("usr"), "reason": random.choice(["requested","admin","fraud","inactivity"])}),
    lambda: ("order.created",        {"orderId": rid("ord"), "userId": rid("usr"), "amount": amount(), "currency": random.choice(["USD","EUR","GBP"]), "items": random.randint(1,10)}),
    lambda: ("order.updated",        {"orderId": rid("ord"), "status": random.choice(["confirmed","packed","dispatched"]), "updatedBy": "system"}),
    lambda: ("order.shipped",        {"orderId": rid("ord"), "carrier": random.choice(["FedEx","UPS","USPS","DHL"]), "trackingId": rid("TRK").upper(), "eta": "2026-04-05"}),
    lambda: ("order.delivered",      {"orderId": rid("ord"), "deliveredAt": "2026-03-29T12:00:00Z", "signature": random.choice([True, False])}),
    lambda: ("order.cancelled",      {"orderId": rid("ord"), "reason": random.choice(["customer_request","out_of_stock","fraud_detected"]), "refund": amount()}),
    lambda: ("payment.processed",    {"transactionId": rid("txn"), "amount": amount(), "currency": random.choice(["USD","EUR","GBP"]), "method": random.choice(["card","bank_transfer","paypal","crypto"]), "status": "success"}),
    lambda: ("payment.failed",       {"transactionId": rid("txn"), "amount": amount(), "reason": random.choice(["insufficient_funds","card_declined","expired_card","fraud_block"]), "attempt": random.randint(1,3)}),
    lambda: ("payment.refunded",     {"transactionId": rid("txn"), "refundId": rid("ref"), "amount": amount(), "initiatedBy": random.choice(["customer","support","system"])}),
    lambda: ("session.started",      {"sessionId": rid("ses"), "userId": rid("usr"), "device": random.choice(["desktop","mobile","tablet"]), "os": random.choice(["macOS","Windows","iOS","Android","Linux"])}),
    lambda: ("session.ended",        {"sessionId": rid("ses"), "duration": random.randint(10, 3600), "pagesViewed": random.randint(1, 50), "bounced": random.choice([True, False])}),
    lambda: ("notification.sent",    {"notifId": rid("ntf"), "userId": rid("usr"), "channel": random.choice(["email","sms","push","slack"]), "template": random.choice(["welcome","reset_password","invoice","reminder"])}),
    lambda: ("notification.clicked", {"notifId": rid("ntf"), "userId": rid("usr"), "linkId": rid("lnk"), "campaign": rid("cmp")}),
    lambda: ("inventory.updated",    {"sku": rid("SKU").upper(), "delta": random.randint(-50, 200), "warehouse": random.choice(["US-EAST","US-WEST","EU-CENTRAL","APAC"])}),
    lambda: ("product.viewed",       {"productId": rid("prd"), "userId": rid("usr"), "source": random.choice(["search","homepage","recommendation","direct"])}),
    lambda: ("product.reviewed",     {"productId": rid("prd"), "userId": rid("usr"), "rating": random.randint(1, 5), "verified": random.choice([True, False]), "body": "Great product!"}),
]

def main():
    print("🚀 Sending 50 random events...\n")
    results = {"sent": 0, "failed": 0, "by_type": {}}

    for i in range(1, 51):
        etype, payload = random.choice(EVENTS)()
        key = random.choice(KEYS)
        body = json.dumps({"type": etype, "payload": payload}).encode()
        req = urllib.request.Request(
            f"{API}/events", data=body,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as r:
                d = json.loads(r.read())
                results["sent"] += 1
                results["by_type"][etype] = results["by_type"].get(etype, 0) + 1
                print(f"  [{i:02d}] ✓  {etype:<32} id={d['id'][:8]}…  key={key[:8]}…")
        except urllib.error.HTTPError as e:
            results["failed"] += 1
            err = e.read().decode()
            print(f"  [{i:02d}] ✗  {etype:<32} HTTP {e.code}: {err[:50]}")
        except Exception as ex:
            results["failed"] += 1
            print(f"  [{i:02d}] ✗  {etype:<32} {ex}")
        time.sleep(0.05)

    print(f"\n{'─'*62}")
    print(f"  Sent: {results['sent']}/50    Failed: {results['failed']}/50")
    print(f"\n  Event types fired this run:")
    for t, n in sorted(results["by_type"].items(), key=lambda x: -x[1]):
        bar = "█" * n
        print(f"    {t:<34} {bar} {n}")
    print(f"\n  Dashboard → http://localhost:5173")
    print(f"  Metrics   → make metrics\n")

if __name__ == "__main__":
    main()
