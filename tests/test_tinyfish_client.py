from __future__ import annotations

import logging
from typing import Any

import pytest
import requests

from src.integrations.tinyfish_client import TinyFishClient, TinyFishError


class _Response:
    def __init__(self, status_code: int, payload: dict[str, Any]) -> None:
        self.status_code = status_code
        self._payload = payload

    def json(self) -> dict[str, Any]:
        return self._payload


class _Session:
    def __init__(self, responses: list[_Response]) -> None:
        self.responses = responses
        self.calls: list[dict[str, Any]] = []

    def request(self, method: str, url: str, **kwargs: Any) -> _Response:
        self.calls.append({"method": method, "url": url, **kwargs})
        response = self.responses.pop(0)
        if response.status_code >= 400:
            return response
        return response


def test_search_uses_documented_endpoint_and_ttl_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TINYFISH_API_KEY", "test-secret")
    session = _Session([_Response(200, {"results": [{"title": "News"}]})])
    client = TinyFishClient(session=session, backoff_seconds=0)

    first = client.search("gold", domain_type="news", recency_minutes=1440)
    second = client.search("gold", domain_type="news", recency_minutes=1440)

    assert first == second
    assert len(session.calls) == 1
    assert session.calls[0]["url"] == "https://api.search.tinyfish.ai"
    assert session.calls[0]["headers"]["X-API-Key"] == "test-secret"
    assert session.calls[0]["params"]["recency_minutes"] == 1440


def test_fetch_retries_transient_http_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TINYFISH_API_KEY", "test-secret")
    session = _Session(
        [
            _Response(503, {"error": "temporarily unavailable"}),
            _Response(200, {"results": [{"url": "https://www.mcxindia.com"}], "errors": []}),
        ]
    )
    client = TinyFishClient(session=session, retries=1, backoff_seconds=0)

    result = client.fetch(["https://www.mcxindia.com"])

    assert result["results"][0]["url"] == "https://www.mcxindia.com"
    assert len(session.calls) == 2
    assert session.calls[0]["json"]["ttl"] == 0


def test_agent_requires_completed_structured_result(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TINYFISH_API_KEY", "test-secret")
    session = _Session([_Response(200, {"status": "FAILED", "result": None})])
    client = TinyFishClient(session=session, backoff_seconds=0)

    with pytest.raises(TinyFishError, match="completed structured result"):
        client.run_agent(
            "https://www.mcxindia.com",
            "Extract public data",
            {"type": "object", "properties": {}, "required": []},
        )


def test_health_check_reports_missing_key_without_request(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("TINYFISH_API_KEY", raising=False)
    session = _Session([])

    health = TinyFishClient(session=session).health_check()

    assert health["status"] == "UNAVAILABLE"
    assert health["configured"] is False
    assert not session.calls


def test_api_key_is_never_written_to_logs(monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture) -> None:
    api_key = "private-test-key"
    monkeypatch.setenv("TINYFISH_API_KEY", api_key)
    session = _Session([_Response(401, {"error": "unauthorized"})])
    client = TinyFishClient(session=session, retries=0)

    with caplog.at_level(logging.WARNING):
        with pytest.raises(TinyFishError):
            client.search("gold")

    assert api_key not in caplog.text


def test_request_exception_is_redacted_and_raised(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TINYFISH_API_KEY", "test-secret")

    class _FailingSession:
        def request(self, *_args: Any, **_kwargs: Any) -> _Response:
            raise requests.Timeout("request timed out")

    client = TinyFishClient(session=_FailingSession(), retries=0)
    with pytest.raises(TinyFishError, match="request failed"):
        client.search("gold")
