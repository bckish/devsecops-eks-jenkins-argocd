"""Exercise only the disposable local Compose checkout gateway."""
import json
import time
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from uuid import uuid4

BASE = "http://127.0.0.1:18087"


def call(payload):
    request = Request(BASE + "/api/checkout", data=json.dumps(payload).encode(), headers={"Content-Type":"application/json"})
    with urlopen(request, timeout=15) as response:
        return json.load(response)


def main():
    payload = {"orderId":"demo-"+uuid4().hex, "amountCents":12500, "features":[0.4,0.5,0.3]}
    for attempt in range(40):
        try:
            with urlopen(BASE, timeout=3) as response:
                assert b"FinTech checkout lab" in response.read()
            value = call(payload)
            break
        except (OSError, HTTPError):
            if attempt == 39:
                raise
            time.sleep(2)
    assert value["synthetic"] is True
    assert value["payment"]["status"] == "MOCK_APPROVED"
    assert value["notification"]["status"] == "MOCK_RECORDED"
    assert value["ledger"]["balanceCents"] == 10000
    assert value["fraud"]["synthetic"] is True
    assert call(payload) == value
    for changed, status in [(dict(payload, amountCents=123), 409), (dict(payload, orderId="real-order"), 400)]:
        try:
            call(changed)
            raise AssertionError("expected rejection")
        except HTTPError as exc:
            assert exc.code == status
    print("PASS: checkout UI, payment, ledger, notification, fraud, replay and validation")


if __name__ == "__main__":
    main()
