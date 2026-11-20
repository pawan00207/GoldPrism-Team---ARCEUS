from __future__ import annotations

import hashlib
import os
import unittest
from pathlib import Path
from unittest.mock import patch
from typing import Any

from src.integrations.tinyfish_client import TinyFishClient


class _Response:
    def __init__(self, payload: dict[str, Any], status_code: int = 200) -> None:
        self.payload = payload
        self.status_code = status_code

    def json(self) -> dict[str, Any]:
        return self.payload


class _Session:
    def __init__(self, response: _Response) -> None:
        self.response = response
        self.calls: list[dict[str, Any]] = []

    def request(self, method: str, url: str, **kwargs: Any) -> _Response:
        self.calls.append({"method": method, "url": url, **kwargs})
        return self.response


class TinyFishIsolationTests(unittest.TestCase):
    def test_missing_key_reports_unavailable_without_network_access(self) -> None:
        session = _Session(_Response({}))
        with patch.dict(os.environ, {}, clear=True):
            client = TinyFishClient(session=session)
            health = client.health_check()

        self.assertEqual(health["status"], "UNAVAILABLE")
        self.assertFalse(health["configured"])
        self.assertEqual(session.calls, [])

    def test_search_uses_test_fixture_response_and_does_not_change_sealed_files(self) -> None:
        root = Path(__file__).resolve().parents[1]
        protected = (root / "results" / "holdout.json", root / "results" / "manifest.json")

        def hashes() -> tuple[str, ...]:
            return tuple(hashlib.sha256(path.read_bytes()).hexdigest() for path in protected)

        before = hashes()
        session = _Session(_Response({"results": [{"title": "test fixture"}]}))
        with patch.dict(os.environ, {"TINYFISH_API_KEY": "test-fixture-key"}, clear=True):
            client = TinyFishClient(session=session, retries=0, backoff_seconds=0)
            first = client.search("test fixture query")
            second = client.search("test fixture query")

        self.assertEqual(first, second)
        self.assertEqual(len(session.calls), 1)
        self.assertEqual(session.calls[0]["headers"]["X-API-Key"], "test-fixture-key")
        self.assertEqual(hashes(), before)


if __name__ == "__main__":
    unittest.main()
